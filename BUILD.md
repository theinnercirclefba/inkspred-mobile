# InkSpred native app — iOS build & release pipeline

The native app (Expo SDK 52 / expo-router) ships to TestFlight from a **cloud
Mac on Codemagic**. There is no Mac and no Xcode needed locally.

The pipeline has two halves:

1. **`push-to-buildrepo.py`** — copies this app out of the monorepo into a
   standalone GitHub repo.
2. **`codemagic.yaml`** — runs on Codemagic, turns that repo into a signed
   `.ipa`, and publishes it to TestFlight.

```
apps/native  ──push-to-buildrepo.py──▶  theinnercirclefba/inkspred-mobile (main)
                                                      │
                                          Codemagic (auto-detects push)
                                                      │
                                        expo prebuild → pod install → sign → ipa
                                                      │
                                                 TestFlight
```

## Why a separate build repo?

The app lives inside an npm-workspaces monorepo, but Codemagic builds cleanest
from a repo where the app sits at the **root** (that's where it looks for
`codemagic.yaml`). So we snapshot `apps/native` into
`theinnercirclefba/inkspred-mobile`. That repo used to hold the old Capacitor
wrapper — this pipeline **replaces** it.

Because the app can now build both inside the monorepo (dev) and standalone
(CI), `metro.config.js` detects its context: it only applies the Expo-monorepo
resolver recipe when `../../package.json` exists **and** declares `workspaces`.
In the standalone build repo that marker is absent, so Metro falls back to a
plain single-project config automatically. No edits needed between the two.

## Step 1 — push the app to the build repo

From anywhere in the repo:

```bash
python apps/native/scripts/push-to-buildrepo.py --dry-run   # preview file list
python apps/native/scripts/push-to-buildrepo.py             # push for real
```

What it does (GitHub Git Data API, stdlib only):

- Collects every file under `apps/native`, **excluding** `node_modules/`,
  `.expo*/`, `ios/`, `android/`, `.git/`.
- Creates a blob per file (text as UTF-8, binaries as base64).
- Builds a tree with **no `base_tree`** → the new tree fully **replaces** the
  old repo contents (clean single-commit snapshot, no leftover wrapper files).
- Commits on top of the current `main` head and force-updates the ref.
- Prints the new commit sha.

Auth token is read from `~/.claude/.secrets/gh-token-tmp` (never committed).
Override the target with `--repo owner/name` / `--branch name` if needed.

Pushing to `main` is what **triggers the Codemagic build** (the workflow is set
to build on push to `main`).

## Step 2 — Codemagic build (`codemagic.yaml`, workflow `ios-native`)

Runs automatically on push. Steps:

1. **npm install** — first prunes any workspace-protocol deps (version `"*"` or
   `workspace:*`) from `package.json`; those only resolve inside the monorepo
   and are unused in the app source, so they're stripped before install.
2. **`expo prebuild --platform ios --no-install`** — generates the native
   `ios/` project from `app.json`. (`--no-install` skips the automatic pod/npm
   install so we can run pods explicitly below.)
3. **`pod install`** in `ios/`.
4. **Code signing** — `keychain initialize`, decode `CERT_KEY` (base64) →
   `app-store-connect fetch-signing-files app.inkspred IOS_APP_STORE --create`
   → `keychain add-certificates` → `xcode-project use-profiles`. This mirrors
   the old wrapper's working signing exactly.
5. **Build number** — `agvtool new-version -all $BUILD_NUMBER`.
6. **Build IPA** — `xcode-project build-ipa --workspace
   ios/InkSpred.xcworkspace --scheme InkSpred`. `expo prebuild` derives both
   names from `app.json`'s `"name": "InkSpred"`. If the app is ever renamed in
   `app.json`, update `XCODE_WORKSPACE` / `XCODE_SCHEME` in `codemagic.yaml` to
   match.
7. **Publish** — the `.ipa` is uploaded to **TestFlight** via the
   `app_store_connect` integration.

Privacy usage strings (location / camera / photo library) are carried in
`app.json` under `ios.infoPlist`, so `expo prebuild` bakes them straight into
`Info.plist` — no PlistBuddy step is needed (unlike the old wrapper).

## One-time Codemagic setup — already done, nothing to change

The build reuses the **existing** account-level Codemagic configuration; you do
**not** need to re-add any of it:

- Integration **`app_store_connect`** — App Store Connect API key.
- Env group **`signing`** — `CERT_KEY`, the persistent iOS distribution cert.
- Bundle id **`app.inkspred`** — registered in App Store Connect.

The Codemagic app is the same one already wired to
`theinnercirclefba/inkspred-mobile` (**app id `6a4bd01b9570dbc06c9a4442`**). It
keeps working as-is: Codemagic **auto-detects the `codemagic.yaml` at the repo
root**, so replacing the wrapper `codemagic.yaml` with this native one (via the
push script) is all that's required — no dashboard reconfiguration.

## Typical release flow

```bash
# 1. make your changes in apps/native, verify locally
cd apps/native && npx tsc --noEmit && npm run bundle:check

# 2. snapshot to the build repo (this triggers the build)
python apps/native/scripts/push-to-buildrepo.py

# 3. watch the ios-native workflow on codemagic.io → TestFlight
```
