/**
 * Device-calendar import — onboarding pillar #3 ("bring your existing life").
 *
 * Reads the phone's own calendar (which already aggregates the artist's Google
 * / Apple / Outlook calendars, so no per-provider OAuth is needed) and lands
 * each upcoming event as a busy block in `availability_blocks`. Blocks are free
 * of charge and invisible to customers as content — they simply mark the artist
 * busy; commission only ever applies to bookings made THROUGH InkSpred.
 *
 * Idempotency: each imported row's `reason` is `ical:{eventId}::{title}` — the
 * stable device event id makes re-syncs skip what's already imported, and the
 * title tail lets the Availability screen label the block. Manual blocks (no
 * `ical:` prefix) are never touched by a re-sync or bulk clear.
 */
import * as Calendar from "expo-calendar";
import { supabase } from "../../lib/supabase";
import { getArtistContext } from "../artist/data";

/** How far ahead an import reaches. */
const IMPORT_WINDOW_DAYS = 120;

const REASON_PREFIX = "ical:";

export interface ImportedBlock {
  id: string;
  startsAtIso: string;
  endsAtIso: string;
  /** Event title parsed from the reason tail (may be empty). */
  title: string;
}

export type ImportResult =
  | { ok: true; imported: number; skipped: number }
  | { ok: false; error: "permission" | "no_artist" | "failed" };

function parseTitle(reason: string | null): string {
  if (!reason || !reason.startsWith(REASON_PREFIX)) return "";
  const sep = reason.indexOf("::");
  return sep === -1 ? "" : reason.slice(sep + 2);
}

/** Upcoming imported busy blocks for the signed-in artist, soonest first. */
export async function listImportedBlocks(): Promise<ImportedBlock[]> {
  const ctx = await getArtistContext();
  if (!ctx) return [];
  const { data } = await supabase
    .from("availability_blocks")
    .select("id, starts_at, ends_at, reason")
    .eq("artist_id", ctx.artistId)
    .like("reason", `${REASON_PREFIX}%`)
    .gte("ends_at", new Date().toISOString())
    .order("starts_at", { ascending: true })
    .limit(50);
  return ((data as
    | { id: string; starts_at: string; ends_at: string; reason: string | null }[]
    | null) ?? []).map((r) => ({
    id: r.id,
    startsAtIso: r.starts_at,
    endsAtIso: r.ends_at,
    title: parseTitle(r.reason),
  }));
}

/** Remove one imported block (the artist un-marking a busy time). */
export async function removeImportedBlock(id: string): Promise<boolean> {
  const { error } = await supabase
    .from("availability_blocks")
    .delete()
    .eq("id", id);
  return !error;
}

/**
 * Import (or re-sync) the device calendar into busy blocks. Asks for calendar
 * permission if needed; reads every event-capable calendar for the next
 * {@link IMPORT_WINDOW_DAYS} days; inserts what isn't already imported.
 */
export async function importDeviceCalendar(): Promise<ImportResult> {
  const ctx = await getArtistContext();
  if (!ctx) return { ok: false, error: "no_artist" };

  const perm = await Calendar.requestCalendarPermissionsAsync();
  if (perm.status !== "granted") return { ok: false, error: "permission" };

  try {
    const calendars = await Calendar.getCalendarsAsync(
      Calendar.EntityTypes.EVENT,
    );
    if (calendars.length === 0) return { ok: true, imported: 0, skipped: 0 };

    const start = new Date();
    const end = new Date(start.getTime() + IMPORT_WINDOW_DAYS * 86_400_000);
    const events = await Calendar.getEventsAsync(
      calendars.map((c) => c.id),
      start,
      end,
    );

    // What's already imported (match on the stable event id in `reason`).
    const { data: existing } = await supabase
      .from("availability_blocks")
      .select("reason")
      .eq("artist_id", ctx.artistId)
      .like("reason", `${REASON_PREFIX}%`);
    const seen = new Set(
      ((existing as { reason: string | null }[] | null) ?? [])
        .map((r) => r.reason?.split("::")[0] ?? "")
        .filter(Boolean),
    );

    const rows: {
      artist_id: string;
      starts_at: string;
      ends_at: string;
      reason: string;
    }[] = [];
    let skipped = 0;

    for (const ev of events) {
      const key = `${REASON_PREFIX}${ev.id}`;
      if (seen.has(key)) {
        skipped += 1;
        continue;
      }
      seen.add(key); // recurring events repeat the id — first occurrence wins v1

      let startsAt = new Date(ev.startDate as unknown as string | number | Date);
      let endsAt = new Date(ev.endDate as unknown as string | number | Date);
      if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()))
        continue;
      if (ev.allDay) {
        startsAt = new Date(startsAt);
        startsAt.setHours(0, 0, 0, 0);
        endsAt = new Date(startsAt);
        endsAt.setHours(23, 59, 0, 0);
      }
      if (endsAt <= startsAt) continue;

      const title = (ev.title ?? "").slice(0, 80);
      rows.push({
        artist_id: ctx.artistId,
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        reason: `${key}::${title}`,
      });
    }

    if (rows.length > 0) {
      const { error } = await supabase.from("availability_blocks").insert(rows);
      if (error) return { ok: false, error: "failed" };
    }
    return { ok: true, imported: rows.length, skipped };
  } catch {
    return { ok: false, error: "failed" };
  }
}
