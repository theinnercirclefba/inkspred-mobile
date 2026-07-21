/**
 * Content moderation — the app-side of the UGC safety spine (Apple Guideline
 * 1.2). Wires the native UI to the tables added in 0006_moderation.sql:
 *
 *   • content_reports — a signed-in user files a report (insert-only; the
 *     moderation queue is read only by the service role).
 *   • user_blocks     — a user's personal block list (they fully manage their
 *     own rows; RLS scopes everything to blocker = auth.uid()).
 *
 * These are thin, self-contained mutations; the screens call them via
 * {@link ./menu presentModerationMenu}. Block *filtering* (hiding a blocked
 * user's threads and profile) lives in the messages + discovery data layers,
 * which call {@link fetchBlockedUserIds}.
 */
import { supabase } from "../../lib/supabase";

/** The kinds of thing a report can point at (mirrors the DB check constraint). */
export type ReportTargetType =
  | "artist"
  | "studio"
  | "portfolio_item"
  | "message"
  | "user";

/** Fixed report reasons — stored as free text in content_reports.reason. */
export const REPORT_REASONS = [
  "Spam or scam",
  "Harassment or bullying",
  "Hate speech or symbols",
  "Nudity or sexual content",
  "Violence or threats",
  "Impersonation",
  "Something else",
] as const;

async function requireUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("Please sign in to continue.");
  return data.user.id;
}

/** File a moderation report against a piece of content or a user. */
export async function reportContent(input: {
  targetType: ReportTargetType;
  targetId: string;
  reason: string;
  details?: string;
}): Promise<void> {
  const reporterId = await requireUserId();
  const { error } = await supabase.from("content_reports").insert({
    reporter_user_id: reporterId,
    target_type: input.targetType,
    target_id: input.targetId,
    reason: input.reason,
    details: input.details ?? null,
  });
  if (error) throw error;
}

/** Block a user. Idempotent — re-blocking (unique-violation 23505) is a no-op. */
export async function blockUser(blockedUserId: string): Promise<void> {
  const blockerId = await requireUserId();
  const { error } = await supabase.from("user_blocks").insert({
    blocker_user_id: blockerId,
    blocked_user_id: blockedUserId,
  });
  if (error && error.code !== "23505") throw error;
}

/** Remove a user from the current user's block list. */
export async function unblockUser(blockedUserId: string): Promise<void> {
  const blockerId = await requireUserId();
  const { error } = await supabase
    .from("user_blocks")
    .delete()
    .eq("blocker_user_id", blockerId)
    .eq("blocked_user_id", blockedUserId);
  if (error) throw error;
}

/**
 * The set of user ids the signed-in user has blocked. Returns an empty set when
 * signed out or on any error, so callers can filter unconditionally and never
 * break a list because moderation state failed to load.
 */
export async function fetchBlockedUserIds(): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("user_blocks")
    .select("blocked_user_id");
  if (error || !data) return new Set();
  return new Set(data.map((r) => r.blocked_user_id as string));
}
