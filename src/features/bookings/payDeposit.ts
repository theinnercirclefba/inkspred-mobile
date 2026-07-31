/**
 * Native deposit checkout — the real money moment.
 *
 * Flow: POST the appointment to the web's bearer-authenticated bridge
 * (/api/app/deposits/checkout, same createDepositCheckoutCore the web uses) →
 * open the returned Stripe Checkout URL in an auth browser session → Stripe
 * redirects to the web's /app-return trampoline, which bounces to
 * `inkspred://app-return?...`, closing the session → parse the outcome from
 * that deep link. The webhook (not this client) is what actually records the
 * payment, so on success the caller refetches bookings and trusts the server.
 *
 * Every failure returns a calm, user-readable error — this flow must never
 * throw into the Bookings screen.
 */
import * as WebBrowser from "expo-web-browser";
import { supabase } from "../../lib/supabase";
import { WEB_BASE_URL } from "../../lib/links";
import { maybeRequestReview } from "../../lib/reviewPrompt";

const RETURN_SCHEME = "inkspred://app-return";

export type PayDepositResult =
  | { ok: true }
  | { ok: false; cancelled: true }
  | { ok: false; cancelled?: false; error: string };

const FRIENDLY: Record<string, string> = {
  unauthenticated: "Please sign in again to pay your deposit.",
  not_found: "We couldn't find that booking — pull to refresh and try again.",
  no_deposit: "This booking has no deposit to pay.",
  already_paid: "This deposit has already been paid — pull to refresh.",
  stripe_error: "Payments are having a moment — please try again shortly.",
};

export async function payDeposit(appointmentId: string): Promise<PayDepositResult> {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return { ok: false, error: FRIENDLY.unauthenticated };

    const res = await fetch(`${WEB_BASE_URL}/api/app/deposits/checkout`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ appointmentId }),
    });

    const body = (await res.json().catch(() => null)) as
      | { ok: boolean; url?: string; error?: string }
      | null;
    if (!body?.ok || !body.url) {
      return {
        ok: false,
        error: FRIENDLY[body?.error ?? ""] ?? FRIENDLY.stripe_error,
      };
    }

    const session = await WebBrowser.openAuthSessionAsync(body.url, RETURN_SCHEME);
    if (session.type !== "success" || !session.url) {
      // User closed the sheet mid-checkout. Not an error — Stripe took nothing.
      return { ok: false, cancelled: true };
    }

    const status = new URL(session.url).searchParams.get("status");
    if (status === "success") {
      // Peak-happiness moment: they just secured their tattoo session.
      void maybeRequestReview();
      return { ok: true };
    }
    return { ok: false, cancelled: true };
  } catch {
    return { ok: false, error: FRIENDLY.stripe_error };
  }
}
