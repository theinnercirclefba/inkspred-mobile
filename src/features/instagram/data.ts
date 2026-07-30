/**
 * Native Instagram connect + import — the app side of the bearer bridge.
 *
 * The heavy lifting lives on the web server (token exchange, storage, the
 * import pipeline); the app only ever talks to three bearer-authenticated
 * endpoints:
 *
 *   GET  /api/app/instagram/connect-url  → { url }  (authorise URL whose state
 *        is HMAC-bound to this user — see web lib/instagram/appState.ts)
 *   GET  /api/app/instagram/status       → connection state + hasArtist
 *   POST /api/app/instagram/import       → runs the portfolio import
 *
 * Connect opens the authorise URL in an auth session; Instagram bounces to the
 * web callback, which recognises the app-signed state and deep-links back to
 * inkspred://instagram-callback?ig=connected|error. No cookies, no web session.
 */

import * as WebBrowser from "expo-web-browser";
import { supabase } from "../../lib/supabase";
import { WEB_BASE_URL } from "../../lib/links";

/** Where the web callback deep-links back into the app. */
const RETURN_URL = "inkspred://instagram-callback";

export interface InstagramStatus {
  connected: boolean;
  username?: string;
  name?: string | null;
  profilePictureUrl?: string | null;
  followersCount?: number | null;
  mediaCount?: number | null;
  lastSyncedAt?: string | null;
  /** Whether the caller has an artist page (the import needs one). */
  hasArtist?: boolean;
}

export type ImportResult =
  | { ok: true; imported: number; skipped: number; total: number }
  | {
      ok: false;
      error:
        | "not_an_artist"
        | "not_connected"
        | "not_configured"
        | "fetch_failed"
        | "network";
    };

export type ConnectResult =
  | { ok: true }
  | { ok: false; cancelled?: boolean; error?: string };

async function bearer(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

async function api(path: string, init?: RequestInit): Promise<Response | null> {
  const token = await bearer();
  if (!token) return null;
  try {
    return await fetch(`${WEB_BASE_URL}${path}`, {
      ...init,
      headers: {
        ...(init?.headers ?? {}),
        Authorization: `Bearer ${token}`,
      },
    });
  } catch {
    return null;
  }
}

/** Connection state for the signed-in user; disconnected placeholder on error. */
export async function getInstagramStatus(): Promise<InstagramStatus> {
  const res = await api("/api/app/instagram/status");
  if (!res || !res.ok) return { connected: false };
  try {
    return (await res.json()) as InstagramStatus;
  } catch {
    return { connected: false };
  }
}

/**
 * Run the connect round-trip: fetch the bound authorise URL, open it in an
 * auth session, and report how the flow ended. On `{ok:true}` the connection
 * row exists server-side — refetch status to render it.
 */
export async function connectInstagram(): Promise<ConnectResult> {
  const res = await api("/api/app/instagram/connect-url");
  if (!res)
    return { ok: false, error: "Please check your connection and try again." };
  if (res.status === 503)
    return { ok: false, error: "Instagram connection isn't available yet." };
  if (!res.ok)
    return { ok: false, error: "Couldn't start Instagram connect. Try again." };

  let url: string | null = null;
  try {
    url = ((await res.json()) as { url?: string }).url ?? null;
  } catch {
    /* fall through */
  }
  if (!url)
    return { ok: false, error: "Couldn't start Instagram connect. Try again." };

  const result = await WebBrowser.openAuthSessionAsync(url, RETURN_URL);
  if (result.type !== "success" || !result.url) {
    return { ok: false, cancelled: true };
  }

  // The callback encodes the outcome in ?ig=connected|error.
  const ok = /[?&]ig=connected(&|$)/.test(result.url);
  return ok
    ? { ok: true }
    : { ok: false, error: "Instagram didn't finish connecting. Try again." };
}

/** Import recent Instagram media into the caller's portfolio. */
export async function runInstagramImport(): Promise<ImportResult> {
  const res = await api("/api/app/instagram/import", { method: "POST" });
  if (!res || !res.ok) return { ok: false, error: "network" };
  try {
    return (await res.json()) as ImportResult;
  } catch {
    return { ok: false, error: "network" };
  }
}
