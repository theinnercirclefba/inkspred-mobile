/**
 * Outbound web links — the native app is a companion to the InkSpred website,
 * so a handful of surfaces (a studio's public /s/{slug} page, the legal pages,
 * account deletion) live on the web and are opened in the device browser.
 *
 * The base URL is read from EXPO_PUBLIC_WEB_URL (inlined at build time) or
 * app.json `extra`, falling back to the production domain so a bare build still
 * resolves real links. Mirrors the config pattern in lib/supabase.ts.
 */

import Constants from "expo-constants";
import { Linking } from "react-native";

const FALLBACK_WEB_URL = "https://inkspred.co.uk";

function readWebBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_WEB_URL;
  if (fromEnv) return fromEnv.replace(/\/+$/, "");
  const fromExtra = (Constants.expoConfig?.extra as Record<string, string> | undefined)
    ?.EXPO_PUBLIC_WEB_URL;
  if (fromExtra) return fromExtra.replace(/\/+$/, "");
  return FALLBACK_WEB_URL;
}

/** The InkSpred website origin, without a trailing slash. */
export const WEB_BASE_URL = readWebBaseUrl();

/** The bare host, e.g. "inkspred.co.uk", for inline display next to a slug. */
export const WEB_HOST = WEB_BASE_URL.replace(/^https?:\/\//, "");

/** A studio's public directory page. */
export function publicStudioUrl(slug: string): string {
  return `${WEB_BASE_URL}/s/${slug}`;
}

/** An artist's public bookable profile. */
export function publicArtistUrl(handle: string): string {
  return `${WEB_BASE_URL}/a/${handle}`;
}

export const PRIVACY_URL = `${WEB_BASE_URL}/privacy`;
export const TERMS_URL = `${WEB_BASE_URL}/terms`;
/** Where a signed-in user manages/deletes their account (web-only for now). */
export const ACCOUNT_URL = `${WEB_BASE_URL}/account`;

/**
 * Open a URL in the device browser, swallowing the rare rejection (an
 * unsupported scheme) so a tap never throws into the render tree.
 */
export async function openExternal(url: string): Promise<void> {
  try {
    await Linking.openURL(url);
  } catch {
    // No-op: nothing we can do if the OS can't handle the URL.
  }
}
