/**
 * Booking-request write actions for the native artist inbox — the mirror of
 * apps/web/app/(dashboard)/dashboard/requests/actions.ts.
 *
 * The artist accepts or declines an enquiry addressed to them and proposes a
 * session time. Every write runs through the anon Supabase client under RLS:
 *
 *   - booking_requests_artist_update  scopes the status change to the OWNING
 *     artist, so we filter on id alone and let the database enforce ownership.
 *   - appointments_artist_manage (`for all` on is_own_artist) lets the owning
 *     artist INSERT the confirmed appointment and UPDATE its times.
 *
 * Accepting also materialises the priced session: it creates the appointment
 * (status 'confirmed', times null — a time proposal comes later) with
 * price/deposit derived from the request's service, mirroring web's
 * ensureAppointment maths EXACTLY (percent clamp included).
 *
 * Notifications are intentionally NOT written here: DB triggers fire them on
 * the underlying row changes. Every action soft-degrades to { ok:false } — it
 * never throws — so callers can revert an optimistic update honestly.
 */

import { supabase } from "../../lib/supabase";
import type { RequestStatus } from "../bookings/data";

export interface RequestActionResult {
  ok: boolean;
  /** False when signed out — the caller keeps its optimistic UI honest. */
  authenticated: boolean;
}

interface AcceptedRequestRow {
  id: string;
  artist_id: string;
  customer_id: string;
  service_id: string | null;
  budget_pence: number | null;
}

interface ServiceMoneyRow {
  price_from_pence: number;
  deposit_type: "fixed" | "percent";
  deposit_value: number;
}

/** Statuses the artist may set from the inbox. */
const ARTIST_SETTABLE: RequestStatus[] = ["reviewing", "accepted", "declined"];

async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

async function setStatus(
  id: string,
  status: RequestStatus,
): Promise<RequestActionResult> {
  const userId = await currentUserId();
  if (!userId) return { ok: false, authenticated: false };
  if (!ARTIST_SETTABLE.includes(status)) {
    return { ok: false, authenticated: true };
  }

  const { error } = await supabase
    .from("booking_requests")
    .update({ status })
    .eq("id", id);

  if (error) return { ok: false, authenticated: true };
  return { ok: true, authenticated: true };
}

/**
 * The deposit the customer owes for a service, in pence: the fixed pence value,
 * or the percentage of the quoted price rounded to the nearest penny. Clamped
 * to [0, price] so it never violates the appointments deposit_pence <=
 * price_pence check when a service is misconfigured.
 */
function depositForService(service: ServiceMoneyRow): number {
  const raw =
    service.deposit_type === "percent"
      ? Math.round((service.price_from_pence * service.deposit_value) / 100)
      : service.deposit_value;
  return Math.min(Math.max(0, raw), service.price_from_pence);
}

/**
 * Create the confirmed appointment for a freshly accepted request, unless one
 * already exists (accept is idempotent). Times stay null until the artist
 * proposes a slot. Best-effort: a failure here does not undo the acceptance.
 */
async function ensureAppointment(request: AcceptedRequestRow): Promise<void> {
  const { data: existing } = await supabase
    .from("appointments")
    .select("id")
    .eq("booking_request_id", request.id)
    .limit(1);
  if (existing && existing.length > 0) return;

  // Price/deposit come from the chosen service; without one we fall back to the
  // customer's stated budget as the price and take no deposit yet.
  let pricePence = Math.max(0, request.budget_pence ?? 0);
  let depositPence = 0;

  if (request.service_id) {
    const { data: svc } = await supabase
      .from("services")
      .select("price_from_pence, deposit_type, deposit_value")
      .eq("id", request.service_id)
      .maybeSingle();
    const service = svc as ServiceMoneyRow | null;
    if (service) {
      pricePence = service.price_from_pence;
      depositPence = depositForService(service);
    }
  }

  await supabase.from("appointments").insert({
    booking_request_id: request.id,
    artist_id: request.artist_id,
    customer_id: request.customer_id,
    service_id: request.service_id,
    status: "confirmed",
    price_pence: pricePence,
    deposit_pence: depositPence,
  });
}

/**
 * Accept a booking request — moves it to `accepted` AND materialises the priced
 * `confirmed` appointment (times null for now; deposit derived from the service).
 */
export async function acceptRequest(id: string): Promise<RequestActionResult> {
  const userId = await currentUserId();
  if (!userId) return { ok: false, authenticated: false };

  // RLS (booking_requests_artist_read) scopes this to the owning artist, so the
  // returned row's artist_id is guaranteed to be theirs.
  const { data, error } = await supabase
    .from("booking_requests")
    .select("id, artist_id, customer_id, service_id, budget_pence")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return { ok: false, authenticated: true };
  const request = data as AcceptedRequestRow;

  const { error: updateError } = await supabase
    .from("booking_requests")
    .update({ status: "accepted" })
    .eq("id", id);
  if (updateError) return { ok: false, authenticated: true };

  await ensureAppointment(request);
  return { ok: true, authenticated: true };
}

/** Decline a booking request — moves it to `declined`. */
export async function declineRequest(id: string): Promise<RequestActionResult> {
  return setStatus(id, "declined");
}

interface ProposeAppointmentRow {
  id: string;
  status: string;
}

/**
 * Propose (or re-propose) a session time for an accepted request's appointment.
 * Sets starts_at/ends_at (end = start + durationMin). Ownership is enforced by
 * RLS (appointments_artist_manage): the read only returns the artist's own row
 * and the update is scoped the same way, so a foreign appointmentId resolves to
 * nothing. Re-proposing is allowed while still 'confirmed' (pre-deposit); once
 * money has cleared the time is locked, so we refuse.
 */
export async function proposeSessionTime(
  appointmentId: string,
  startsAtIso: string,
  durationMin: number,
): Promise<RequestActionResult> {
  const userId = await currentUserId();
  if (!userId) return { ok: false, authenticated: false };

  const start = new Date(startsAtIso);
  if (Number.isNaN(start.getTime())) {
    return { ok: false, authenticated: true };
  }
  const minutes = Math.round(durationMin);
  if (!Number.isFinite(minutes) || minutes < 15 || minutes > 24 * 60) {
    return { ok: false, authenticated: true };
  }
  const end = new Date(start.getTime() + minutes * 60_000);

  const { data, error } = await supabase
    .from("appointments")
    .select("id, status")
    .eq("id", appointmentId)
    .maybeSingle();
  if (error || !data) return { ok: false, authenticated: true };
  const appt = data as ProposeAppointmentRow;

  // Only propose/re-propose before the deposit locks the slot in.
  if (appt.status !== "confirmed") {
    return { ok: false, authenticated: true };
  }

  const { error: updateError } = await supabase
    .from("appointments")
    .update({
      starts_at: start.toISOString(),
      ends_at: end.toISOString(),
    })
    .eq("id", appointmentId);
  if (updateError) return { ok: false, authenticated: true };

  return { ok: true, authenticated: true };
}
