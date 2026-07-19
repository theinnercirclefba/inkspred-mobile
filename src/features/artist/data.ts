/**
 * Read layer for the ARTIST OS — the native mirror of
 * apps/web/lib/data/artist-dashboard.ts (getArtistDashboard + listArtistRequests).
 *
 * Every read is RLS-safe on the signed-in artist's own rows through the anon
 * Supabase client. `public.is_own_artist(artist_id)` scopes the artist tables,
 * so we resolve the caller's artist row once (artists.user_id = auth.uid) and
 * reuse its id for the appointment/request queries.
 *
 *   - booking_requests   (booking_requests_artist_read)
 *   - appointments       (appointments_artist_manage — `for all`, covers select)
 *   - payments           (payments_artist_read — payments against own appts)
 *   - threads / messages (threads_participant_read / messages_participant_read)
 *   - users              (best-effort customer names; RLS-limited → fallback)
 *
 * Everything degrades SOFTLY: a null artist when signed out or without an artist
 * row, empty lists / zero counts on any denial or error — never a throw. All
 * money is integer PENCE.
 */

import { supabase } from "../../lib/supabase";
import type { RequestStatus } from "../bookings/data";

/* ── Public view models ──────────────────────────────────────────────── */

/** The signed-in artist's identity, resolved from their auth session. */
export interface ArtistContext {
  /** artists.id — the address every artist-scoped RLS policy keys on. */
  artistId: string;
  /** auth.uid() — the messages sender id, used to exclude own messages. */
  userId: string;
}

/** One of today's sessions, pre-formatted for the schedule timeline. */
export interface DashboardAppointment {
  id: string;
  startsAtIso: string;
  /** "10:00" */
  startLabel: string;
  /** "3 h" — empty when the session has no end time yet. */
  durationLabel: string;
  client: string;
  piece: string;
  pricePence: number;
  depositPence: number;
  depositPaid: boolean;
}

/** The at-a-glance snapshot the Today screen reads from. */
export interface ArtistDashboard {
  pendingRequestCount: number;
  unreadMessageCount: number;
  todayAppointments: DashboardAppointment[];
  /** Sum of this week's succeeded payments; 0 before Stripe is live. */
  weekEarningsPence: number;
  /** Sum of this week's succeeded deposit payments (excludes plan instalments). */
  weekDepositsPence: number;
  /** Count of this week's succeeded deposit payments. */
  weekDepositsCount: number;
}

/** Deposit state of an accepted request's appointment. */
export type DepositState = "none" | "awaiting" | "paid";

/** A booking request addressed to the artist, for the Requests inbox. */
export interface ArtistRequest {
  id: string;
  customer: string;
  /** The enquiring customer's user id. */
  customerId: string;
  placement: string | null;
  sizeDesc: string | null;
  description: string;
  budgetPence: number | null;
  referenceCount: number;
  serviceName: string | null;
  serviceId: string | null;
  status: RequestStatus;
  /** Relative "2 h ago" / "Yesterday" / "3 Jul" label. */
  receivedLabel: string;
  depositState: DepositState;
  /** The appointment's deposit in pence (0 when there is no appointment). */
  depositPence: number;
  /** The accepted request's appointment id, needed to propose a session time. */
  appointmentId: string | null;
  sessionStartIso: string | null;
  sessionEndIso: string | null;
  /** Prefill for the duration picker, in minutes. */
  durationMin: number;
  /** "Fri 24 Jul · 11:00–15:00" once a time is proposed, else null. */
  sessionLabel: string | null;
}

/* ── Database rows ───────────────────────────────────────────────────── */

type Embed<T> = T[] | T | null;

interface ServiceRef {
  name: string;
  duration_min?: number | null;
}

interface AppointmentRow {
  id: string;
  starts_at: string | null;
  ends_at: string | null;
  status: string;
  price_pence: number | null;
  deposit_pence: number | null;
  customer_id: string;
  services: Embed<ServiceRef>;
}

interface RequestRow {
  id: string;
  placement: string | null;
  size_desc: string | null;
  description: string | null;
  budget_pence: number | null;
  reference_image_urls: string[] | null;
  status: RequestStatus;
  created_at: string;
  customer_id: string;
  service_id: string | null;
  services: Embed<ServiceRef>;
}

function firstOf<T>(embed: Embed<T>): T | null {
  if (embed == null) return null;
  return Array.isArray(embed) ? (embed[0] ?? null) : embed;
}

/* ── Formatting helpers ──────────────────────────────────────────────── */

function timeOfDay(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

/** "3 h", "1.5 h", or "" when either bound is missing. */
function durationLabel(startIso: string | null, endIso: string | null): string {
  if (!startIso || !endIso) return "";
  const mins = (Date.parse(endIso) - Date.parse(startIso)) / 60_000;
  if (!Number.isFinite(mins) || mins <= 0) return "";
  const hours = Math.round((mins / 60) * 10) / 10;
  return `${hours} h`;
}

/** "Fri 24 Jul · 11:00–15:00" (or just the start when there's no end). */
function sessionChipLabel(startIso: string, endIso: string | null): string {
  const dayPart = new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(startIso));
  const start = timeOfDay(startIso);
  return endIso
    ? `${dayPart} · ${start}–${timeOfDay(endIso)}`
    : `${dayPart} · ${start}`;
}

/** "2 h ago" / "Yesterday" / "3 Jul" from a stored timestamp. */
function receivedLabel(iso: string): string {
  const mins = Math.round((Date.now() - Date.parse(iso)) / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} h ago`;
  const days = Math.round(hrs / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
  }).format(new Date(iso));
}

/** Midnight (local) at the start of the given date. */
function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Monday 00:00 (local) of the week containing `d`. */
function startOfWeek(d: Date): Date {
  const s = startOfDay(d);
  const mondayOffset = (s.getDay() + 6) % 7; // Sun=0 → 6, Mon=1 → 0
  s.setDate(s.getDate() - mondayOffset);
  return s;
}

// Statuses excluded from "today's sessions" (matches the web dashboard).
const EXCLUDE_APPOINTMENT = new Set(["cancelled", "no_show"]);
const PAID_STATUS = new Set(["deposit_paid", "in_plan", "completed"]);

/* ── Artist context ──────────────────────────────────────────────────── */

/**
 * Resolve the signed-in artist's identity: their artists.id (for RLS-scoped
 * reads) and auth user id. Returns null when signed out or when the caller has
 * no artist row yet (they belong on onboarding, not the dashboard).
 */
export async function getArtistContext(): Promise<ArtistContext | null> {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) return null;

  const { data, error } = await supabase
    .from("artists")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) return null;
  return { artistId: (data as { id: string }).id, userId };
}

/* ── Customer name resolution ────────────────────────────────────────── */

/**
 * Best-effort display names for a set of customer ids. RLS keeps the artist
 * from reading arbitrary `users` rows, so this returns whatever is permitted
 * and callers fall back to a neutral label for the rest.
 */
async function resolveCustomerNames(ids: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const unique = Array.from(new Set(ids.filter(Boolean)));
  if (unique.length === 0) return map;

  const { data } = await supabase
    .from("users")
    .select("id, full_name")
    .in("id", unique);

  for (const row of (data as { id: string; full_name: string }[] | null) ?? []) {
    if (row.full_name) map.set(row.id, row.full_name);
  }
  return map;
}

/* ── getArtistDashboard ──────────────────────────────────────────────── */

const EMPTY_DASHBOARD: ArtistDashboard = {
  pendingRequestCount: 0,
  unreadMessageCount: 0,
  todayAppointments: [],
  weekEarningsPence: 0,
  weekDepositsPence: 0,
  weekDepositsCount: 0,
};

/**
 * The signed-in artist's snapshot — pending-request and unread-message counts,
 * today's real sessions and this week's earnings/deposits. Returns null when
 * signed out or without an artist row, so the screen can branch to a warm
 * empty/prompt state; {@link EMPTY_DASHBOARD} on a soft error.
 */
export async function getArtistDashboard(
  ctx: ArtistContext,
): Promise<ArtistDashboard> {
  const now = new Date();
  const dayStart = startOfDay(now);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);
  const weekStart = startOfWeek(now);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const [pendingRes, threadsRes, apptRes, payRes] = await Promise.all([
    supabase
      .from("booking_requests")
      .select("id", { count: "exact", head: true })
      .eq("artist_id", ctx.artistId)
      .eq("status", "pending"),
    supabase.from("threads").select("id").eq("artist_id", ctx.artistId),
    supabase
      .from("appointments")
      .select(
        "id, starts_at, ends_at, status, price_pence, deposit_pence, customer_id, services ( name )",
      )
      .eq("artist_id", ctx.artistId)
      .gte("starts_at", dayStart.toISOString())
      .lt("starts_at", dayEnd.toISOString())
      .order("starts_at", { ascending: true }),
    supabase
      .from("payments")
      .select("amount_pence, method, status, paid_at")
      .eq("status", "succeeded")
      .gte("paid_at", weekStart.toISOString())
      .lt("paid_at", weekEnd.toISOString()),
  ]);

  // Unread messages across the artist's threads (incoming + not yet read).
  const threadIds = ((threadsRes.data as { id: string }[] | null) ?? []).map(
    (t) => t.id,
  );
  let unreadMessageCount = 0;
  if (threadIds.length > 0) {
    const { count } = await supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .in("thread_id", threadIds)
      .is("read_at", null)
      .neq("sender_id", ctx.userId);
    unreadMessageCount = count ?? 0;
  }

  // Today's sessions, cancelled/no-show filtered out.
  const apptRows = ((apptRes.data as AppointmentRow[] | null) ?? []).filter(
    (r) => r.starts_at != null && !EXCLUDE_APPOINTMENT.has(r.status),
  );
  const names = await resolveCustomerNames(apptRows.map((r) => r.customer_id));
  const todayAppointments: DashboardAppointment[] = apptRows.map((r) => ({
    id: r.id,
    startsAtIso: r.starts_at as string,
    startLabel: timeOfDay(r.starts_at as string),
    durationLabel: durationLabel(r.starts_at, r.ends_at),
    client: names.get(r.customer_id) ?? "Client",
    piece: firstOf(r.services)?.name ?? "Custom piece",
    pricePence: r.price_pence ?? 0,
    depositPence: r.deposit_pence ?? 0,
    depositPaid: PAID_STATUS.has(r.status),
  }));

  // This week's succeeded payments. Deposits are everything that isn't a
  // layaway plan instalment — that split powers the "Deposits collected" stat.
  const paidRows =
    (payRes.data as
      | { amount_pence: number | null; method: string }[]
      | null) ?? [];
  const weekEarningsPence = paidRows.reduce(
    (sum, p) => sum + (p.amount_pence ?? 0),
    0,
  );
  const depositRows = paidRows.filter((p) => p.method !== "plan_instalment");
  const weekDepositsPence = depositRows.reduce(
    (sum, p) => sum + (p.amount_pence ?? 0),
    0,
  );

  return {
    pendingRequestCount: pendingRes.count ?? 0,
    unreadMessageCount,
    todayAppointments,
    weekEarningsPence,
    weekDepositsPence,
    weekDepositsCount: depositRows.length,
  };
}

/* ── listArtistRequests ──────────────────────────────────────────────── */

const INBOX_STATUSES: RequestStatus[] = [
  "pending",
  "reviewing",
  "accepted",
  "declined",
];

/**
 * The artist's booking-request inbox — every enquiry addressed to them still
 * live (pending / reviewing) or recently resolved (accepted / declined), newest
 * first. Empty array on any error.
 */
export async function listArtistRequests(
  ctx: ArtistContext,
): Promise<ArtistRequest[]> {
  const { data, error } = await supabase
    .from("booking_requests")
    .select(
      "id, placement, size_desc, description, budget_pence, reference_image_urls, status, created_at, customer_id, service_id, services ( name, duration_min )",
    )
    .eq("artist_id", ctx.artistId)
    .in("status", INBOX_STATUSES)
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  const rows = data as unknown as RequestRow[];
  const names = await resolveCustomerNames(rows.map((r) => r.customer_id));
  const appointments = await resolveAppointmentInfo(
    rows.filter((r) => r.status === "accepted").map((r) => r.id),
  );

  return rows.map((r) => {
    const appt = appointments.get(r.id);
    const serviceDuration = firstOf(r.services)?.duration_min ?? null;
    const durationMin =
      appt?.startIso && appt.endIso
        ? Math.max(
            15,
            Math.round(
              (Date.parse(appt.endIso) - Date.parse(appt.startIso)) / 60_000,
            ),
          )
        : serviceDuration && serviceDuration > 0
          ? serviceDuration
          : 60;
    return {
      id: r.id,
      customer: names.get(r.customer_id) ?? "New enquiry",
      customerId: r.customer_id,
      placement: r.placement,
      sizeDesc: r.size_desc,
      description: r.description ?? "",
      budgetPence: r.budget_pence,
      referenceCount: (r.reference_image_urls ?? []).length,
      serviceName: firstOf(r.services)?.name ?? null,
      serviceId: r.service_id,
      status: r.status,
      receivedLabel: receivedLabel(r.created_at),
      depositState: appt?.state ?? "none",
      depositPence: appt?.pence ?? 0,
      appointmentId: appt?.appointmentId ?? null,
      sessionStartIso: appt?.startIso ?? null,
      sessionEndIso: appt?.endIso ?? null,
      durationMin,
      sessionLabel: appt?.startIso
        ? sessionChipLabel(appt.startIso, appt.endIso)
        : null,
    };
  });
}

interface AppointmentInfo {
  appointmentId: string;
  state: "awaiting" | "paid";
  pence: number;
  startIso: string | null;
  endIso: string | null;
}

/**
 * For a set of accepted requests, the appointment behind each: its id, deposit
 * state and any already-proposed session times. A deposit is "paid" once a
 * succeeded payment lands OR the appointment advances past 'confirmed'.
 */
async function resolveAppointmentInfo(
  acceptedRequestIds: string[],
): Promise<Map<string, AppointmentInfo>> {
  const map = new Map<string, AppointmentInfo>();
  if (acceptedRequestIds.length === 0) return map;

  const { data: apptData } = await supabase
    .from("appointments")
    .select("id, booking_request_id, deposit_pence, status, starts_at, ends_at")
    .in("booking_request_id", acceptedRequestIds);
  const appts =
    (apptData as
      | {
          id: string;
          booking_request_id: string | null;
          deposit_pence: number | null;
          status: string;
          starts_at: string | null;
          ends_at: string | null;
        }[]
      | null) ?? [];
  if (appts.length === 0) return map;

  const paidAppointmentIds = new Set<string>();
  const { data: payData } = await supabase
    .from("payments")
    .select("appointment_id, status")
    .in(
      "appointment_id",
      appts.map((a) => a.id),
    )
    .eq("status", "succeeded");
  for (const p of (payData as { appointment_id: string }[] | null) ?? []) {
    paidAppointmentIds.add(p.appointment_id);
  }

  for (const a of appts) {
    if (!a.booking_request_id) continue;
    const paid = paidAppointmentIds.has(a.id) || PAID_STATUS.has(a.status);
    map.set(a.booking_request_id, {
      appointmentId: a.id,
      state: paid ? "paid" : "awaiting",
      pence: a.deposit_pence ?? 0,
      startIso: a.starts_at,
      endIso: a.ends_at,
    });
  }
  return map;
}
