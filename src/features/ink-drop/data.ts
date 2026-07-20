/**
 * INK DROP data layer — native reads/writes against Supabase under RLS.
 *
 * An Ink Drop is an artist proactively publishing a discounted opening on a
 * quiet day ("fill-the-empty-chair"). Customers browse open drops near them and
 * CLAIM one, which books it at the drop price. This mirrors the web
 * apps/web/lib/data/ink-drops.ts contract, but native has no server layer, so
 * each operation runs directly on the anon client and leans on RLS + a single
 * DEFINER function for the one privileged step (claim):
 *
 *   - listOpenDrops  → PUBLIC SELECT (RLS: status='open' AND drop_date >= today)
 *   - publishDrop    → artist INSERT  (RLS: is_own_artist(artist_id))
 *   - listMyDrops    → artist SELECT  (RLS: is_own_artist(artist_id))
 *   - withdrawDrop   → artist UPDATE  (RLS: is_own_artist, open → withdrawn)
 *   - claimDrop      → RPC claim_ink_drop  (SECURITY DEFINER, migration 0020)
 *
 * Why claim is an RPC and not a table write: there is deliberately NO customer
 * UPDATE policy on ink_drops and NO customer INSERT policy on appointments (see
 * 0001_init.sql). A customer therefore cannot flip a drop to 'claimed' or mint
 * the confirmed appointment from the client. The claim is performed by the
 * DEFINER-safe action migration 0020 ships — a single race-safe conditional
 * UPDATE (open → claimed, first customer wins) that then creates the CONFIRMED
 * appointment (price = drop price, deposit derived like ensureAppointment),
 * links it back via appointment_id and notifies the artist. Native invokes that
 * exact action through supabase.rpc so the web and app claim logic stay one
 * implementation. The customer then pays the deposit via the existing rail.
 *
 * All money is integer PENCE. Reads degrade softly (empty list on denial/error)
 * so screens can render a calm state rather than crash.
 */

import { supabase } from "../../lib/supabase";
import { haversineMiles, type LatLng } from "../../lib/geo";
import { getArtistContext } from "../artist/data";

/* ── Types ───────────────────────────────────────────────────────────── */

export type SlotType = "full_day" | "half_day" | "hours";
export type DropStatus = "open" | "claimed" | "expired" | "withdrawn";

/** The publishing artist, as joined onto a drop for the customer list. */
export interface DropArtist {
  id: string;
  handle: string;
  displayName: string;
  city: string | null;
  avatarPath: string | null;
  lat: number | null;
  lng: number | null;
}

/** An open, future drop shown to customers in the Find → Ink Drops list. */
export interface OpenDrop {
  id: string;
  dropDate: string; // yyyy-mm-dd
  slotType: SlotType;
  hoursNote: string | null;
  normalPricePence: number | null;
  dropPricePence: number;
  note: string | null;
  artist: DropArtist;
  /** Miles from the viewer, when a location was supplied; else null. */
  distanceMiles: number | null;
}

/** One of the signed-in artist's own drops, for the manage list. */
export interface MyDrop {
  id: string;
  dropDate: string;
  slotType: SlotType;
  hoursNote: string | null;
  normalPricePence: number | null;
  dropPricePence: number;
  note: string | null;
  status: DropStatus;
  claimedAt: string | null;
}

export interface PublishDropInput {
  /** yyyy-mm-dd — must be today or later. */
  dropDate: string;
  slotType: SlotType;
  /** Free-text hours, e.g. "2–5pm" — only meaningful when slotType='hours'. */
  hoursNote?: string | null;
  /** The usual price for this slot, in pence (optional — powers "was £X"). */
  normalPricePence?: number | null;
  /** The discounted price, in pence — REQUIRED and > 0. */
  dropPricePence: number;
  note?: string | null;
}

export type PublishDropResult =
  | { ok: true; dropId: string }
  | { ok: false; error: "not_artist" }
  | { ok: false; error: "invalid_input" }
  | { ok: false; error: "save_failed" };

export type WithdrawDropResult =
  | { ok: true }
  | { ok: false; error: "not_artist" | "save_failed" };

/** Outcome of a claim attempt. `gone` = another customer won the race. */
export type ClaimDropResult =
  | {
      ok: true;
      appointmentId: string | null;
      /** The booked price (drop price) in pence. */
      pricePence: number;
      /** Deposit due on the confirmed appointment, in pence. */
      depositPence: number;
    }
  | { ok: false; reason: "gone" }
  | { ok: false; reason: "not_authenticated" }
  | { ok: false; reason: "unavailable" }
  | { ok: false; reason: "failed" };

/* ── Database row shapes ─────────────────────────────────────────────── */

type Embed<T> = T[] | T | null;

interface DropArtistRow {
  id: string;
  handle: string;
  display_name: string;
  city: string | null;
  avatar_path: string | null;
  lat: number | null;
  lng: number | null;
}

interface OpenDropRow {
  id: string;
  drop_date: string;
  slot_type: SlotType;
  hours_note: string | null;
  normal_price_pence: number | null;
  drop_price_pence: number;
  note: string | null;
  artists: Embed<DropArtistRow>;
}

interface MyDropRow {
  id: string;
  drop_date: string;
  slot_type: SlotType;
  hours_note: string | null;
  normal_price_pence: number | null;
  drop_price_pence: number;
  note: string | null;
  status: DropStatus;
  claimed_at: string | null;
}

/* ── Helpers ─────────────────────────────────────────────────────────── */

/** Local yyyy-mm-dd for "today" — the floor for public open drops. */
function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** First embed row when Supabase returns object-or-array for a join. */
function firstEmbed<T>(embed: Embed<T>): T | null {
  if (!embed) return null;
  return Array.isArray(embed) ? (embed[0] ?? null) : embed;
}

const DROP_ARTIST_SELECT =
  "id, handle, display_name, city, avatar_path, lat, lng";

/* ── Reads ───────────────────────────────────────────────────────────── */

/**
 * Open, future drops for the public Ink Drops browser. Sorted by soonest date,
 * then by distance when the viewer's coordinates are supplied. Drops whose
 * publishing artist isn't publicly readable are dropped. Returns [] on error.
 */
export async function listOpenDrops(
  opts: { near?: LatLng | null; limit?: number } = {},
): Promise<OpenDrop[]> {
  const limit = opts.limit ?? 60;

  const { data, error } = await supabase
    .from("ink_drops")
    .select(
      `
        id,
        drop_date,
        slot_type,
        hours_note,
        normal_price_pence,
        drop_price_pence,
        note,
        artists ( ${DROP_ARTIST_SELECT} )
      `,
    )
    .eq("status", "open")
    .gte("drop_date", todayIso())
    .order("drop_date", { ascending: true })
    .limit(limit);

  if (error || !data) return [];

  const near = opts.near ?? null;

  const drops: OpenDrop[] = [];
  for (const raw of data as unknown as OpenDropRow[]) {
    const a = firstEmbed(raw.artists);
    if (!a) continue; // artist not publicly readable — skip rather than show a ghost
    const coord: LatLng | null =
      typeof a.lat === "number" && typeof a.lng === "number"
        ? { lat: Number(a.lat), lng: Number(a.lng) }
        : null;
    const distanceMiles = near && coord ? haversineMiles(near, coord) : null;

    drops.push({
      id: raw.id,
      dropDate: raw.drop_date,
      slotType: raw.slot_type,
      hoursNote: raw.hours_note,
      normalPricePence: raw.normal_price_pence,
      dropPricePence: raw.drop_price_pence,
      note: raw.note,
      artist: {
        id: a.id,
        handle: a.handle,
        displayName: a.display_name,
        city: a.city,
        avatarPath: a.avatar_path,
        lat: coord?.lat ?? null,
        lng: coord?.lng ?? null,
      },
      distanceMiles,
    });
  }

  // Already date-ascending from the DB; break ties by nearest when we can.
  if (near) {
    drops.sort((x, y) => {
      if (x.dropDate !== y.dropDate) return x.dropDate < y.dropDate ? -1 : 1;
      const dx = x.distanceMiles ?? Number.POSITIVE_INFINITY;
      const dy = y.distanceMiles ?? Number.POSITIVE_INFINITY;
      return dx - dy;
    });
  }

  return drops;
}

/**
 * The signed-in artist's own drops (all statuses), soonest first. Empty when
 * signed out or without an artist row. RLS scopes the rows to the caller.
 */
export async function listMyDrops(): Promise<MyDrop[]> {
  const ctx = await getArtistContext();
  if (!ctx) return [];

  const { data, error } = await supabase
    .from("ink_drops")
    .select(
      "id, drop_date, slot_type, hours_note, normal_price_pence, drop_price_pence, note, status, claimed_at",
    )
    .eq("artist_id", ctx.artistId)
    .order("drop_date", { ascending: true });

  if (error || !data) return [];

  return (data as unknown as MyDropRow[]).map((r) => ({
    id: r.id,
    dropDate: r.drop_date,
    slotType: r.slot_type,
    hoursNote: r.hours_note,
    normalPricePence: r.normal_price_pence,
    dropPricePence: r.drop_price_pence,
    note: r.note,
    status: r.status,
    claimedAt: r.claimed_at,
  }));
}

/* ── Writes ──────────────────────────────────────────────────────────── */

/**
 * Publish a drop as the signed-in artist. RLS `is_own_artist(artist_id)` makes
 * the row un-spoofable — the artist_id must be the caller's own. Validates the
 * slot/price locally so the DB check constraints are never the first line of
 * defence.
 */
export async function publishDrop(
  input: PublishDropInput,
): Promise<PublishDropResult> {
  const ctx = await getArtistContext();
  if (!ctx) return { ok: false, error: "not_artist" };

  const dropDate = input.dropDate?.trim();
  const validSlot =
    input.slotType === "full_day" ||
    input.slotType === "half_day" ||
    input.slotType === "hours";

  if (
    !dropDate ||
    dropDate < todayIso() ||
    !validSlot ||
    !Number.isInteger(input.dropPricePence) ||
    input.dropPricePence <= 0
  ) {
    return { ok: false, error: "invalid_input" };
  }

  // A "normal" price only makes sense when it's above the drop price.
  const normal =
    input.normalPricePence != null &&
    Number.isInteger(input.normalPricePence) &&
    input.normalPricePence > input.dropPricePence
      ? input.normalPricePence
      : null;

  const hoursNote =
    input.slotType === "hours" ? input.hoursNote?.trim() || null : null;

  const { data, error } = await supabase
    .from("ink_drops")
    .insert({
      artist_id: ctx.artistId,
      drop_date: dropDate,
      slot_type: input.slotType,
      hours_note: hoursNote,
      normal_price_pence: normal,
      drop_price_pence: input.dropPricePence,
      note: input.note?.trim() || null,
      status: "open",
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("[ink-drops] publish failed:", error);
    return { ok: false, error: "save_failed" };
  }

  return { ok: true, dropId: (data as { id: string }).id };
}

/**
 * Withdraw one of the artist's own OPEN drops. Guarded to status='open' so a
 * drop that was already claimed in the meantime can't be pulled out from under
 * the customer. RLS still scopes the row to the owner.
 */
export async function withdrawDrop(id: string): Promise<WithdrawDropResult> {
  const ctx = await getArtistContext();
  if (!ctx) return { ok: false, error: "not_artist" };

  const { error } = await supabase
    .from("ink_drops")
    .update({ status: "withdrawn" })
    .eq("id", id)
    .eq("artist_id", ctx.artistId)
    .eq("status", "open");

  if (error) {
    console.error("[ink-drops] withdraw failed:", error);
    return { ok: false, error: "save_failed" };
  }
  return { ok: true };
}

/**
 * Claim an open drop as the signed-in customer via the DEFINER-safe action
 * (migration 0020). The function performs the race-safe open → claimed flip
 * (first customer wins), creates the CONFIRMED appointment with the drop price
 * and derived deposit, links it back, and notifies the artist — atomically.
 *
 * Expected contract (single row): { status: 'claimed' | 'gone',
 * appointment_id uuid, deposit_pence int, price_pence int }. We read it
 * defensively so minor shape differences (json object vs row) still resolve. A
 * missing function (not yet deployed) surfaces as `unavailable` so the UI shows
 * a calm "not available yet" rather than a hard error.
 */
export async function claimDrop(id: string): Promise<ClaimDropResult> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user?.id) return { ok: false, reason: "not_authenticated" };

  const { data, error } = await supabase.rpc("claim_ink_drop", {
    p_drop_id: id,
  });

  if (error) {
    // 42883 / PGRST202 → the RPC isn't present in this environment yet.
    const code = (error as { code?: string }).code ?? "";
    if (code === "42883" || code === "PGRST202") {
      return { ok: false, reason: "unavailable" };
    }
    console.error("[ink-drops] claim failed:", error);
    return { ok: false, reason: "failed" };
  }

  // claim_ink_drop (0020) returns one row of out_-prefixed columns on a win, and
  // NO row when the race was lost. Mirror web's parse exactly.
  const row = (Array.isArray(data) ? data[0] : data) as
    | {
        out_appointment_id?: string | null;
        out_artist_id?: string | null;
        out_drop_price_pence?: number | null;
        out_deposit_pence?: number | null;
      }
    | null
    | undefined;

  // No row / no appointment id → the race was lost (or withdrawn/expired/past).
  if (!row || !row.out_appointment_id) return { ok: false, reason: "gone" };

  return {
    ok: true,
    appointmentId: row.out_appointment_id,
    pricePence: row.out_drop_price_pence ?? 0,
    depositPence: row.out_deposit_pence ?? 0,
  };
}
