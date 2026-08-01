/**
 * Artist Clients tab — the real client book, derived entirely from data the
 * artist already owns under RLS:
 *
 *   - appointments (artist-scoped read) → who has booked, how often, when last
 *     and when next;
 *   - threads (participant read) → tap-through from a client row straight into
 *     the existing conversation;
 *   - users (RLS-limited) → best-effort display names via
 *     {@link resolveCustomerNames}, neutral fallback for the rest.
 *
 * No new tables, no service role — this is a pure read-model over the booking
 * history. Returns null when signed out / not an artist so the screen can show
 * its set-up prompt, and an empty list on soft errors rather than throwing.
 */
import { supabase } from "../../lib/supabase";
import { getArtistContext, resolveCustomerNames } from "../artist/data";

export interface ClientRow {
  /** users.id of the customer. */
  customerId: string;
  /** Display name, or a neutral fallback when RLS hides the user row. */
  name: string;
  /** Completed / booked sessions with this artist (any non-cancelled status). */
  sessions: number;
  /** ISO of their next upcoming session, if one is booked. */
  nextIso: string | null;
  /** ISO of their most recent past session, if any. */
  lastIso: string | null;
  /** Existing message-thread id with this client, for tap-through. */
  threadId: string | null;
}

export interface ClientsView {
  clients: ClientRow[];
  /** The artist's public handle — powers the invite share link. */
  handle: string | null;
}

interface ApptRow {
  customer_id: string;
  starts_at: string | null;
  status: string;
}

interface ThreadRow {
  id: string;
  customer_id: string;
}

/** Statuses that count as a real client relationship (not declined/cancelled). */
const CLIENT_STATUSES = new Set([
  "confirmed",
  "deposit_paid",
  "completed",
]);

export async function listArtistClients(): Promise<ClientsView | null> {
  const ctx = await getArtistContext();
  if (!ctx) return null;

  const [apptRes, threadRes, artistRes] = await Promise.all([
    supabase
      .from("appointments")
      .select("customer_id, starts_at, status")
      .eq("artist_id", ctx.artistId)
      .order("starts_at", { ascending: false, nullsFirst: false })
      .limit(500),
    supabase.from("threads").select("id, customer_id").limit(200),
    supabase
      .from("artists")
      .select("handle")
      .eq("id", ctx.artistId)
      .maybeSingle(),
  ]);

  const handle =
    (artistRes.data as { handle?: string } | null)?.handle ?? null;

  const appts = ((apptRes.data as ApptRow[] | null) ?? []).filter((a) =>
    CLIENT_STATUSES.has(a.status),
  );

  const threadByCustomer = new Map<string, string>();
  for (const t of (threadRes.data as ThreadRow[] | null) ?? []) {
    if (!threadByCustomer.has(t.customer_id))
      threadByCustomer.set(t.customer_id, t.id);
  }

  // Group appointments per customer.
  const nowIso = new Date().toISOString();
  const grouped = new Map<
    string,
    { sessions: number; nextIso: string | null; lastIso: string | null }
  >();
  for (const a of appts) {
    const g =
      grouped.get(a.customer_id) ??
      ({ sessions: 0, nextIso: null, lastIso: null } as {
        sessions: number;
        nextIso: string | null;
        lastIso: string | null;
      });
    g.sessions += 1;
    if (a.starts_at) {
      if (a.starts_at >= nowIso) {
        if (!g.nextIso || a.starts_at < g.nextIso) g.nextIso = a.starts_at;
      } else if (!g.lastIso || a.starts_at > g.lastIso) {
        g.lastIso = a.starts_at;
      }
    }
    grouped.set(a.customer_id, g);
  }

  const names = await resolveCustomerNames(Array.from(grouped.keys()));

  const clients: ClientRow[] = Array.from(grouped.entries()).map(
    ([customerId, g]) => ({
      customerId,
      name: names.get(customerId) ?? "Client",
      sessions: g.sessions,
      nextIso: g.nextIso,
      lastIso: g.lastIso,
      threadId: threadByCustomer.get(customerId) ?? null,
    }),
  );

  // Upcoming sessions first (soonest at the top), then most recently seen.
  clients.sort((a, b) => {
    if (a.nextIso && b.nextIso) return a.nextIso.localeCompare(b.nextIso);
    if (a.nextIso) return -1;
    if (b.nextIso) return 1;
    return (b.lastIso ?? "").localeCompare(a.lastIso ?? "");
  });

  return { clients, handle };
}
