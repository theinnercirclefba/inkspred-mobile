#!/usr/bin/env python3
"""Push the InkSpred native app to its Codemagic build repo.

Takes the CONTENTS of apps/native (this script's grandparent directory),
excluding node_modules / .expo* / ios / android / .git, and publishes them as a
SINGLE commit that REPLACES the entire tree of the `main` branch of
theinnercirclefba/inkspred-mobile.

It uses the GitHub Git Data API directly (stdlib only):
    create blobs  ->  create tree (no base_tree => full replace)
    ->  create commit (parent = current main head)  ->  update ref (force)

The result is a clean, single-commit snapshot at the repo root — which is where
Codemagic looks for codemagic.yaml. The commit sha is printed on success.

Auth: a GitHub token is read from ~/.claude/.secrets/gh-token-tmp.

Usage:
    python push-to-buildrepo.py            # push for real
    python push-to-buildrepo.py --dry-run  # list what WOULD be pushed, no network
    python push-to-buildrepo.py --repo owner/name --branch main
"""

from __future__ import annotations

import argparse
import base64
import json
import os
import sys
import urllib.error
import urllib.request

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

DEFAULT_REPO = "theinnercirclefba/inkspred-mobile"
DEFAULT_BRANCH = "main"
TOKEN_PATH = os.path.expanduser("~/.claude/.secrets/gh-token-tmp")

# Source = apps/native (grandparent of this script: scripts/ -> native/).
SOURCE_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Directory names pruned anywhere in the tree.
EXCLUDE_DIRS = {"node_modules", "ios", "android", ".git", ".github"}
# Directory-name prefixes pruned anywhere in the tree (.expo, .expo-shared,
# .expo-export-check, ...).
EXCLUDE_DIR_PREFIXES = (".expo",)
# Individual files never pushed.
EXCLUDE_FILES = {".DS_Store"}

API = "https://api.github.com"


# ---------------------------------------------------------------------------
# File collection
# ---------------------------------------------------------------------------

def collect_files(root: str) -> list[str]:
    """Return repo-relative POSIX paths of every file to push."""
    paths: list[str] = []
    for dirpath, dirnames, filenames in os.walk(root):
        # Prune excluded directories in place so os.walk doesn't descend them.
        dirnames[:] = [
            d for d in dirnames
            if d not in EXCLUDE_DIRS
            and not any(d.startswith(p) for p in EXCLUDE_DIR_PREFIXES)
        ]
        for name in filenames:
            if name in EXCLUDE_FILES:
                continue
            abs_path = os.path.join(dirpath, name)
            rel = os.path.relpath(abs_path, root).replace(os.sep, "/")
            paths.append(rel)
    paths.sort()
    return paths


def is_probably_binary(data: bytes) -> bool:
    if b"\x00" in data:
        return True
    try:
        data.decode("utf-8")
        return False
    except UnicodeDecodeError:
        return True


# ---------------------------------------------------------------------------
# GitHub API helpers
# ---------------------------------------------------------------------------

def read_token() -> str:
    if not os.path.exists(TOKEN_PATH):
        sys.exit(f"ERROR: GitHub token not found at {TOKEN_PATH}")
    with open(TOKEN_PATH, "r", encoding="utf-8") as fh:
        token = fh.read().strip()
    if not token:
        sys.exit(f"ERROR: GitHub token at {TOKEN_PATH} is empty")
    return token


def api_request(method: str, url: str, token: str, body: dict | None = None) -> dict:
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Authorization", f"Bearer {token}")
    req.add_header("Accept", "application/vnd.github+json")
    req.add_header("X-GitHub-Api-Version", "2022-11-28")
    req.add_header("User-Agent", "inkspred-push-to-buildrepo")
    if data is not None:
        req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req) as resp:
            raw = resp.read()
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", "replace")
        sys.exit(f"ERROR: {method} {url} -> HTTP {exc.code}\n{detail}")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(description="Push apps/native to the Codemagic build repo.")
    parser.add_argument("--repo", default=DEFAULT_REPO, help="owner/name (default %(default)s)")
    parser.add_argument("--branch", default=DEFAULT_BRANCH, help="branch to replace (default %(default)s)")
    parser.add_argument("--dry-run", action="store_true", help="list files, make no network calls")
    args = parser.parse_args()

    files = collect_files(SOURCE_ROOT)
    if not files:
        sys.exit(f"ERROR: no files found under {SOURCE_ROOT}")

    print(f"Source: {SOURCE_ROOT}")
    print(f"Target: {args.repo}@{args.branch}")
    print(f"Files:  {len(files)}")

    if args.dry_run:
        print("\n-- DRY RUN — files that would be pushed --")
        for rel in files:
            print(f"  {rel}")
        print("\nNo network calls made.")
        return

    token = read_token()
    owner_repo = args.repo

    # 1. Current head of the target branch (becomes our commit's parent).
    ref = api_request("GET", f"{API}/repos/{owner_repo}/git/ref/heads/{args.branch}", token)
    parent_sha = ref["object"]["sha"]
    print(f"\nCurrent {args.branch} head: {parent_sha}")

    # 2. Create a blob per file, building the tree spec.
    tree_entries: list[dict] = []
    for rel in files:
        abs_path = os.path.join(SOURCE_ROOT, rel.replace("/", os.sep))
        with open(abs_path, "rb") as fh:
            data = fh.read()
        if is_probably_binary(data):
            blob_body = {"content": base64.b64encode(data).decode("ascii"), "encoding": "base64"}
        else:
            blob_body = {"content": data.decode("utf-8"), "encoding": "utf-8"}
        blob = api_request("POST", f"{API}/repos/{owner_repo}/git/blobs", token, blob_body)
        tree_entries.append({
            "path": rel,
            "mode": "100644",
            "type": "blob",
            "sha": blob["sha"],
        })
        print(f"  blob {blob['sha'][:9]}  {rel}")

    # 3. Create the tree. base_tree omitted => this tree fully REPLACES the old one.
    tree = api_request("POST", f"{API}/repos/{owner_repo}/git/trees", token, {"tree": tree_entries})
    print(f"\nTree: {tree['sha']}")

    # 4. Create the commit on top of the current head.
    commit = api_request("POST", f"{API}/repos/{owner_repo}/git/commits", token, {
        "message": "Sync InkSpred native app from monorepo apps/native",
        "tree": tree["sha"],
        "parents": [parent_sha],
    })
    commit_sha = commit["sha"]
    print(f"Commit: {commit_sha}")

    # 5. Move the branch ref to the new commit (force — we replaced the tree).
    api_request("PATCH", f"{API}/repos/{owner_repo}/git/refs/heads/{args.branch}", token, {
        "sha": commit_sha,
        "force": True,
    })

    print(f"\nPushed to {owner_repo}@{args.branch}")
    print(commit_sha)


if __name__ == "__main__":
    main()
