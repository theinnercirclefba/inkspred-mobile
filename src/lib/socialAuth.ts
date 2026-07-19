import { Platform } from "react-native";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";

/**
 * Native social sign-in for InkSpred (Apple + Google), kept separate from the
 * AuthProvider so the provider stays the single owner of session/profile state.
 * Each helper performs the native/OAuth dance and hands Supabase the resulting
 * credential; the caller (auth.tsx) is responsible for loading the profile row
 * afterwards.
 *
 * Apple is the primary provider on iOS. Google is browser-based OAuth and is
 * gated off until the Google provider is enabled in the Supabase dashboard —
 * see `isGoogleConfigured`.
 */

/**
 * Flip to `true` once the Google provider is switched on in Supabase
 * (Authentication → Providers → Google, with the iOS/web client IDs set). Until
 * then the Google button stays hidden so we never render a dead control.
 * TODO(google): enable the Supabase Google provider, then set this to true.
 */
export const isGoogleConfigured = true;

export interface SocialAuthResult {
  ok: boolean;
  /** A user-facing message when `ok` is false and it wasn't a plain cancel. */
  error?: string;
  /** The user backed out of the native/OAuth sheet — treat as a no-op. */
  cancelled?: boolean;
  /** The session Supabase established, so the caller can load the profile. */
  session?: Session | null;
}

/** Complete the browser session before anything else warms up the auth flow. */
WebBrowser.maybeCompleteAuthSession();

/**
 * "Continue with Apple". Uses a raw nonce hashed with SHA-256 (Apple signs the
 * hashed value; Supabase verifies against the raw one). Apple only returns the
 * user's name on the *first* authorisation, so when we get it we persist it
 * into Supabase auth user metadata for the role-completion step to read.
 */
export async function signInWithApple(): Promise<SocialAuthResult> {
  if (Platform.OS !== "ios") {
    return { ok: false, error: "Apple sign-in is only available on iPhone and iPad." };
  }

  try {
    const available = await AppleAuthentication.isAvailableAsync();
    if (!available) {
      return { ok: false, error: "Apple sign-in isn't available on this device." };
    }

    // Raw nonce travels to Supabase; its SHA-256 hash goes to Apple.
    const rawNonce = Crypto.randomUUID();
    const hashedNonce = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      rawNonce,
    );

    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    });

    if (!credential.identityToken) {
      return { ok: false, error: "Apple didn't return a sign-in token. Please try again." };
    }

    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: "apple",
      token: credential.identityToken,
      nonce: rawNonce,
    });

    if (error) {
      return { ok: false, error: "We couldn't sign you in with Apple. Please try again." };
    }

    // Apple hands over the name only on first consent — capture it while we can.
    const fullName = [credential.fullName?.givenName, credential.fullName?.familyName]
      .filter(Boolean)
      .join(" ")
      .trim();
    if (fullName) {
      await supabase.auth.updateUser({ data: { full_name: fullName } }).catch(() => {});
    }

    return { ok: true, session: data.session };
  } catch (err) {
    if (isCancel(err)) return { ok: false, cancelled: true };
    return { ok: false, error: "We couldn't sign you in with Apple. Please try again." };
  }
}

/**
 * "Continue with Google" via browser-based OAuth. We ask Supabase for the
 * provider URL (without auto-redirecting), open it in an auth session, then
 * exchange the returned callback URL for a Supabase session — handling both the
 * PKCE (`?code=`) and implicit (`#access_token=`) shapes.
 *
 * Currently gated behind `isGoogleConfigured` so the button never renders until
 * the provider is live.
 */
export async function signInWithGoogle(): Promise<SocialAuthResult> {
  try {
    // Deep link back into the app: resolves to `inkspred://auth` in a build.
    const redirectTo = Linking.createURL("auth");

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
        skipBrowserRedirect: true,
        queryParams: { prompt: "select_account" },
      },
    });

    if (error || !data?.url) {
      return { ok: false, error: "We couldn't start Google sign-in. Please try again." };
    }

    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (result.type !== "success" || !result.url) {
      return { ok: false, cancelled: true };
    }

    const session = await sessionFromCallbackUrl(result.url);
    if (!session) {
      return { ok: false, error: "We couldn't finish Google sign-in. Please try again." };
    }

    return { ok: true, session };
  } catch {
    return { ok: false, error: "We couldn't sign you in with Google. Please try again." };
  }
}

/**
 * Turn the OAuth callback URL into a Supabase session. PKCE returns an
 * authorization `code` in the query string; the implicit flow returns tokens in
 * the URL fragment. We support both so this keeps working regardless of the
 * client's `flowType`.
 */
async function sessionFromCallbackUrl(url: string): Promise<Session | null> {
  const parsed = new URL(url);

  // Some flows put the auth params in the fragment (#) rather than the query.
  const fragment = parsed.hash.startsWith("#") ? parsed.hash.slice(1) : parsed.hash;
  const fragmentParams = new URLSearchParams(fragment);
  const query = parsed.searchParams;

  const code = query.get("code");
  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return null;
    return data.session;
  }

  const accessToken = fragmentParams.get("access_token") ?? query.get("access_token");
  const refreshToken = fragmentParams.get("refresh_token") ?? query.get("refresh_token");
  if (accessToken && refreshToken) {
    const { data, error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (error) return null;
    return data.session;
  }

  return null;
}

/** Apple/native "user cancelled" surfaces as a specific error code. */
function isCancel(err: unknown): boolean {
  const code = (err as { code?: string } | null)?.code;
  return code === "ERR_REQUEST_CANCELED" || code === "ERR_CANCELED";
}
