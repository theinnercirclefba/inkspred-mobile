/**
 * Write actions for the ARTIST PROFILE editor — the native mirror of web's
 * updateArtistSettings (artist-settings.ts), the onboarding services /
 * availability upserts (onboarding.ts) and the portfolio manager mutations
 * (portfolio.ts). EVERY write runs through the anon Supabase client under RLS,
 * scoped to the signed-in artist's own rows:
 *
 *   - artists_manage_own              → profile + avatar UPDATE
 *   - services_artist_manage          → service INSERT / UPDATE / DELETE
 *   - availability_rules_artist_manage→ per-weekday DELETE + INSERT
 *   - portfolio_artist_manage         → portfolio INSERT / UPDATE / DELETE
 *
 * Only columns the web actually writes are ever touched. Money is integer PENCE.
 * Each action soft-degrades to { ok:false } (never throws) so an optimistic UI
 * can revert honestly.
 */

import { supabase } from "../../lib/supabase";
import type { DepositKind } from "./data";
import {
  parseDurationMinutes,
  sanitizeInstagram,
  sanitizeTiktok,
  toDbTime,
} from "./format";

/** Postgres unique-violation code (duplicate weekday window etc.). */
const UNIQUE_VIOLATION = "23505";

export interface ActionResult {
  ok: boolean;
  /** False when signed out — the caller keeps its optimistic UI honest. */
  authenticated: boolean;
  /** Set when a specific, surfaced failure reason is useful. */
  error?: string;
}

async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

/* ── Profile ─────────────────────────────────────────────────────────── */

export interface ProfilePatch {
  displayName: string;
  bio: string;
  city: string;
  styles: string[];
  instagram: string;
  tiktok: string;
}

/**
 * Update the signed-in artist's profile. Writes ONLY the columns the web writes
 * (display_name, bio, city, styles, instagram, tiktok) via artists_manage_own,
 * filtered on user_id so the DB enforces ownership. Handles are sanitised to
 * their DB-legal form so the write never trips a check constraint.
 */
export async function updateArtistProfile(
  patch: ProfilePatch,
): Promise<ActionResult> {
  const userId = await currentUserId();
  if (!userId) return { ok: false, authenticated: false };

  const displayName = patch.displayName.trim();
  if (displayName.length === 0) {
    return { ok: false, authenticated: true, error: "Add a display name." };
  }

  const { error } = await supabase
    .from("artists")
    .update({
      display_name: displayName,
      bio: patch.bio.trim() || null,
      city: patch.city.trim() || null,
      styles: patch.styles,
      instagram: sanitizeInstagram(patch.instagram),
      tiktok: sanitizeTiktok(patch.tiktok),
    })
    .eq("user_id", userId);

  if (error) return { ok: false, authenticated: true, error: "Couldn't save — try again." };
  return { ok: true, authenticated: true };
}

/**
 * Persist a freshly-uploaded avatar path onto artists.avatar_path. The object
 * already lives under the caller's own `{uid}/…` prefix in the portfolio bucket
 * (see uploadAvatarImage). Scoped to the caller's own row by user_id.
 */
export async function updateArtistAvatar(
  avatarPath: string,
): Promise<ActionResult> {
  const userId = await currentUserId();
  if (!userId) return { ok: false, authenticated: false };

  const { error } = await supabase
    .from("artists")
    .update({ avatar_path: avatarPath })
    .eq("user_id", userId);

  if (error) return { ok: false, authenticated: true, error: "Couldn't update your photo." };
  return { ok: true, authenticated: true };
}

/* ── Services ────────────────────────────────────────────────────────── */

export interface ServiceInput {
  name: string;
  /** Free-text duration label, parsed to minutes (parseDurationMinutes). */
  durationLabel: string;
  pricePence: number;
  depositKind: DepositKind;
  /** fixed → pence, percent → whole-number percent (0–100). */
  depositValue: number;
}

/** Shape a ServiceInput into the DB row payload (shared by create/update). */
function serviceRow(artistId: string | null, input: ServiceInput) {
  const depositValue = Math.max(0, Math.round(input.depositValue));
  return {
    ...(artistId ? { artist_id: artistId } : {}),
    name: input.name.trim(),
    duration_min: parseDurationMinutes(input.durationLabel),
    price_from_pence: Math.max(0, Math.round(input.pricePence)),
    deposit_type: input.depositKind,
    // Clamp a percent deposit to 100 so the services_percent_deposit_bounds
    // check can never fire.
    deposit_value:
      input.depositKind === "percent" ? Math.min(100, depositValue) : depositValue,
    active: true,
  };
}

/** Create a new service for the signed-in artist. Returns the new row id. */
export async function createService(
  artistId: string,
  input: ServiceInput,
): Promise<ActionResult & { id?: string }> {
  const userId = await currentUserId();
  if (!userId) return { ok: false, authenticated: false };
  if (input.name.trim().length === 0) {
    return { ok: false, authenticated: true, error: "Add a service name." };
  }

  const { data, error } = await supabase
    .from("services")
    .insert(serviceRow(artistId, input))
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, authenticated: true, error: "Couldn't add that service." };
  }
  return { ok: true, authenticated: true, id: (data as { id: string }).id };
}

/**
 * Update one service. RLS (services_artist_manage) scopes the write to the
 * owning artist, so filtering on id alone is safe.
 */
export async function updateService(
  id: string,
  input: ServiceInput,
): Promise<ActionResult> {
  const userId = await currentUserId();
  if (!userId) return { ok: false, authenticated: false };
  if (input.name.trim().length === 0) {
    return { ok: false, authenticated: true, error: "Add a service name." };
  }

  const { error } = await supabase
    .from("services")
    .update(serviceRow(null, input))
    .eq("id", id);

  if (error) return { ok: false, authenticated: true, error: "Couldn't save that service." };
  return { ok: true, authenticated: true };
}

/** Delete a service. RLS scopes it to the owning artist. */
export async function deleteService(id: string): Promise<ActionResult> {
  const userId = await currentUserId();
  if (!userId) return { ok: false, authenticated: false };

  const { error } = await supabase.from("services").delete().eq("id", id);
  if (error) return { ok: false, authenticated: true, error: "Couldn't remove that service." };
  return { ok: true, authenticated: true };
}

/* ── Availability ────────────────────────────────────────────────────── */

/**
 * Set (or clear) a single weekday's window. Mirrors web's delete-and-reinsert
 * idempotency, scoped to ONE weekday: existing rules for that weekday are
 * removed, then — when `open` — a fresh rule is inserted. Times are normalised
 * to the "HH:MM:SS" the `time` columns expect; the window must be non-empty
 * (end > start) to satisfy availability_rules_window.
 */
export async function setWeekdayAvailability(
  artistId: string,
  weekday: number,
  open: boolean,
  from: string,
  to: string,
): Promise<ActionResult> {
  const userId = await currentUserId();
  if (!userId) return { ok: false, authenticated: false };

  const { error: delError } = await supabase
    .from("availability_rules")
    .delete()
    .eq("artist_id", artistId)
    .eq("weekday", weekday);
  if (delError) return { ok: false, authenticated: true, error: "Couldn't update your hours." };

  if (!open) return { ok: true, authenticated: true };

  const startTime = toDbTime(from);
  const endTime = toDbTime(to);
  if (endTime <= startTime) {
    return { ok: false, authenticated: true, error: "Closing time must be after opening time." };
  }

  const { error: insError } = await supabase.from("availability_rules").insert({
    artist_id: artistId,
    weekday,
    start_time: startTime,
    end_time: endTime,
  });
  if (insError && insError.code !== UNIQUE_VIOLATION) {
    return { ok: false, authenticated: true, error: "Couldn't update your hours." };
  }
  return { ok: true, authenticated: true };
}

/* ── Portfolio ───────────────────────────────────────────────────────── */

/** A newly-registered portfolio item, for optimistic reconciliation. */
export interface RegisteredItem {
  id: string;
  imagePath: string;
  title: string;
  caption: string | null;
  source: "upload";
  sortOrder: number;
  published: boolean;
}

/**
 * Record already-uploaded storage objects as portfolio_items for the signed-in
 * artist — the native mirror of registerPortfolioImages. New rows go after the
 * artist's existing items and are published by default. Each path must sit under
 * the caller's own `{uid}/…` prefix (belt-and-braces on top of storage RLS).
 */
export async function registerPortfolioUploads(
  artistId: string,
  paths: string[],
): Promise<{ ok: boolean; authenticated: boolean; items: RegisteredItem[] }> {
  const userId = await currentUserId();
  if (!userId) return { ok: false, authenticated: false, items: [] };
  if (paths.length === 0) return { ok: true, authenticated: true, items: [] };

  const owned = paths.filter(
    (p) => typeof p === "string" && p.split("/")[0] === userId && !p.includes(".."),
  );
  if (owned.length === 0) return { ok: false, authenticated: true, items: [] };

  const { data: existing } = await supabase
    .from("portfolio_items")
    .select("sort_order")
    .eq("artist_id", artistId)
    .order("sort_order", { ascending: false })
    .limit(1);
  const baseSort =
    existing && existing.length > 0
      ? (existing[0] as { sort_order: number }).sort_order + 1
      : 0;

  const rows = owned.map((path, index) => ({
    artist_id: artistId,
    title: "Portfolio piece",
    caption: null,
    image_path: path,
    source: "upload" as const,
    sort_order: baseSort + index,
    published: true,
  }));

  const { data, error } = await supabase
    .from("portfolio_items")
    .insert(rows)
    .select("id, title, caption, image_path, sort_order, published");

  if (error || !data) return { ok: false, authenticated: true, items: [] };

  const items: RegisteredItem[] = (
    data as {
      id: string;
      title: string;
      caption: string | null;
      image_path: string;
      sort_order: number;
      published: boolean;
    }[]
  ).map((r) => ({
    id: r.id,
    imagePath: r.image_path,
    title: r.title,
    caption: r.caption,
    source: "upload",
    sortOrder: r.sort_order,
    published: r.published,
  }));

  return { ok: true, authenticated: true, items };
}

/** Publish / unpublish a single portfolio item. */
export async function setPortfolioPublished(
  id: string,
  published: boolean,
): Promise<ActionResult> {
  const userId = await currentUserId();
  if (!userId) return { ok: false, authenticated: false };

  const { error } = await supabase
    .from("portfolio_items")
    .update({ published })
    .eq("id", id);
  if (error) return { ok: false, authenticated: true };
  return { ok: true, authenticated: true };
}

/**
 * Persist a new ordering: each id's sort_order becomes its index in the list.
 * Mirrors web's reorderPortfolio (RLS scopes every update to the owning artist).
 */
export async function reorderPortfolio(
  artistId: string,
  orderedIds: string[],
): Promise<ActionResult> {
  const userId = await currentUserId();
  if (!userId) return { ok: false, authenticated: false };

  const results = await Promise.all(
    orderedIds.map((id, index) =>
      supabase
        .from("portfolio_items")
        .update({ sort_order: index })
        .eq("id", id)
        .eq("artist_id", artistId),
    ),
  );
  if (results.some((r) => r.error)) return { ok: false, authenticated: true };
  return { ok: true, authenticated: true };
}

/**
 * Delete a portfolio item and best-effort remove its storage object. RLS scopes
 * the row delete to the owning artist. The native anon client can only remove
 * `{uid}/…` objects (its own uploads); Instagram rows live under `{artistId}/…`
 * and are cleaned up server-side, so a failed remove here is swallowed.
 */
export async function deletePortfolioItem(id: string): Promise<ActionResult> {
  const userId = await currentUserId();
  if (!userId) return { ok: false, authenticated: false };

  const { data: row } = await supabase
    .from("portfolio_items")
    .select("image_path")
    .eq("id", id)
    .maybeSingle();

  const { error } = await supabase.from("portfolio_items").delete().eq("id", id);
  if (error) return { ok: false, authenticated: true };

  const path = (row as { image_path: string } | null)?.image_path;
  if (path && !path.startsWith("placeholder:")) {
    try {
      await supabase.storage.from("portfolio").remove([path]);
    } catch {
      // Best-effort — a leftover object is harmless and cleaned server-side.
    }
  }
  return { ok: true, authenticated: true };
}
