/**
 * Public read helpers for the InkSpred marketplace directory and profiles —
 * the native mirror of apps/web/lib/data/artists.ts.
 *
 * These use the anon Supabase client. RLS permits anonymous reads of PUBLISHED
 * artists and their ACTIVE services, PUBLISHED (non-hidden) portfolio items and
 * PUBLISHED reviews, so no privileged access is needed. Every function returns
 * an empty result on error rather than throwing, so screens can render an error
 * state instead of crashing.
 */

import { supabase } from "../supabase";

/* ── Directory ──────────────────────────────────────────────────────── */

export interface DirectoryArtist {
  id: string;
  handle: string;
  displayName: string;
  city: string | null;
  styles: string[];
  lat: number | null;
  lng: number | null;
  baseRatePence: number | null;
  fromPricePence: number | null;
  followersCount: number | null;
  avatarPath: string | null;
  coverImagePath: string | null;
}

interface CoverPortfolioRow {
  image_path: string;
  sort_order: number;
}

interface DirectoryArtistRow {
  id: string;
  handle: string;
  display_name: string;
  city: string | null;
  styles: string[] | null;
  lat: number | null;
  lng: number | null;
  base_rate_pence: number | null;
  followers_count: number | null;
  avatar_path: string | null;
  services: { price_from_pence: number; active: boolean }[] | null;
  portfolio_items: CoverPortfolioRow[] | null;
}

/** First real (non-placeholder) image by sort order, else null. */
export function pickCoverImagePath(
  items: CoverPortfolioRow[] | null | undefined,
): string | null {
  if (!items || items.length === 0) return null;
  const real = items
    .filter((i) => i.image_path && !i.image_path.startsWith("placeholder:"))
    .sort((a, b) => a.sort_order - b.sort_order);
  return real[0]?.image_path ?? null;
}

/** Cheapest active service price, else the base rate, else null. */
function lowestServicePrice(row: DirectoryArtistRow): number | null {
  const active = (row.services ?? []).filter((s) => s.active);
  if (active.length > 0) {
    return active.reduce(
      (min, s) => Math.min(min, s.price_from_pence),
      active[0].price_from_pence,
    );
  }
  return row.base_rate_pence ?? null;
}

/**
 * All published artists for the public directory. Returns an empty array on any
 * error. Throwing is avoided so the Find screen distinguishes "no artists" from
 * "request failed" via the thrown flag it sets itself.
 */
export async function listPublishedArtists(): Promise<DirectoryArtist[]> {
  const { data, error } = await supabase
    .from("artists")
    .select(
      `
        id,
        handle,
        display_name,
        city,
        styles,
        lat,
        lng,
        base_rate_pence,
        followers_count,
        avatar_path,
        services ( price_from_pence, active ),
        portfolio_items ( image_path, sort_order )
      `,
    )
    .eq("published", true)
    .order("created_at", { ascending: false });

  if (error) throw error;
  if (!data) return [];

  const rows = data as unknown as DirectoryArtistRow[];

  return rows.map((row) => ({
    id: row.id,
    handle: row.handle,
    displayName: row.display_name,
    city: row.city,
    styles: row.styles ?? [],
    lat: row.lat === null ? null : Number(row.lat),
    lng: row.lng === null ? null : Number(row.lng),
    baseRatePence: row.base_rate_pence,
    fromPricePence: lowestServicePrice(row),
    followersCount: row.followers_count,
    avatarPath: row.avatar_path,
    coverImagePath: pickCoverImagePath(row.portfolio_items),
  }));
}

/* ── Profile ────────────────────────────────────────────────────────── */

export type DepositType = "fixed" | "percent";

export interface ArtistServiceRow {
  id: string;
  name: string;
  description: string | null;
  duration_min: number;
  price_from_pence: number;
  deposit_type: DepositType;
  deposit_value: number;
}

export interface ArtistPortfolioRow {
  id: string;
  title: string;
  caption: string | null;
  style: string | null;
  placement: string | null;
  image_path: string;
  is_flash: boolean;
  flash_price_pence: number | null;
  sort_order: number;
}

export interface ArtistProfile {
  id: string;
  userId: string;
  handle: string;
  displayName: string;
  bio: string | null;
  city: string | null;
  styles: string[];
  instagram: string | null;
  baseRatePence: number | null;
  financeEnabled: boolean;
  avatarPath: string | null;
  followersCount: number | null;
  services: ArtistServiceRow[];
  portfolio: ArtistPortfolioRow[];
}

interface ArtistProfileRow {
  id: string;
  user_id: string;
  handle: string;
  display_name: string;
  bio: string | null;
  city: string | null;
  styles: string[] | null;
  instagram: string | null;
  base_rate_pence: number | null;
  finance_enabled: boolean;
  avatar_path: string | null;
  followers_count: number | null;
  services: (ArtistServiceRow & { active: boolean })[] | null;
  portfolio_items: (ArtistPortfolioRow & { published: boolean; hidden: boolean })[] | null;
}

/**
 * A published artist by handle, with active services and published (non-hidden)
 * portfolio. Returns null when no published artist owns the handle. Throws on a
 * transport error so the profile screen can show an error state.
 */
export async function getArtistByHandle(
  handle: string,
): Promise<ArtistProfile | null> {
  const { data, error } = await supabase
    .from("artists")
    .select(
      `
        id,
        handle,
        display_name,
        bio,
        city,
        styles,
        instagram,
        base_rate_pence,
        finance_enabled,
        avatar_path,
        followers_count,
        user_id,
        services ( id, name, description, duration_min, price_from_pence, deposit_type, deposit_value, active ),
        portfolio_items ( id, title, caption, style, placement, image_path, is_flash, flash_price_pence, sort_order, published, hidden )
      `,
    )
    .eq("handle", handle.toLowerCase())
    .eq("published", true)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const row = data as unknown as ArtistProfileRow;

  const services = (row.services ?? [])
    .filter((s) => s.active)
    .map(
      ({ id, name, description, duration_min, price_from_pence, deposit_type, deposit_value }): ArtistServiceRow => ({
        id,
        name,
        description,
        duration_min,
        price_from_pence,
        deposit_type,
        deposit_value,
      }),
    )
    .sort((a, b) => a.price_from_pence - b.price_from_pence);

  const portfolio = (row.portfolio_items ?? [])
    .filter((p) => p.published && !p.hidden)
    .map(
      ({ id, title, caption, style, placement, image_path, is_flash, flash_price_pence, sort_order }): ArtistPortfolioRow => ({
        id,
        title,
        caption,
        style,
        placement,
        image_path,
        is_flash,
        flash_price_pence,
        sort_order,
      }),
    )
    .sort((a, b) => a.sort_order - b.sort_order);

  return {
    id: row.id,
    userId: row.user_id,
    handle: row.handle,
    displayName: row.display_name,
    bio: row.bio,
    city: row.city,
    styles: row.styles ?? [],
    instagram: row.instagram,
    baseRatePence: row.base_rate_pence,
    financeEnabled: row.finance_enabled,
    avatarPath: row.avatar_path,
    followersCount: row.followers_count,
    services,
    portfolio,
  };
}

/* ── Follows ────────────────────────────────────────────────────────── */

/** Whether the signed-in user follows this artist. False when signed out. */
export async function isFollowing(artistId: string): Promise<boolean> {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) return false;

  const { data, error } = await supabase
    .from("follows")
    .select("id")
    .eq("user_id", userId)
    .eq("artist_id", artistId)
    .maybeSingle();

  if (error) return false;
  return !!data;
}

/** Follow an artist as the signed-in user. Idempotent (unique constraint). */
export async function followArtist(artistId: string): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) throw new Error("Sign in to follow artists.");

  const { error } = await supabase
    .from("follows")
    .insert({ user_id: userId, artist_id: artistId });
  // 23505 = already following — treat as success.
  if (error && error.code !== "23505") throw error;
}

/** Unfollow an artist as the signed-in user. */
export async function unfollowArtist(artistId: string): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) throw new Error("Sign in to follow artists.");

  const { error } = await supabase
    .from("follows")
    .delete()
    .eq("user_id", userId)
    .eq("artist_id", artistId);
  if (error) throw error;
}

/** Number of published artists the signed-in user follows (for the Following tab). */
export async function listFollowedArtists(): Promise<DirectoryArtist[]> {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) return [];

  const { data, error } = await supabase
    .from("follows")
    .select("artist_id")
    .eq("user_id", userId);

  if (error || !data) return [];
  const ids = new Set(data.map((r) => (r as { artist_id: string }).artist_id));
  if (ids.size === 0) return [];

  const all = await listPublishedArtists();
  return all.filter((a) => ids.has(a.id));
}
