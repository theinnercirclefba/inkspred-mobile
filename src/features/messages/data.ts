/**
 * Customer⇄artist messaging — native data access.
 *
 * The native mirror of apps/web/lib/data/messages.ts, adapted for the anon
 * Supabase client + the signed-in AsyncStorage session. RLS does the enforcing
 * (threads_participant_read, messages_participant_read/insert/update,
 * quotes_customer_read), so no privileged access is needed — a customer only
 * ever sees their own threads, messages and quotes.
 *
 * Everything degrades SOFTLY: a denial or transport error returns an empty
 * result rather than throwing, so a screen renders a calm empty/error state
 * instead of crashing.
 *
 * Schema (0001_init.sql, +0004 attachments, +0015 quotes):
 *   threads(id, artist_id, customer_id, booking_request_id?, last_message_at)
 *   messages(id, thread_id, sender_id, body, attachments text[], quote_id?,
 *            read_at, created_at)
 *   The touch_thread trigger bumps threads.last_message_at on insert.
 *
 * Attachments are storage paths in the PRIVATE `references` bucket. Signing
 * those needs the service role, which the native client does not have, so the
 * UI renders an honest "photo — view on web" placeholder for this phase.
 */

import { supabase } from "../../lib/supabase";
import type {
  OtherParty,
  QuoteStatus,
  QuoteView,
  SendResult,
  ThreadMessage,
  ThreadSummary,
  ThreadView,
} from "./types";

interface ThreadRow {
  id: string;
  artist_id: string;
  customer_id: string;
  last_message_at: string;
}

interface MessageRow {
  id: string;
  thread_id: string;
  sender_id: string;
  body: string;
  attachments: string[] | null;
  quote_id: string | null;
  read_at: string | null;
  created_at: string;
}

/** Columns read for a message row, incl. the optional inline quote reference. */
const MESSAGE_SELECT =
  "id, thread_id, sender_id, body, attachments, quote_id, read_at, created_at";

interface QuoteRow {
  id: string;
  title: string;
  description: string | null;
  price_pence: number;
  deposit_pence: number;
  sessions_count: number | null;
  expires_at: string | null;
  status: string;
  created_at: string;
}

const QUOTE_STATUSES = new Set<QuoteStatus>([
  "sent",
  "accepted",
  "declined",
  "withdrawn",
  "expired",
]);

/* ── Labels ─────────────────────────────────────────────────────────── */

/** Time-of-day label ("09:41"), GB locale. */
export function timeLabel(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

/** Day bucket for dividers, e.g. "Today", "Yesterday" or "3 July". */
export function dayLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const startOf = (x: Date) =>
    new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((startOf(now) - startOf(d)) / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(d);
}

/** Relative list-row label, e.g. "9m", "2h", "Yesterday", "3 Jul". */
function relativeLabel(iso: string): string {
  const then = new Date(iso).getTime();
  const mins = Math.round((Date.now() - then) / 60_000);
  if (mins < 1) return "Now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.round(hrs / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) {
    return new Intl.DateTimeFormat("en-GB", { weekday: "short" }).format(
      new Date(iso),
    );
  }
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
  }).format(new Date(iso));
}

/* ── Helpers ────────────────────────────────────────────────────────── */

async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

function mapMessage(m: MessageRow, viewerId: string): ThreadMessage {
  return {
    id: m.id,
    mine: m.sender_id === viewerId,
    body: m.body,
    attachmentPaths: m.attachments ?? [],
    quoteId: m.quote_id ?? null,
    timeLabel: timeLabel(m.created_at),
    dayLabel: dayLabel(m.created_at),
    createdAtIso: m.created_at,
  };
}

/**
 * Resolve the "other party" of each thread. In the customer app the viewer is
 * the customer, so the other party is the artist (public read of artists is
 * permitted). The artist-side branch is kept for symmetry but yields a soft
 * "Client" fallback here since customer rows aren't readable under RLS.
 */
async function resolveOtherParties(
  rows: ThreadRow[],
  viewerId: string,
): Promise<Map<string, OtherParty>> {
  const map = new Map<string, OtherParty>();

  const viewerIsCustomerOf = rows.filter((r) => r.customer_id === viewerId);
  const viewerIsArtistOf = rows.filter((r) => r.customer_id !== viewerId);

  if (viewerIsCustomerOf.length > 0) {
    const artistIds = Array.from(
      new Set(viewerIsCustomerOf.map((r) => r.artist_id)),
    );
    const { data } = await supabase
      .from("artists")
      .select("id, user_id, display_name, handle, avatar_path")
      .in("id", artistIds);
    const byId = new Map(
      (
        (data as {
          id: string;
          user_id: string;
          display_name: string;
          handle: string;
          avatar_path: string | null;
        }[]) ?? []
      ).map((a) => [a.id, a]),
    );
    for (const r of viewerIsCustomerOf) {
      const a = byId.get(r.artist_id);
      map.set(r.id, {
        name: a?.display_name ?? "Artist",
        subtitle: a?.handle ? `@${a.handle}` : "Tattoo artist",
        role: "artist",
        userId: a?.user_id ?? null,
        handle: a?.handle ?? null,
        avatarPath: a?.avatar_path ?? null,
      });
    }
  }

  for (const r of viewerIsArtistOf) {
    map.set(r.id, {
      name: "Client",
      subtitle: "Enquiry",
      role: "customer",
      userId: r.customer_id,
    });
  }

  return map;
}

/**
 * Resolve the quotes referenced by a thread's messages into view models, keyed
 * by id. quotes_customer_read lets the customer read their own quotes. Soft: a
 * denial or missing row yields an empty map and messages fall back to body.
 */
async function resolveThreadQuotes(
  quoteIds: string[],
): Promise<Record<string, QuoteView>> {
  const out: Record<string, QuoteView> = {};
  if (quoteIds.length === 0) return out;

  const { data } = await supabase
    .from("quotes")
    .select(
      "id, title, description, price_pence, deposit_pence, sessions_count, expires_at, status, created_at",
    )
    .in("id", quoteIds);

  for (const r of (data as QuoteRow[] | null) ?? []) {
    const status: QuoteStatus = QUOTE_STATUSES.has(r.status as QuoteStatus)
      ? (r.status as QuoteStatus)
      : "sent";
    out[r.id] = {
      id: r.id,
      title: r.title,
      description: r.description,
      pricePence: r.price_pence,
      depositPence: r.deposit_pence,
      sessionsCount: r.sessions_count,
      expiresAt: r.expires_at,
      status,
      createdAtIso: r.created_at,
    };
  }
  return out;
}

/* ── Public API ─────────────────────────────────────────────────────── */

/**
 * The signed-in user's threads, newest first, with the other party, a
 * last-message preview and an unread count. Empty array when signed out or on
 * error — the tab renders its own sign-in / empty / error state.
 */
export async function listThreads(): Promise<ThreadSummary[]> {
  const userId = await currentUserId();
  if (!userId) return [];

  const { data: rows, error } = await supabase
    .from("threads")
    .select("id, artist_id, customer_id, last_message_at")
    .order("last_message_at", { ascending: false });

  if (error || !rows || rows.length === 0) return [];

  const threadRows = rows as ThreadRow[];
  const others = await resolveOtherParties(threadRows, userId);

  const ids = threadRows.map((r) => r.id);
  const { data: msgs } = await supabase
    .from("messages")
    .select(MESSAGE_SELECT)
    .in("thread_id", ids)
    .order("created_at", { ascending: false });

  const lastByThread = new Map<string, MessageRow>();
  const unreadByThread = new Map<string, number>();
  for (const m of (msgs as MessageRow[]) ?? []) {
    if (!lastByThread.has(m.thread_id)) lastByThread.set(m.thread_id, m);
    if (m.sender_id !== userId && m.read_at == null) {
      unreadByThread.set(
        m.thread_id,
        (unreadByThread.get(m.thread_id) ?? 0) + 1,
      );
    }
  }

  return threadRows.map((r): ThreadSummary => {
    const other = others.get(r.id) ?? {
      name: "Conversation",
      subtitle: "",
      role: "artist" as const,
    };
    const last = lastByThread.get(r.id);
    const unread = unreadByThread.get(r.id) ?? 0;
    const preview = last
      ? last.quote_id
        ? "Sent a quote"
        : last.body.trim().length > 0
          ? last.body.trim()
          : "Sent a reference photo"
      : "New conversation";
    return {
      id: r.id,
      other,
      preview,
      timeLabel: relativeLabel(r.last_message_at),
      unreadCount: unread,
      awaitingReply: last ? last.sender_id !== userId : false,
    };
  });
}

/**
 * A single thread's conversation (participant-checked by RLS), messages ordered
 * oldest→newest with day/time labels, the other party and any inline quotes.
 * Returns null when signed out, not found, or not the caller's thread.
 */
export async function getThread(threadId: string): Promise<ThreadView | null> {
  const userId = await currentUserId();
  if (!userId) return null;

  const { data: row, error } = await supabase
    .from("threads")
    .select("id, artist_id, customer_id, last_message_at")
    .eq("id", threadId)
    .maybeSingle();

  if (error || !row) return null;
  const threadRow = row as ThreadRow;

  const others = await resolveOtherParties([threadRow], userId);
  const other: OtherParty = others.get(threadRow.id) ?? {
    name: "Conversation",
    subtitle: "",
    role: "artist",
  };

  const { data: msgs } = await supabase
    .from("messages")
    .select(MESSAGE_SELECT)
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true });

  const msgRows = (msgs as MessageRow[]) ?? [];
  const messages = msgRows.map((m) => mapMessage(m, userId));

  const quoteIds = Array.from(
    new Set(msgRows.map((m) => m.quote_id).filter((id): id is string => !!id)),
  );
  const quotesById = await resolveThreadQuotes(quoteIds);

  return {
    id: threadRow.id,
    other,
    viewerRole: threadRow.customer_id === userId ? "customer" : "artist",
    messages,
    quotesById,
  };
}

/**
 * Mark every incoming (not-mine) unread message in a thread as read. Best
 * effort — messages_participant_update permits it; failures are swallowed so an
 * unread badge simply lingers rather than surfacing an error.
 */
export async function markThreadRead(threadId: string): Promise<void> {
  const userId = await currentUserId();
  if (!userId) return;
  await supabase
    .from("messages")
    .update({ read_at: new Date().toISOString() })
    .eq("thread_id", threadId)
    .neq("sender_id", userId)
    .is("read_at", null);
}

/**
 * Send a message into a thread as the signed-in user. Requires a non-empty
 * body. Participant enforcement is by RLS (messages_participant_insert).
 * Returns the persisted message for optimistic reconcile; soft `{ ok:false }`
 * when signed out or on error.
 */
export async function sendMessage(
  threadId: string,
  body: string,
): Promise<SendResult> {
  const userId = await currentUserId();
  if (!userId) return { ok: false, error: "Sign in to send a message." };

  const trimmed = (body ?? "").trim();
  if (trimmed.length === 0) {
    return { ok: false, error: "Nothing to send." };
  }

  const { data, error } = await supabase
    .from("messages")
    .insert({
      thread_id: threadId,
      sender_id: userId,
      body: trimmed,
      attachments: [],
    })
    .select(MESSAGE_SELECT)
    .maybeSingle();

  if (error || !data) {
    return { ok: false, error: "Couldn't send — try again." };
  }

  return { ok: true, message: mapMessage(data as MessageRow, userId) };
}
