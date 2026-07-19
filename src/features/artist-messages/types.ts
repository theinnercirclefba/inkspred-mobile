/**
 * Artist-side messaging view-model types.
 *
 * The artist app talks to the SAME threads/messages/quotes rows the customer
 * app does — so the message, quote and other-party shapes are shared with
 * src/features/messages/types. This module re-exports those and adds the
 * artist-only pieces: a thread view that carries the thread's artist_id and
 * customer_id (the composer needs both to insert a quote under the
 * quotes_artist_manage RLS policy) and the createQuote input shape.
 *
 * Money is always integer PENCE (GBP); formatting lives in src/lib/money.ts.
 */

export type {
  QuoteStatus,
  QuoteView,
  OtherParty,
  ThreadMessage,
  ThreadSummary,
  SendResult,
} from "../messages/types";

import type { OtherParty, QuoteView, ThreadMessage } from "../messages/types";

/** A full conversation as the ARTIST sees it. */
export interface ArtistThreadView {
  id: string;
  /** The client the artist is talking to (name falls back to "Client"). */
  other: OtherParty;
  /** The thread's artist_id — this signed-in artist. Anchors a new quote. */
  artistId: string;
  /** The thread's customer_id — the quote's recipient. */
  customerId: string;
  messages: ThreadMessage[];
  /** Quotes referenced by messages in this thread, keyed by quote id. */
  quotesById: Record<string, QuoteView>;
}

/**
 * Input for {@link createQuote}. Mirrors the web CreateQuoteInput plus the two
 * ids the native client resolves from the thread rather than a server session.
 * Money is integer pence.
 */
export interface CreateQuoteInput {
  /** The thread the quote message lands in. */
  threadId: string;
  /** The signed-in artist (thread.artist_id). */
  artistId: string;
  /** The recipient (thread.customer_id). */
  customerId: string;
  title: string;
  description?: string;
  pricePence: number;
  depositPence: number;
  sessionsCount?: number;
  /** ISO timestamp after which the quote can no longer be accepted. */
  expiresAt?: string;
  /** ISO timestamp of the intended session start (must be in the future). */
  proposedStartsAtIso?: string;
  /** Session length in minutes (15..1440). */
  proposedDurationMin?: number;
}

/** Result of {@link createQuote}. */
export interface CreateQuoteResult {
  ok: boolean;
  /** The persisted quote, for optimistic render of its card. */
  quote?: QuoteView;
  /** The thread message carrying the quote_id, for optimistic append. */
  message?: ThreadMessage;
  error?: string;
}
