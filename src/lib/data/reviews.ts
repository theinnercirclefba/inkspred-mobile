/**
 * Reviews & external (Google) review connections — native reads/writes done
 * DIRECTLY against Supabase under RLS via the anon client. NEVER a service-role
 * op.
 *
 * Published in-app reviews are read as part of the artist profile
 * (getArtistByHandle in lib/data/artists.ts). This module carries the two
 * pieces that stand on their own:
 *
 *   - getExternalReviewConnection: the public SELECT on
 *     external_review_connections (rating, review_count, url, place_name for an
 *     owner_type+owner_id). Used for the "★ 4.9 · 127 on Google" badge on an
 *     artist profile (artist OR their shop) and on the studio Shop tab. The
 *     table is added by parallel web work, so any error — including the table
 *     not existing yet in this environment — degrades softly to null (no badge).
 *
 *   - submitReview: a customer leaving a review for their own COMPLETED
 *     appointment. The insert is gated by RLS (reviews_customer_insert:
 *     customer_id = auth.uid() AND the appointment belongs to them); we only
 *     ever surface the entry point for a completed booking.
 */

import { supabase } from "../supabase";

/* ── External (Google) review connections ────────────────────────────── */

export interface ExternalReviewConnection {
  ownerType: string;
  ownerId: string;
  rating: number | null;
  reviewCount: number | null;
  url: string | null;
  placeName: string | null;
}

interface ExternalReviewRow {
  owner_type: string;
  owner_id: string;
  rating: number | null;
  review_count: number | null;
  url: string | null;
  place_name: string | null;
}

/**
 * The best external (Google) review connection for any of the given owner ids,
 * honouring their order — pass the artist id first, then their shop id, and the
 * artist's own connection wins when both exist. Public read under RLS.
 *
 * Returns null on any error or when none is connected. The badge is additive:
 * its absence is the correct soft-failure, so callers render nothing.
 */
export async function getExternalReviewConnection(
  ownerIds: (string | null | undefined)[],
): Promise<ExternalReviewConnection | null> {
  const ids = ownerIds.filter((id): id is string => typeof id === "string" && id.length > 0);
  if (ids.length === 0) return null;

  const { data, error } = await supabase
    .from("external_review_connections")
    .select("owner_type, owner_id, rating, review_count, url, place_name")
    .in("owner_id", ids);

  if (error || !data) return null;

  const rows = data as unknown as ExternalReviewRow[];
  // Pick by the caller's priority order (artist before shop).
  for (const id of ids) {
    const hit = rows.find((r) => r.owner_id === id);
    if (hit) {
      return {
        ownerType: hit.owner_type,
        ownerId: hit.owner_id,
        rating: hit.rating,
        reviewCount: hit.review_count,
        url: hit.url,
        placeName: hit.place_name,
      };
    }
  }
  return null;
}

/**
 * The subset of the given appointment ids that already carry a review the
 * signed-in user can see. Reviews default to published, and reviews_public_read
 * (published review of a published artist) covers the customer's own just-left
 * review, so this is enough to drive the "Leave a review" ↔ "Reviewed" state on
 * the Bookings tab. Any error (incl. the table not existing yet) degrades to an
 * empty set — the entry point simply stays visible, never a false "Reviewed".
 */
export async function getReviewedAppointmentIds(
  appointmentIds: string[],
): Promise<Set<string>> {
  const ids = appointmentIds.filter((id) => typeof id === "string" && id.length > 0);
  if (ids.length === 0) return new Set();

  const { data, error } = await supabase
    .from("reviews")
    .select("appointment_id")
    .in("appointment_id", ids);

  if (error || !data) return new Set();
  return new Set((data as { appointment_id: string }[]).map((r) => r.appointment_id));
}

/* ── Leaving a review ────────────────────────────────────────────────── */

export type SubmitReviewError = "signed_out" | "invalid" | "already" | "failed";

export type SubmitReviewResult =
  | { ok: true }
  | { ok: false; error: SubmitReviewError };

/**
 * Insert a review for the signed-in customer's own completed appointment.
 * Rating is clamped to a whole 1–5; an empty body stores null. RLS enforces
 * ownership; the unique appointment constraint surfaces as an "already"
 * outcome so a double-submit reads as success to the caller.
 */
export async function submitReview(input: {
  appointmentId: string;
  artistId: string;
  rating: number;
  body: string;
}): Promise<SubmitReviewResult> {
  const rating = Math.round(input.rating);
  if (!(rating >= 1 && rating <= 5)) return { ok: false, error: "invalid" };

  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) return { ok: false, error: "signed_out" };

  const body = input.body.trim();
  const { error } = await supabase.from("reviews").insert({
    appointment_id: input.appointmentId,
    artist_id: input.artistId,
    customer_id: userId,
    rating,
    body: body.length > 0 ? body : null,
  });

  if (error) {
    // 23505 = a review already exists for this appointment — treat as done.
    if (error.code === "23505") return { ok: false, error: "already" };
    return { ok: false, error: "failed" };
  }
  return { ok: true };
}
