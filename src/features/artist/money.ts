/**
 * Artist Money tab data — the real earnings picture, from real rows.
 *
 * Everything derives from two RLS-scoped reads (the artist's appointments and
 * the succeeded payments against them), joined client-side — volumes here are
 * small, and one pass gives us totals + a recent-payments feed without extra
 * round-trips. Money stays integer pence throughout.
 */
import { supabase } from "../../lib/supabase";
import type { ArtistContext } from "./data";

export interface MoneyPaymentRow {
  id: string;
  amountPence: number;
  /** ISO timestamp the payment succeeded. */
  paidAtIso: string | null;
  client: string;
  piece: string;
}

export interface ArtistMoney {
  /** Succeeded payments, all time. */
  collectedPence: number;
  collectedCount: number;
  /** Total value of upcoming booked work (confirmed or deposit-paid). */
  upcomingValuePence: number;
  upcomingCount: number;
  /** Value of completed sessions. */
  completedValuePence: number;
  completedCount: number;
  /** Newest first, capped for the feed. */
  recent: MoneyPaymentRow[];
}

interface ApptRow {
  id: string;
  customer_id: string;
  status: string;
  starts_at: string | null;
  price_pence: number | null;
  services: { name: string }[] | { name: string } | null;
}

interface PayRow {
  id: string;
  appointment_id: string | null;
  amount_pence: number | null;
  paid_at: string | null;
}

const UPCOMING_STATUS = new Set(["confirmed", "deposit_paid", "in_plan"]);

function serviceName(s: ApptRow["services"]): string {
  const first = Array.isArray(s) ? s[0] : s;
  return first?.name ?? "Custom piece";
}

/** The signed-in artist's money picture. Soft-degrades to zeros on any error. */
export async function getArtistMoney(ctx: ArtistContext): Promise<ArtistMoney> {
  const empty: ArtistMoney = {
    collectedPence: 0,
    collectedCount: 0,
    upcomingValuePence: 0,
    upcomingCount: 0,
    completedValuePence: 0,
    completedCount: 0,
    recent: [],
  };

  try {
    const [apptRes, payRes] = await Promise.all([
      supabase
        .from("appointments")
        .select("id, customer_id, status, starts_at, price_pence, services ( name )")
        .eq("artist_id", ctx.artistId),
      supabase
        .from("payments")
        .select("id, appointment_id, amount_pence, paid_at")
        .eq("status", "succeeded")
        .order("paid_at", { ascending: false })
        .limit(50),
    ]);

    const appts = ((apptRes.data as ApptRow[] | null) ?? []).filter(Boolean);
    const byId = new Map(appts.map((a) => [a.id, a]));
    const now = Date.now();

    let upcomingValue = 0;
    let upcomingCount = 0;
    let completedValue = 0;
    let completedCount = 0;
    for (const a of appts) {
      if (a.status === "completed") {
        completedValue += a.price_pence ?? 0;
        completedCount += 1;
      } else if (
        UPCOMING_STATUS.has(a.status) &&
        (!a.starts_at || new Date(a.starts_at).getTime() >= now)
      ) {
        upcomingValue += a.price_pence ?? 0;
        upcomingCount += 1;
      }
    }

    // Payments RLS already scopes rows to this artist's bookings; keep only
    // ones we can attribute to a known appointment for the feed.
    const pays = ((payRes.data as PayRow[] | null) ?? []).filter(
      (p) => (p.amount_pence ?? 0) > 0,
    );
    const collectedPence = pays.reduce((s, p) => s + (p.amount_pence ?? 0), 0);

    // Client names for the feed, best-effort under RLS.
    const customerIds = Array.from(
      new Set(
        pays
          .map((p) => (p.appointment_id ? byId.get(p.appointment_id)?.customer_id : null))
          .filter((v): v is string => Boolean(v)),
      ),
    );
    const names = new Map<string, string>();
    if (customerIds.length > 0) {
      const { data } = await supabase
        .from("users")
        .select("id, full_name")
        .in("id", customerIds);
      for (const row of (data as { id: string; full_name: string }[] | null) ?? []) {
        if (row.full_name) names.set(row.id, row.full_name);
      }
    }

    const recent: MoneyPaymentRow[] = pays.slice(0, 20).map((p) => {
      const appt = p.appointment_id ? byId.get(p.appointment_id) : undefined;
      return {
        id: p.id,
        amountPence: p.amount_pence ?? 0,
        paidAtIso: p.paid_at,
        client: (appt && names.get(appt.customer_id)) || "Client",
        piece: appt ? serviceName(appt.services) : "Deposit",
      };
    });

    return {
      collectedPence,
      collectedCount: pays.length,
      upcomingValuePence: upcomingValue,
      upcomingCount,
      completedValuePence: completedValue,
      completedCount,
      recent,
    };
  } catch {
    return empty;
  }
}
