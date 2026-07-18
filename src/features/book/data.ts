/**
 * Booking-request write for the native booking wizard.
 *
 * A booking request is the enquiry a customer sends an artist BEFORE anything
 * is priced (see supabase/migrations/0001_init.sql → public.booking_requests).
 * The web app persists it through a "use server" action; native has no server
 * layer, so we insert DIRECTLY with the anon client. That is safe and correct:
 * the `booking_requests_customer_insert` RLS policy only accepts a row whose
 * customer_id equals the signed-in auth uid, so the request is always
 * attributable and never spoofable — exactly the web guarantee, enforced by the
 * database rather than the action.
 *
 * NOTE — the artist notification gap: the web action ALSO writes a
 * `notifications` row so the artist's inbox pings. `notifications` has no
 * client INSERT policy (only the service role writes it), so native cannot
 * mirror that here. The request itself still saves; wiring the artist ping is
 * deferred to the API/edge phase. Left intentionally undone rather than faked.
 */

import { supabase } from "../../lib/supabase";

/** Matches a canonical v4-shaped UUID — guards the optional service_id FK. */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface CreateBookingRequestInput {
  /** The real (database) artist the enquiry is addressed to. */
  artistId: string;
  /** Chosen service id, or null for a custom / unpriced piece. */
  serviceId: string | null;
  /** Body placement, e.g. "Forearm". */
  placement: string | null;
  /** Free-text size description, e.g. "Medium · hand-span". */
  sizeDesc: string | null;
  /** Human-readable brief — REQUIRED (the DB column is NOT NULL). */
  description: string;
  /** Preferred ISO dates (yyyy-mm-dd). Stored as a jsonb array. */
  preferredDates: string[];
  /** Working budget in integer pence, or null when not given. */
  budgetPence: number | null;
}

export type CreateBookingRequestResult =
  | { ok: true; requestId: string }
  | { ok: false; error: "not_authenticated" }
  | { ok: false; error: "invalid_input" }
  | { ok: false; error: "save_failed" };

/**
 * Persist a booking request for the signed-in customer.
 *
 * Returns `not_authenticated` when signed out (the caller routes to login),
 * `invalid_input` when there is no real artist to address or no description,
 * and `save_failed` on any database error — so the wizard can render a calm
 * inline error rather than a false "request sent".
 */
export async function createBookingRequest(
  input: CreateBookingRequestInput,
): Promise<CreateBookingRequestResult> {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) return { ok: false, error: "not_authenticated" };

  const artistId = input.artistId?.trim();
  const description = input.description?.trim();
  if (!artistId || !UUID_RE.test(artistId) || !description) {
    return { ok: false, error: "invalid_input" };
  }

  // Only forward a service_id that is a real uuid; a set-piece from a bundled
  // demo artist would carry a slug id that violates the services FK.
  const serviceId =
    input.serviceId && UUID_RE.test(input.serviceId) ? input.serviceId : null;

  const { data, error } = await supabase
    .from("booking_requests")
    .insert({
      customer_id: userId,
      artist_id: artistId,
      service_id: serviceId,
      placement: input.placement?.trim() || null,
      size_desc: input.sizeDesc?.trim() || null,
      description,
      reference_image_urls: [],
      preferred_dates: input.preferredDates ?? [],
      budget_pence:
        input.budgetPence != null && input.budgetPence > 0
          ? input.budgetPence
          : null,
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("[booking-requests] insert failed:", error);
    return { ok: false, error: "save_failed" };
  }

  return { ok: true, requestId: (data as { id: string }).id };
}
