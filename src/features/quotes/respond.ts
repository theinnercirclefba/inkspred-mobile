/**
 * Customer quote responses — accept or decline, natively.
 *
 * POSTs to the web's bearer-authenticated bridges (/api/app/quotes/accept and
 * /decline), which run the SAME acceptQuoteCore/declineQuoteCore the web uses,
 * so there is no logic drift: accepting materialises the confirmed appointment
 * (and its deposit) server-side and returns its id. The artist's notification
 * fires from the quotes UPDATE trigger, not from the client.
 *
 * Mirrors payDeposit's shape: calm, user-readable errors; never throws into a
 * screen.
 */
import { supabase } from "../../lib/supabase";
import { WEB_BASE_URL } from "../../lib/links";
import { maybeRequestReview } from "../../lib/reviewPrompt";

export type QuoteAction = "accept" | "decline";

export type RespondResult =
  | { ok: true; appointmentId: string | null }
  | { ok: false; error: string };

const FRIENDLY: Record<string, string> = {
  unauthenticated: "Please sign in again to respond to this quote.",
  no_quote: "We couldn't find that quote — pull to refresh and try again.",
  not_yours: "This quote isn't addressed to your account.",
  not_open: "This quote is no longer open — it may have expired or been withdrawn.",
  failed: "Something went wrong — please try again.",
};

export async function respondToQuote(
  quoteId: string,
  action: QuoteAction,
): Promise<RespondResult> {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return { ok: false, error: FRIENDLY.unauthenticated };

    const res = await fetch(`${WEB_BASE_URL}/api/app/quotes/${action}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ quoteId }),
    });

    const body = (await res.json().catch(() => null)) as {
      ok?: boolean;
      error?: string;
      appointmentId?: string;
    } | null;

    if (!body?.ok) {
      const code = body?.error ?? "failed";
      return { ok: false, error: FRIENDLY[code] ?? FRIENDLY.failed };
    }

    if (action === "accept") {
      // Peak-happiness moment: their piece just became a real booking.
      void maybeRequestReview();
    }
    return { ok: true, appointmentId: body.appointmentId ?? null };
  } catch {
    return { ok: false, error: "No connection — please try again." };
  }
}
