/**
 * Artist-side messaging — native data access.
 *
 * The artist mirror of src/features/messages/data.ts (which is written from the
 * customer's point of view). Same anon Supabase client, same AsyncStorage
 * session, same RLS doing the enforcing:
 *   - threads_participant_read / messages_participant_read+insert+update let the
 *     artist read and reply in their own threads,
 *   - quotes_artist_manage lets the artist INSERT a quote on a thread they own,
 *   - the touch_thread trigger bumps threads.last_message_at on insert,
 *   - the DB fires the customer's "quote_received" notification — we never write
 *     notifications here.
 *
 * The one asymmetry: a customer's public.users row is NOT readable by the artist
 * (users_select_own is self-only, 0001_init.sql), so the customer-name join
 * comes back empty and every client falls back to "Client". We still attempt it
 * so the day a participant-read policy is added, real names light up for free.
 *
 * Everything degrades SOFTLY: a denial or transport error returns an empty
 * result or a typed `{ ok:false }`, never a throw.
 */

import { supabase } from "../../lib/supabase";
import { dayLabel, timeLabel } from "../messages/data";
import type {
  CreateQuoteInput,
  CreateQuoteResult,
  ArtistThreadView,
  OtherParty,
  QuoteStatus,
  QuoteView,
  SendResult,
  ThreadMessage,
  ThreadSummary,
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

const QUOTE_SELECT =
  "id, title, description, price_pence, deposit_pence, sessions_count, expires_at, status, created_at";

const QUOTE_STATUSES = new Set<QuoteStatus>([
  "sent",
  "accepted",
  "declined",
  "withdrawn",
  "expired",
]);

/* ── Labels ─────────────────────────────────────────────────────────── */

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

/** "£450.00" — the calm GB money label used in the quote's fallback body. */
function moneyLabel(pence: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(pence / 100);
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

function mapQuote(r: QuoteRow): QuoteView {
  const status: QuoteStatus = QUOTE_STATUSES.has(r.status as QuoteStatus)
    ? (r.status as QuoteStatus)
    : "sent";
  return {
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

/**
 * Resolve the client each thread is with. The viewer is the artist, so the
 * other party is the customer. We attempt a users read for the real name;
 * under current RLS it returns nothing, so each row falls back to "Client".
 */
async function resolveClients(
  rows: ThreadRow[],
): Promise<Map<string, OtherParty>> {
  const map = new Map<string, OtherParty>();
  if (rows.length === 0) return map;

  const customerIds = Array.from(new Set(rows.map((r) => r.customer_id)));
  const { data } = await supabase
    .from("users")
    .select("id, full_name")
    .in("id", customerIds);

  const nameById = new Map(
    ((data as { id: string; full_name: string | null }[]) ?? []).map((u) => [
      u.id,
      u.full_name,
    ]),
  );

  for (const r of rows) {
    const name = nameById.get(r.customer_id);
    map.set(r.id, {
      name: name && name.trim().length > 0 ? name : "Client",
      subtitle: "Enquiry",
      role: "customer",
      userId: r.customer_id,
    });
  }
  return map;
}

/**
 * Resolve the quotes referenced by a thread's messages into view models, keyed
 * by id. quotes_artist_manage lets the artist read their own quotes. Soft: a
 * denial or missing row yields an empty map and messages fall back to body.
 */
async function resolveThreadQuotes(
  quoteIds: string[],
): Promise<Record<string, QuoteView>> {
  const out: Record<string, QuoteView> = {};
  if (quoteIds.length === 0) return out;

  const { data } = await supabase
    .from("quotes")
    .select(QUOTE_SELECT)
    .in("id", quoteIds);

  for (const r of (data as QuoteRow[] | null) ?? []) {
    out[r.id] = mapQuote(r);
  }
  return out;
}

/* ── Public API ─────────────────────────────────────────────────────── */

/**
 * The signed-in artist's threads, newest first, with the client, a last-message
 * preview and an incoming-unread count. Empty array when signed out or on error
 * — the tab renders its own sign-in / empty / error state.
 */
export async function listArtistThreads(): Promise<ThreadSummary[]> {
  const userId = await currentUserId();
  if (!userId) return [];

  const { data: rows, error } = await supabase
    .from("threads")
    .select("id, artist_id, customer_id, last_message_at")
    .order("last_message_at", { ascending: false });

  if (error || !rows || rows.length === 0) return [];

  const threadRows = rows as ThreadRow[];
  const clients = await resolveClients(threadRows);

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
    const other = clients.get(r.id) ?? {
      name: "Client",
      subtitle: "Enquiry",
      role: "customer" as const,
    };
    const last = lastByThread.get(r.id);
    const unread = unreadByThread.get(r.id) ?? 0;
    const preview = last
      ? last.quote_id
        ? "You sent a quote"
        : last.body.trim().length > 0
          ? last.body.trim()
          : "Reference photo"
      : "New enquiry";
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
 * oldest→newest with day/time labels, the client and any inline quotes, plus
 * the thread's artist_id + customer_id so the composer can anchor a new quote.
 * Returns null when signed out, not found, or not this artist's thread.
 */
export async function getArtistThread(
  threadId: string,
): Promise<ArtistThreadView | null> {
  const userId = await currentUserId();
  if (!userId) return null;

  const { data: row, error } = await supabase
    .from("threads")
    .select("id, artist_id, customer_id, last_message_at")
    .eq("id", threadId)
    .maybeSingle();

  if (error || !row) return null;
  const threadRow = row as ThreadRow;

  const clients = await resolveClients([threadRow]);
  const other: OtherParty = clients.get(threadRow.id) ?? {
    name: "Client",
    subtitle: "Enquiry",
    role: "customer",
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
    artistId: threadRow.artist_id,
    customerId: threadRow.customer_id,
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
 * Reply into a thread as the signed-in artist. Requires a non-empty body.
 * Participant enforcement is by RLS (messages_participant_insert). Returns the
 * persisted message for optimistic reconcile; soft `{ ok:false }` otherwise.
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

/**
 * Send a quote as the signed-in artist. Mirrors the web createQuote insert
 * shape exactly (lib/data/quotes.ts): it inserts the quote row (RLS
 * quotes_artist_manage authorises the owning artist) then posts a thread message
 * carrying its quote_id, with a short fallback body so a non-quote-aware client
 * still reads it. The customer's "quote_received" notification fires from a DB
 * trigger — we do NOT write it here.
 *
 * Validation is kept tight client-side (title, price, deposit ≤ price, positive
 * sessions, future session) but the real guard lives in the RLS/CHECK layer.
 * Returns the persisted quote + message for an optimistic append.
 */
export async function createQuote(
  input: CreateQuoteInput,
): Promise<CreateQuoteResult> {
  const userId = await currentUserId();
  if (!userId) return { ok: false, error: "Sign in to send a quote." };

  const title = (input.title ?? "").trim();
  const description = (input.description ?? "").trim();
  const pricePence = Math.round(input.pricePence);
  const depositPence = Math.round(input.depositPence);

  if (!input.threadId || !input.artistId || !input.customerId) {
    return { ok: false, error: "Couldn't send that quote — try again." };
  }
  if (title.length === 0) return { ok: false, error: "Add a title for the quote." };
  if (!Number.isFinite(pricePence) || pricePence <= 0) {
    return { ok: false, error: "Add a price." };
  }
  if (
    !Number.isFinite(depositPence) ||
    depositPence < 0 ||
    depositPence > pricePence
  ) {
    return { ok: false, error: "The deposit can't be more than the price." };
  }

  let sessionsCount: number | null = null;
  if (input.sessionsCount != null) {
    const s = Math.round(input.sessionsCount);
    if (Number.isFinite(s) && s > 0) sessionsCount = s;
  }

  let expiresAt: string | null = null;
  if (input.expiresAt) {
    const d = new Date(input.expiresAt);
    if (!Number.isNaN(d.getTime())) expiresAt = d.toISOString();
  }

  // Optional proposed session slot: a valid future start, duration 15..1440
  // (defaults to a 4-hour sitting when a start is set without one). A duration
  // with no start is meaningless and dropped, mirroring the web action.
  let proposedStartsAt: string | null = null;
  let proposedDurationMin: number | null = null;
  if (input.proposedStartsAtIso) {
    const d = new Date(input.proposedStartsAtIso);
    if (Number.isNaN(d.getTime())) {
      return { ok: false, error: "Pick a valid session date." };
    }
    if (d.getTime() <= Date.now()) {
      return { ok: false, error: "The session must be in the future." };
    }
    let minutes = 240;
    if (input.proposedDurationMin != null) {
      const m = Math.round(input.proposedDurationMin);
      if (Number.isFinite(m) && m >= 15 && m <= 1440) minutes = m;
    }
    proposedStartsAt = d.toISOString();
    proposedDurationMin = minutes;
  }

  const { data: inserted, error: insertError } = await supabase
    .from("quotes")
    .insert({
      artist_id: input.artistId,
      customer_id: input.customerId,
      booking_request_id: null,
      thread_id: input.threadId,
      title,
      description: description.length > 0 ? description : null,
      price_pence: pricePence,
      deposit_pence: depositPence,
      sessions_count: sessionsCount,
      expires_at: expiresAt,
      proposed_starts_at: proposedStartsAt,
      proposed_duration_min: proposedDurationMin,
      status: "sent",
    })
    .select(QUOTE_SELECT)
    .maybeSingle();

  if (insertError || !inserted) {
    return { ok: false, error: "Couldn't send that quote — try again." };
  }
  const quote = mapQuote(inserted as QuoteRow);

  // Post the quote into the conversation. Best-effort: the quote already exists.
  const { data: msgRow } = await supabase
    .from("messages")
    .insert({
      thread_id: input.threadId,
      sender_id: userId,
      body: `Sent a quote — ${moneyLabel(pricePence)}`,
      attachments: [],
      quote_id: quote.id,
    })
    .select(MESSAGE_SELECT)
    .maybeSingle();

  const message = msgRow ? mapMessage(msgRow as MessageRow, userId) : undefined;

  return { ok: true, quote, message };
}
