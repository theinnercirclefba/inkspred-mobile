/**
 * Studio management write actions for the native studio_admin app — the mirror
 * of apps/web/lib/data/studio-manage.ts (updateMyStudio, addStudioArtist,
 * removeStudioArtist) plus the studio-create step from
 * apps/web/lib/data/studios.ts (createStudioWithArtists).
 *
 * Every write runs through the anon Supabase client under RLS on the signed-in
 * studio_admin's own rows:
 *   - studios_owner_manage           (INSERT/UPDATE scoped by owner_user_id)
 *   - artists_studio_managed_insert  (create loginless, published roster artists)
 *   - studio_members_owner_manage    (attach / detach memberships)
 *
 * CORE PRINCIPLE (mirrors the web): addStudioArtist creates a REAL, published
 * artists row (null user_id — the studio makes the profile on the artist's
 * behalf) plus a 'resident' membership. The artist owns their /a/{handle}
 * profile; removeStudioArtist detaches the membership only, leaving the artist
 * row intact so they can claim it later.
 *
 * Everything soft-degrades to a typed { ok:false } — it never throws — so the
 * UI can toast honestly and revert any optimistic change.
 */

import { supabase } from "../../lib/supabase";

/* ── Types ───────────────────────────────────────────────────────────── */

/** Editable studio fields — passed to updateMyStudio. */
export interface UpdateStudioFields {
  name?: string;
  city?: string;
  addressLine1?: string;
  postcode?: string;
  phone?: string;
  /** Without a leading @. */
  instagram?: string;
  description?: string;
}

/** Input for creating a studio (minimal first-run form). */
export interface CreateStudioInput {
  name: string;
  city: string;
}

/** Input for adding an artist to the roster. */
export interface AddStudioArtistInput {
  name: string;
  /** Desired handle (without a leading @); may be blank to auto-derive. */
  handle: string;
  styles: string[];
  bio?: string;
}

export type ActionResult =
  | { ok: true }
  | { ok: false; error: "not_authenticated" }
  | { ok: false; error: "no_studio" }
  | { ok: false; error: "invalid" }
  | { ok: false; error: "slug_taken" }
  | { ok: false; error: "save_failed" };

export type CreateStudioResult =
  | { ok: true; slug: string }
  | { ok: false; error: "not_authenticated" | "invalid" | "slug_taken" | "save_failed" };

/* ── Constants / pure helpers ────────────────────────────────────────── */

const UNIQUE_VIOLATION = "23505";

/** Studio slug rules: lower-case, kebab, 3–60 chars (matches the DB check). */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/^@+/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/** Artist handle rules: lower-case, [a-z0-9_.-], 3–30 chars (DB check). */
export function handlify(input: string): string {
  return input
    .toLowerCase()
    .replace(/^@+/, "")
    .replace(/[^a-z0-9_.-]+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, 30);
}

/** Pad a too-short slug up to a minimum length with a suffix. */
function ensureSlugMinLength(base: string): string {
  let value = base;
  if (value.length < 3) value = `${value || "studio"}-studio`.slice(0, 60);
  if (value.length < 3) value = "studio";
  return value;
}

/** Pad a too-short handle up to a minimum length with a suffix. */
function ensureHandleMinLength(base: string): string {
  let value = base;
  if (value.length < 3) value = `${value || "artist"}-ink`.slice(0, 30);
  if (value.length < 3) value = "artist";
  return value;
}

/* ── Auth guard ──────────────────────────────────────────────────────── */

async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

/**
 * The id + slug of the signed-in studio_admin's studio, or a typed error when
 * signed out / no studio. Small guard the write actions run before mutating.
 */
async function requireOwnedStudio(): Promise<
  | { ok: true; studioId: string; slug: string; city: string | null }
  | { ok: false; error: "not_authenticated" | "no_studio" }
> {
  const userId = await currentUserId();
  if (!userId) return { ok: false, error: "not_authenticated" };

  const { data, error } = await supabase
    .from("studios")
    .select("id, slug, city")
    .eq("owner_user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error || !data) return { ok: false, error: "no_studio" };
  const row = data as { id: string; slug: string; city: string | null };
  return { ok: true, studioId: row.id, slug: row.slug, city: row.city };
}

/* ── Handle availability probe ───────────────────────────────────────── */

/**
 * Is a handle free? Probes the public-readable artists table (artists_public_read).
 * Used by the add-artist sheet to reassure before submit. On any error we return
 * `true` (optimistic) — the real uniqueness guarantee is the DB constraint that
 * addStudioArtist honours by re-probing and suffixing.
 */
export async function isHandleAvailable(handle: string): Promise<boolean> {
  const clean = handlify(handle);
  if (clean.length < 3) return false;
  const { data, error } = await supabase
    .from("artists")
    .select("id")
    .eq("handle", clean)
    .maybeSingle();
  if (error) return true;
  return !data;
}

/** Probe the artists table for a free handle, suffixing on collision. */
async function findFreeHandle(desired: string, fallback: string): Promise<string> {
  const base = ensureHandleMinLength(handlify(desired) || handlify(fallback) || "artist");
  for (let attempt = 0; attempt < 25; attempt += 1) {
    const candidate = attempt === 0 ? base : `${base}-${attempt + 1}`.slice(0, 30);
    const { data } = await supabase
      .from("artists")
      .select("id")
      .eq("handle", candidate)
      .maybeSingle();
    if (!data) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`.slice(0, 30);
}

/** Probe the studios table for a free slug, suffixing on collision. */
async function findFreeSlug(desired: string): Promise<string> {
  const base = ensureSlugMinLength(slugify(desired) || "studio");
  for (let attempt = 0; attempt < 25; attempt += 1) {
    const candidate = attempt === 0 ? base : `${base}-${attempt + 1}`.slice(0, 60);
    const { data } = await supabase
      .from("studios")
      .select("id")
      .eq("slug", candidate)
      .maybeSingle();
    if (!data) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`.slice(0, 60);
}

/* ── Create ──────────────────────────────────────────────────────────── */

/**
 * Create the signed-in studio_admin's studio — the native first-run step,
 * mirroring createStudioWithArtists' studio insert (owner_user_id = auth.uid,
 * auto-derived unique slug) minus the roster (artists are added afterwards on
 * the Artists tab). If the owner already has their own self-managed artist
 * profile, they're attached to the new roster as 'owner'.
 */
export async function createStudio(
  input: CreateStudioInput,
): Promise<CreateStudioResult> {
  const name = input.name.trim();
  if (name.length === 0) return { ok: false, error: "invalid" };

  const userId = await currentUserId();
  if (!userId) return { ok: false, error: "not_authenticated" };

  const slug = await findFreeSlug(input.name);
  const city = input.city.trim() || null;

  const { data: studio, error: studioError } = await supabase
    .from("studios")
    .insert({
      owner_user_id: userId,
      name,
      slug,
      city,
    })
    .select("id, slug")
    .single();

  if (studioError || !studio) {
    if (studioError?.code === UNIQUE_VIOLATION) {
      return { ok: false, error: "slug_taken" };
    }
    console.error("[studio] create failed:", studioError);
    return { ok: false, error: "save_failed" };
  }

  // If the owner has their own self-managed artist profile, seat them as 'owner'.
  const { data: ownerArtist } = await supabase
    .from("artists")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (ownerArtist?.id) {
    const { error: memberError } = await supabase.from("studio_members").insert({
      studio_id: studio.id,
      artist_id: (ownerArtist as { id: string }).id,
      role: "owner",
    });
    // Non-fatal — the studio exists; a duplicate/denied membership just means
    // the owner isn't seated, which they can resolve later.
    if (memberError && memberError.code !== UNIQUE_VIOLATION) {
      console.error("[studio] owner membership failed:", memberError);
    }
  }

  return { ok: true, slug: studio.slug as string };
}

/* ── Update ──────────────────────────────────────────────────────────── */

/**
 * Patch the signed-in studio_admin's studio. Trims and normalises each field;
 * undefined keys are skipped entirely so a partial edit never nulls untouched
 * columns. Soft-degrades to a typed error the UI can toast.
 */
export async function updateMyStudio(
  fields: UpdateStudioFields,
): Promise<ActionResult> {
  const owned = await requireOwnedStudio();
  if (!owned.ok) return { ok: false, error: owned.error };

  const patch: Record<string, string | null> = {};
  if (fields.name !== undefined) {
    const name = fields.name.trim();
    if (name.length === 0) return { ok: false, error: "invalid" };
    patch.name = name;
  }
  if (fields.city !== undefined) patch.city = fields.city.trim() || null;
  if (fields.addressLine1 !== undefined)
    patch.address_line1 = fields.addressLine1.trim() || null;
  if (fields.postcode !== undefined)
    patch.postcode = fields.postcode.trim() || null;
  if (fields.phone !== undefined) patch.phone = fields.phone.trim() || null;
  if (fields.instagram !== undefined)
    patch.instagram = fields.instagram.trim().replace(/^@+/, "") || null;
  if (fields.description !== undefined)
    patch.description = fields.description.trim() || null;

  if (Object.keys(patch).length === 0) return { ok: true };

  const { error } = await supabase
    .from("studios")
    .update(patch)
    .eq("id", owned.studioId);

  if (error) {
    console.error("[studio] update failed:", error);
    return { ok: false, error: "save_failed" };
  }
  return { ok: true };
}

/* ── Roster ──────────────────────────────────────────────────────────── */

/**
 * Add an artist to the roster. Mirrors the web: creates a PUBLISHED,
 * studio-managed artists row (null user_id — the studio makes the profile on the
 * artist's behalf) with a unique handle, plus a 'resident' studio_members row.
 * The artist owns their own /a/{handle} profile; the studio only groups them.
 */
export async function addStudioArtist(
  input: AddStudioArtistInput,
): Promise<ActionResult> {
  const name = input.name.trim();
  if (name.length === 0) return { ok: false, error: "invalid" };

  const owned = await requireOwnedStudio();
  if (!owned.ok) return { ok: false, error: owned.error };

  const handle = await findFreeHandle(input.handle || name, name);

  const { data: created, error: artistError } = await supabase
    .from("artists")
    .insert({
      user_id: null,
      handle,
      display_name: name,
      bio: input.bio?.trim() || null,
      city: owned.city,
      styles: input.styles,
      published: true,
    })
    .select("id")
    .single();

  if (artistError || !created) {
    console.error("[studio] artist insert failed:", artistError);
    return { ok: false, error: "save_failed" };
  }

  const { error: memberError } = await supabase.from("studio_members").insert({
    studio_id: owned.studioId,
    artist_id: (created as { id: string }).id,
    role: "resident",
  });

  if (memberError && memberError.code !== UNIQUE_VIOLATION) {
    console.error("[studio] member insert failed:", memberError);
    // The artist profile exists; the membership is what failed. Surface it so
    // the admin can retry — the /a/{handle} profile is already live.
    return { ok: false, error: "save_failed" };
  }

  return { ok: true };
}

/**
 * Remove an artist from the roster. Detaches the membership only — the artist's
 * /a/{handle} profile is untouched, because the artist owns it (they can claim
 * it later). Mirrors the web exactly.
 */
export async function removeStudioArtist(artistId: string): Promise<ActionResult> {
  if (!artistId) return { ok: false, error: "invalid" };

  const owned = await requireOwnedStudio();
  if (!owned.ok) return { ok: false, error: owned.error };

  const { error } = await supabase
    .from("studio_members")
    .delete()
    .eq("studio_id", owned.studioId)
    .eq("artist_id", artistId);

  if (error) {
    console.error("[studio] member delete failed:", error);
    return { ok: false, error: "save_failed" };
  }
  return { ok: true };
}
