/**
 * Read layer for the ARTIST PROFILE editor — the native counterpart to the web
 * artist-settings / onboarding / portfolio manager reads.
 *
 * Every read runs through the anon Supabase client under RLS. The signed-in
 * artist's own rows are visible through the `*_artist_manage` (for all) policies
 * — artists_manage_own, services_artist_manage, availability_rules_artist_manage
 * and portfolio_artist_manage — so drafts (unpublished / inactive) come back
 * too, which is exactly what the editor needs.
 *
 * Everything degrades SOFTLY: null when signed out or without an artist row,
 * empty lists on any error — never a throw. Money is integer PENCE.
 */

import { supabase } from "../../lib/supabase";

export type DepositKind = "fixed" | "percent";

/** The signed-in artist's editable profile row. */
export interface EditableArtist {
  id: string;
  userId: string;
  handle: string;
  displayName: string;
  bio: string | null;
  city: string | null;
  styles: string[];
  instagram: string | null;
  tiktok: string | null;
  avatarPath: string | null;
  followersCount: number | null;
  financeEnabled: boolean;
  published: boolean;
}

/** An editable service row (includes inactive so the editor can show/restore). */
export interface EditableService {
  id: string;
  name: string;
  durationMin: number;
  priceFromPence: number;
  depositType: DepositKind;
  depositValue: number;
  active: boolean;
}

/** One recurring weekly availability window. */
export interface EditableAvailabilityRule {
  id: string;
  weekday: number;
  startTime: string;
  endTime: string;
}

/** An editable portfolio item (published or draft). */
export interface EditablePortfolioItem {
  id: string;
  title: string;
  caption: string | null;
  imagePath: string;
  source: "upload" | "instagram";
  sortOrder: number;
  published: boolean;
}

/* ── Artist context ──────────────────────────────────────────────────── */

/**
 * The signed-in artist's full editable profile, or null when signed out / no
 * artist row (they belong on onboarding, not the editor). Reads their own row
 * via artists_manage_own, so an unpublished draft resolves too.
 */
export async function getEditableArtist(): Promise<EditableArtist | null> {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) return null;

  const { data, error } = await supabase
    .from("artists")
    .select(
      "id, handle, display_name, bio, city, styles, instagram, tiktok, avatar_path, followers_count, finance_enabled, published",
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) return null;

  const row = data as {
    id: string;
    handle: string;
    display_name: string;
    bio: string | null;
    city: string | null;
    styles: string[] | null;
    instagram: string | null;
    tiktok: string | null;
    avatar_path: string | null;
    followers_count: number | null;
    finance_enabled: boolean;
    published: boolean;
  };

  return {
    id: row.id,
    userId,
    handle: row.handle,
    displayName: row.display_name,
    bio: row.bio,
    city: row.city,
    styles: row.styles ?? [],
    instagram: row.instagram,
    tiktok: row.tiktok,
    avatarPath: row.avatar_path,
    followersCount: row.followers_count,
    financeEnabled: row.finance_enabled,
    published: row.published,
  };
}

/* ── Services ────────────────────────────────────────────────────────── */

/** The artist's services (active + inactive), cheapest first. */
export async function listMyServices(
  artistId: string,
): Promise<EditableService[]> {
  const { data, error } = await supabase
    .from("services")
    .select("id, name, duration_min, price_from_pence, deposit_type, deposit_value, active")
    .eq("artist_id", artistId)
    .order("price_from_pence", { ascending: true });

  if (error || !data) return [];

  return (
    data as {
      id: string;
      name: string;
      duration_min: number;
      price_from_pence: number;
      deposit_type: DepositKind;
      deposit_value: number;
      active: boolean;
    }[]
  ).map((r) => ({
    id: r.id,
    name: r.name,
    durationMin: r.duration_min,
    priceFromPence: r.price_from_pence,
    depositType: r.deposit_type,
    depositValue: r.deposit_value,
    active: r.active,
  }));
}

/* ── Availability ────────────────────────────────────────────────────── */

/** The artist's recurring weekly availability windows. */
export async function listMyAvailability(
  artistId: string,
): Promise<EditableAvailabilityRule[]> {
  const { data, error } = await supabase
    .from("availability_rules")
    .select("id, weekday, start_time, end_time")
    .eq("artist_id", artistId)
    .order("weekday", { ascending: true });

  if (error || !data) return [];

  return (
    data as {
      id: string;
      weekday: number;
      start_time: string;
      end_time: string;
    }[]
  ).map((r) => ({
    id: r.id,
    weekday: r.weekday,
    startTime: r.start_time,
    endTime: r.end_time,
  }));
}

/* ── Portfolio ───────────────────────────────────────────────────────── */

/** The artist's portfolio items (published + draft), in display order. */
export async function listMyPortfolio(
  artistId: string,
): Promise<EditablePortfolioItem[]> {
  const { data, error } = await supabase
    .from("portfolio_items")
    .select("id, title, caption, image_path, source, sort_order, published")
    .eq("artist_id", artistId)
    .order("sort_order", { ascending: true });

  if (error || !data) return [];

  return (
    data as {
      id: string;
      title: string;
      caption: string | null;
      image_path: string;
      source: "upload" | "instagram" | null;
      sort_order: number;
      published: boolean;
    }[]
  ).map((r) => ({
    id: r.id,
    title: r.title,
    caption: r.caption,
    imagePath: r.image_path,
    source: r.source === "instagram" ? "instagram" : "upload",
    sortOrder: r.sort_order,
    published: r.published,
  }));
}
