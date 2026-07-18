/**
 * Geo + style helpers for the map-first Find tab. Mirrors the vocabulary and
 * city centroids used by apps/web/app/(discover)/discover/_lib/artists.ts so
 * the two directories agree.
 */

export interface LatLng {
  lat: number;
  lng: number;
}

/** Real UK city centroids — used as a fallback when an artist row has no
 *  precise lat/lng yet (e.g. lewxs-dev is in Nottingham but ungeocoded). */
export const CITY_COORDS: Readonly<Record<string, LatLng>> = {
  London: { lat: 51.5074, lng: -0.1278 },
  Manchester: { lat: 53.4808, lng: -2.2426 },
  Leeds: { lat: 53.8008, lng: -1.5491 },
  Bristol: { lat: 51.4545, lng: -2.5879 },
  Glasgow: { lat: 55.8642, lng: -4.2518 },
  Brighton: { lat: 50.8225, lng: -0.1372 },
  Birmingham: { lat: 52.4862, lng: -1.8904 },
  Sheffield: { lat: 53.3811, lng: -1.4701 },
  Liverpool: { lat: 53.4084, lng: -2.9916 },
  Nottingham: { lat: 52.9548, lng: -1.1581 },
  Cardiff: { lat: 51.4816, lng: -3.1791 },
  Edinburgh: { lat: 55.9533, lng: -3.1883 },
};

/** Manchester — the map's default centre when we have no user location. */
export const DEFAULT_CENTRE: LatLng = CITY_COORDS.Manchester;

/**
 * Resolve a map position for an artist: use precise lat/lng when present,
 * otherwise fall back to the artist's city centroid (with a small deterministic
 * jitter so several artists in the same city don't stack on one pin). Returns
 * null when neither is available — the caller drops the artist from the map.
 */
export function resolveArtistCoords(
  lat: number | null,
  lng: number | null,
  city: string | null,
  seed: string,
): LatLng | null {
  if (typeof lat === "number" && typeof lng === "number") {
    return { lat, lng };
  }
  if (city && CITY_COORDS[city]) {
    const base = CITY_COORDS[city];
    // ±~0.6km deterministic offset keyed on the handle, so co-located artists
    // are distinguishable without moving them off their city.
    const h = hashString(seed);
    const dLat = (((h % 100) / 100) - 0.5) * 0.012;
    const dLngia = ((((h >> 3) % 100) / 100) - 0.5) * 0.018;
    return { lat: base.lat + dLat, lng: base.lng + dLngia };
  }
  return null;
}

// Small, stable string hash (djb2) for deterministic jitter.
function hashString(input: string): number {
  let hash = 5381;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 33) ^ input.charCodeAt(i);
  }
  return Math.abs(hash);
}

/** Great-circle distance in miles between two points. */
export function haversineMiles(a: LatLng, b: LatLng): number {
  const R = 3958.8; // Earth radius, miles
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const sin = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(sin)));
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * Title-case a raw style token from the DB ("fine-line" -> "Fine-line") for
 * display and for building the filter chip set. The DB stores styles in mixed
 * case (some rows Title-Case, some lower-kebab), so we normalise for grouping.
 */
export function styleLabel(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

/** Canonical key for matching a style regardless of casing / spacing. */
export function styleKey(raw: string): string {
  return raw.trim().toLowerCase();
}
