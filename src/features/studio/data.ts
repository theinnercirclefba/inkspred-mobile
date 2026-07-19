/**
 * Read layer for the STUDIO OS — the native mirror of
 * apps/web/lib/data/studio-manage.ts (getMyStudio).
 *
 * CORE PRINCIPLE (mirrors the web): the ARTIST is the bookable unit and owns
 * their own /a/{handle} profile. A STUDIO is an affiliation that groups artists
 * under a brand / location via studio_members — it never "owns" the artist.
 *
 * Everything runs through the anon Supabase client under RLS on the signed-in
 * studio_admin's own rows:
 *   - studios              (studios_owner_manage — scoped by owner_user_id)
 *   - studio_members       (studio_members_public_read for the join)
 *   - artists / services   (artists_public_read — only PUBLISHED rows join)
 *
 * getMyStudio returns { studio, isSignedIn } so callers can tell the states
 * apart: a real owned studio (studio non-null); a signed-in studio_admin who
 * hasn't created a studio yet (studio null, isSignedIn true → first-run set-up);
 * and a signed-out visitor (studio null, isSignedIn false → sign-in prompt).
 *
 * Unlike the web, the native app never shows a fabricated "demo" studio as the
 * owner's own — it either shows the real row or a warm first-run/sign-in state.
 * Every read degrades SOFTLY to null / empty — it never throws. Money is PENCE.
 */

import { supabase } from "../../lib/supabase";

/* ── View models ─────────────────────────────────────────────────────── */

/** One artist on the studio roster, resolved for the management app. */
export interface StudioRosterArtist {
  /** artists.id — the id removeStudioArtist keys on. */
  id: string;
  handle: string;
  displayName: string;
  city: string | null;
  styles: string[];
  /** Cheapest active service price in pence, else base rate, else null. */
  fromPricePence: number | null;
  memberRole: "owner" | "manager" | "resident" | "guest";
}

/** The studio a studio_admin manages, hydrated for the management app. */
export interface ManagedStudio {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  addressLine1: string | null;
  city: string | null;
  postcode: string | null;
  phone: string | null;
  /** Without a leading @. */
  instagram: string | null;
  /** The roster — each artist owns their own /a/{handle} profile. */
  artists: StudioRosterArtist[];
}

/** What getMyStudio resolves — the studio plus the viewer's context. */
export interface MyStudioResult {
  /** The signed-in studio_admin's own studio, or null when they have none yet. */
  studio: ManagedStudio | null;
  /** True when a user is signed in (regardless of whether they own a studio). */
  isSignedIn: boolean;
}

/* ── Row shapes ──────────────────────────────────────────────────────── */

interface StudioRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  address_line1: string | null;
  city: string | null;
  postcode: string | null;
  phone: string | null;
  instagram: string | null;
  studio_members:
    | {
        role: "owner" | "manager" | "resident" | "guest";
        artists: {
          id: string;
          handle: string;
          display_name: string;
          city: string | null;
          styles: string[] | null;
          base_rate_pence: number | null;
          services: { price_from_pence: number; active: boolean }[] | null;
        } | null;
      }[]
    | null;
}

/* ── Helpers ─────────────────────────────────────────────────────────── */

/** Cheapest active service price in pence, else base rate, else null. */
function lowestPrice(
  services: { price_from_pence: number; active: boolean }[] | null,
  baseRatePence: number | null,
): number | null {
  const active = (services ?? []).filter((s) => s.active);
  if (active.length > 0) {
    return active.reduce(
      (min, s) => Math.min(min, s.price_from_pence),
      active[0].price_from_pence,
    );
  }
  return baseRatePence ?? null;
}

// Order roster members: owner → manager → resident → guest, then by name.
const ROLE_ORDER: Record<StudioRosterArtist["memberRole"], number> = {
  owner: 0,
  manager: 1,
  resident: 2,
  guest: 3,
};

function mapRoster(row: StudioRow): StudioRosterArtist[] {
  const members = row.studio_members ?? [];
  return members
    .filter((m): m is typeof m & { artists: NonNullable<typeof m.artists> } =>
      Boolean(m.artists),
    )
    .map((m): StudioRosterArtist => {
      const a = m.artists;
      return {
        id: a.id,
        handle: a.handle,
        displayName: a.display_name,
        city: a.city,
        styles: a.styles ?? [],
        fromPricePence: lowestPrice(a.services, a.base_rate_pence),
        memberRole: m.role,
      };
    })
    .sort((a, b) => {
      const roleDiff = ROLE_ORDER[a.memberRole] - ROLE_ORDER[b.memberRole];
      if (roleDiff !== 0) return roleDiff;
      return a.displayName.localeCompare(b.displayName);
    });
}

const STUDIO_SELECT = `
  id, name, slug, description, address_line1, city, postcode, phone, instagram,
  studio_members (
    role,
    artists (
      id, handle, display_name, city, styles, base_rate_pence,
      services ( price_from_pence, active )
    )
  )
`;

/* ── Reads ───────────────────────────────────────────────────────────── */

/**
 * The studio owned by the signed-in studio_admin, joined with its roster, plus
 * the viewer context. Signed out → { studio: null, isSignedIn: false }. Signed
 * in with no studio yet → { studio: null, isSignedIn: true } (first-run set-up).
 * Never throws — any RLS denial / query error resolves to a null studio.
 */
export async function getMyStudio(): Promise<MyStudioResult> {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) return { studio: null, isSignedIn: false };

  const { data, error } = await supabase
    .from("studios")
    .select(STUDIO_SELECT)
    .eq("owner_user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    // Signed in but no studio row yet → first-run set-up.
    return { studio: null, isSignedIn: true };
  }

  const row = data as unknown as StudioRow;
  return {
    studio: {
      id: row.id,
      name: row.name,
      slug: row.slug,
      description: row.description,
      addressLine1: row.address_line1,
      city: row.city,
      postcode: row.postcode,
      phone: row.phone,
      instagram: row.instagram,
      artists: mapRoster(row),
    },
    isSignedIn: true,
  };
}
