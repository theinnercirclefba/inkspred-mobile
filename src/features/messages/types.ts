/**
 * Messaging view-model types for the native customer app.
 *
 * These mirror the SHARED shapes the web app renders (apps/web/lib/data/
 * messages-mock.ts + components/quotes/types.ts) so a thread reads the same on
 * both surfaces — one message, two clients. Kept in a plain module so both the
 * data layer (data.ts) and the screen components can import them.
 *
 * Money is always integer PENCE (GBP); formatting lives in src/lib/money.ts.
 */

export type QuoteStatus =
  | "sent"
  | "accepted"
  | "declined"
  | "withdrawn"
  | "expired";

/** A quote as the read-only card renders it. Pence in, £ out. */
export interface QuoteView {
  id: string;
  title: string;
  description: string | null;
  /** Total price, integer pence. */
  pricePence: number;
  /** Deposit due to secure the booking, integer pence (0..price). */
  depositPence: number;
  /** Number of sessions the piece spans, when the artist set it. */
  sessionsCount: number | null;
  /** ISO timestamp the hold expires, or null for an open-ended quote. */
  expiresAt: string | null;
  status: QuoteStatus;
  /** ISO created timestamp — used only for ordering/labels. */
  createdAtIso?: string | null;
}

/** The party the viewer is talking TO (never the viewer themselves). */
export interface OtherParty {
  /** Display name of the other participant. */
  name: string;
  /** Small secondary line: an @handle for artists, "Enquiry" for customers. */
  subtitle: string;
  /** Which side the OTHER party is — drives copy, not permissions. */
  role: "artist" | "customer";
  /** The other participant's user id, when resolvable. */
  userId?: string | null;
  /** The artist's public handle, for deep-linking to their profile. */
  handle?: string | null;
  /** The artist's avatar storage path, for the thumbnail. */
  avatarPath?: string | null;
}

/** A row in the thread list. */
export interface ThreadSummary {
  id: string;
  other: OtherParty;
  /** Last-message preview (or a photo affordance). */
  preview: string;
  /** Relative time label, e.g. "9m", "Yesterday". */
  timeLabel: string;
  /** Count of incoming unread messages. */
  unreadCount: number;
  /** True when the last message came from the other party. */
  awaitingReply: boolean;
}

/** A single message inside a thread view. */
export interface ThreadMessage {
  id: string;
  /** Sent by the current viewer (right-aligned). */
  mine: boolean;
  body: string;
  /** Storage paths in the private `references` bucket (rendered as placeholders). */
  attachmentPaths: string[];
  /** Time-of-day label, e.g. "12:01". */
  timeLabel: string;
  /** Day bucket for dividers, e.g. "Today". */
  dayLabel: string;
  /** ISO created timestamp — drives ordering + optimistic reconcile. */
  createdAtIso: string;
  /** The quote this message carries, if any. Null for ordinary messages. */
  quoteId?: string | null;
}

/** A full conversation. */
export interface ThreadView {
  id: string;
  other: OtherParty;
  /** Which side the VIEWER is on. */
  viewerRole: "artist" | "customer";
  messages: ThreadMessage[];
  /** Quotes referenced by messages in this thread, keyed by quote id. */
  quotesById: Record<string, QuoteView>;
}

/** Result of a send. `message` is the persisted row for optimistic reconcile. */
export interface SendResult {
  ok: boolean;
  message?: ThreadMessage;
  error?: string;
}
