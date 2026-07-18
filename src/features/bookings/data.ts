/**
 * Read layer for the customer "Bookings" tab — the native mirror of
 * apps/web/lib/data/bookings.ts getCustomerBookings + lib/data/quotes.ts
 * listCustomerQuotes.
 *
 * Everything is an RLS-safe read on the signed-in customer's own rows via the
 * anon Supabase client:
 *   - appointments        (appointments_customer_read)
 *   - booking_requests    (booking_requests_customer_read)
 *   - payment_plans       (payment_plans_customer_read, embedded)
 *   - plan_instalments    (plan_instalments_participant_read, embedded)
 *   - payments            (payments_payer_read, embedded)
 *   - quotes              (quotes_customer_read)
 * Embedded artists/services join through their public-read policies.
 *
 * NEVER a service-role op. Quote accept/decline and deposit checkout are
 * server-action-only on the web and are surfaced here as read-only cards with
 * an honest "respond on the web for now" note.
 *
 * All money is integer pence. Returns null on signed-out / hard error so the
 * screen can fall back to a signed-out or empty state.
 */

import { supabase } from "../../lib/supabase";

/* ── Public view-model types ─────────────────────────────────────────── */

export type AppointmentStatus =
  | "requested"
  | "confirmed"
  | "deposit_paid"
  | "in_plan"
  | "completed"
  | "cancelled"
  | "no_show";

export type RequestStatus =
  | "pending"
  | "reviewing"
  | "accepted"
  | "declined"
  | "expired"
  | "withdrawn";

export type QuoteStatus =
  | "sent"
  | "accepted"
  | "declined"
  | "withdrawn"
  | "expired";

/** The layaway pot attached to an in-plan booking. */
export interface BookingPlan {
  totalPence: number;
  paidPence: number;
  nextDueIso: string | null;
  nextAmountPence: number | null;
  instalmentsPaid: number;
  instalmentsTotal: number;
}

export interface CustomerBooking {
  id: string;
  artistName: string;
  artistHandle: string;
  piece: string;
  startsAtIso: string | null;
  status: AppointmentStatus;
  pricePence: number;
  depositPence: number;
  depositPaid: boolean;
  awaitingDeposit: boolean;
  plan: BookingPlan | null;
}

export interface CustomerRequest {
  id: string;
  artistName: string;
  artistHandle: string;
  piece: string;
  createdIso: string;
  status: RequestStatus;
}

export interface CustomerQuote {
  id: string;
  artistName: string;
  artistHandle: string;
  title: string;
  description: string | null;
  pricePence: number;
  depositPence: number;
  sessionsCount: number | null;
  expiresAt: string | null;
  status: QuoteStatus;
}

export interface CustomerBookings {
  quotes: CustomerQuote[];
  upcoming: CustomerBooking[];
  inPlan: CustomerBooking[];
  requests: CustomerRequest[];
  past: CustomerBooking[];
}

/* ── Database rows ───────────────────────────────────────────────────── */

interface ArtistRef {
  handle: string;
  display_name: string;
}

interface ServiceRef {
  name: string;
}

interface PaymentRef {
  status: string | null;
}

interface InstalmentRef {
  amount_pence: number | null;
  due_date: string | null;
  status: string | null;
}

interface PlanRef {
  total_pence: number | null;
  paid_pence: number | null;
  plan_instalments: InstalmentRef[] | null;
}

// Supabase infers embedded relations as arrays regardless of cardinality, so
// each embed is typed as "array | object | null" and normalised below.
type Embed<T> = T[] | T | null;

interface AppointmentRow {
  id: string;
  starts_at: string | null;
  status: AppointmentStatus;
  price_pence: number | null;
  deposit_pence: number | null;
  artists: Embed<ArtistRef>;
  services: Embed<ServiceRef>;
  payments: PaymentRef[] | null;
  payment_plans: PlanRef[] | null;
}

interface RequestRow {
  id: string;
  status: RequestStatus;
  created_at: string;
  description: string | null;
  artists: Embed<ArtistRef>;
}

interface QuoteRow {
  id: string;
  title: string;
  description: string | null;
  price_pence: number;
  deposit_pence: number;
  sessions_count: number | null;
  expires_at: string | null;
  status: QuoteStatus;
  artists: Embed<ArtistRef>;
}

/** Normalise an embedded relation (array or object) to a single row or null. */
function firstOf<T>(embed: Embed<T>): T | null {
  if (embed == null) return null;
  return Array.isArray(embed) ? (embed[0] ?? null) : embed;
}

function mapPlan(row: AppointmentRow): BookingPlan | null {
  const plan = (row.payment_plans ?? [])[0];
  if (!plan) return null;
  const totalPence = plan.total_pence ?? 0;
  const paidPence = plan.paid_pence ?? 0;
  const instalments = plan.plan_instalments ?? [];
  const outstanding = instalments
    .filter((i) => i.status !== "paid" && i.due_date != null)
    .sort((a, b) => (a.due_date! < b.due_date! ? -1 : 1));
  const next = outstanding[0] ?? null;
  const paidCount = instalments.filter((i) => i.status === "paid").length;
  return {
    totalPence,
    paidPence,
    nextDueIso: next?.due_date ?? null,
    nextAmountPence: next?.amount_pence ?? null,
    instalmentsPaid: paidCount,
    instalmentsTotal: instalments.length,
  };
}

function mapBooking(row: AppointmentRow): CustomerBooking {
  const depositPence = row.deposit_pence ?? 0;
  const artist = firstOf(row.artists);
  const service = firstOf(row.services);

  // "Paid" means a payment actually settled, or the appointment reached a
  // status only attainable after money cleared. A 'confirmed' booking is
  // accepted but NOT yet paid — the deposit is still owed.
  const paymentSettled = (row.payments ?? []).some((p) => p.status === "succeeded");
  const depositPaid =
    paymentSettled ||
    row.status === "deposit_paid" ||
    row.status === "in_plan" ||
    row.status === "completed";
  const awaitingDeposit =
    row.status === "confirmed" && depositPence > 0 && !depositPaid;

  return {
    id: row.id,
    artistName: artist?.display_name ?? "Your artist",
    artistHandle: artist?.handle ?? "",
    piece: service?.name ?? "Custom piece",
    startsAtIso: row.starts_at,
    status: row.status,
    pricePence: row.price_pence ?? 0,
    depositPence,
    depositPaid,
    awaitingDeposit,
    plan: mapPlan(row),
  };
}

/** True when a quote carries an expiry that is now in the past. */
function isQuoteExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return false;
  const t = new Date(expiresAt).getTime();
  return Number.isFinite(t) && t <= Date.now();
}

/**
 * Load and bucket the signed-in customer's bookings, quotes and requests.
 * Returns null when signed out or when the appointments read fails hard, so the
 * screen can distinguish "no session" / "error" from "no bookings".
 */
export async function getCustomerBookings(): Promise<CustomerBookings | null> {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) return null;

  const [
    { data: apptData, error: apptError },
    { data: reqData },
    { data: quoteData },
  ] = await Promise.all([
    supabase
      .from("appointments")
      .select(
        `
          id,
          starts_at,
          status,
          price_pence,
          deposit_pence,
          artists ( handle, display_name ),
          services ( name ),
          payments ( status ),
          payment_plans (
            total_pence,
            paid_pence,
            plan_instalments ( amount_pence, due_date, status )
          )
        `,
      )
      .eq("customer_id", userId)
      .order("starts_at", { ascending: true }),
    supabase
      .from("booking_requests")
      .select(
        `
          id,
          status,
          created_at,
          description,
          artists ( handle, display_name )
        `,
      )
      .eq("customer_id", userId)
      .order("created_at", { ascending: false }),
    supabase
      .from("quotes")
      .select(
        `
          id,
          title,
          description,
          price_pence,
          deposit_pence,
          sessions_count,
          expires_at,
          status,
          artists ( handle, display_name )
        `,
      )
      .eq("customer_id", userId)
      .order("created_at", { ascending: false }),
  ]);

  if (apptError || !apptData) return null;

  const bookings = (apptData as unknown as AppointmentRow[]).map(mapBooking);

  // Upcoming = every live booking, dated or not. Undated ones render without a
  // time and sort to the end.
  const upcoming = bookings
    .filter((b) => b.status === "confirmed" || b.status === "deposit_paid")
    .sort((a, b) => {
      if (a.startsAtIso && b.startsAtIso) {
        return a.startsAtIso < b.startsAtIso ? -1 : 1;
      }
      if (a.startsAtIso) return -1;
      if (b.startsAtIso) return 1;
      return 0;
    });
  const inPlan = bookings.filter((b) => b.status === "in_plan");
  const past = bookings.filter((b) => b.status === "completed");

  const requests = ((reqData as unknown as RequestRow[] | null) ?? [])
    .filter(
      (r) =>
        r.status === "pending" ||
        r.status === "reviewing" ||
        r.status === "accepted",
    )
    .map((r) => {
      const artist = firstOf(r.artists);
      return {
        id: r.id,
        artistName: artist?.display_name ?? "Your artist",
        artistHandle: artist?.handle ?? "",
        piece: r.description ?? "Custom piece",
        createdIso: r.created_at,
        status: r.status,
      };
    });

  // Only live quotes belong on the tab: still 'sent' and not past their hold.
  const quotes = ((quoteData as unknown as QuoteRow[] | null) ?? [])
    .filter((q) => q.status === "sent" && !isQuoteExpired(q.expires_at))
    .map((q) => {
      const artist = firstOf(q.artists);
      return {
        id: q.id,
        artistName: artist?.display_name ?? "Your artist",
        artistHandle: artist?.handle ?? "",
        title: q.title,
        description: q.description,
        pricePence: q.price_pence,
        depositPence: q.deposit_pence,
        sessionsCount: q.sessions_count,
        expiresAt: q.expires_at,
        status: q.status,
      };
    });

  return { quotes, upcoming, inPlan, requests, past };
}
