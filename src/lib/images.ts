import Constants from "expo-constants";

/**
 * Portfolio image URL helpers — the native mirror of apps/web/lib/images.ts.
 *
 * portfolio_items.image_path is EITHER:
 *   * a "placeholder:N" token (legacy seed rows with no real image), or
 *   * a storage object key in the PUBLIC `portfolio` bucket, e.g.
 *     "{artistId}/{uuid}.jpg".
 *
 * The `portfolio` bucket is public, so a real image resolves to a plain,
 * cacheable public URL. Placeholder / empty paths return null so callers fall
 * back to a gradient tile.
 */

const PORTFOLIO_BUCKET = "portfolio";

function supabaseUrl(): string | null {
  const fromEnv = process.env.EXPO_PUBLIC_SUPABASE_URL;
  if (fromEnv) return fromEnv;
  const fromExtra = (Constants.expoConfig?.extra as Record<string, string> | undefined)
    ?.EXPO_PUBLIC_SUPABASE_URL;
  return fromExtra ?? null;
}

/** True for legacy "placeholder:N" tokens — callers render a gradient. */
export function isPlaceholderPath(imagePath: string | null | undefined): boolean {
  return typeof imagePath === "string" && imagePath.startsWith("placeholder:");
}

/**
 * Public URL for a portfolio image path, or `null` when there is no real image
 * (a "placeholder:" token, or an empty/absent path). Already-absolute URLs are
 * returned unchanged.
 */
export function publicPortfolioUrl(
  imagePath: string | null | undefined,
): string | null {
  if (!imagePath || isPlaceholderPath(imagePath)) return null;
  if (/^https?:\/\//i.test(imagePath)) return imagePath;

  const base = supabaseUrl();
  if (!base) return null;

  const encoded = imagePath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");

  return `${base.replace(/\/$/, "")}/storage/v1/object/public/${PORTFOLIO_BUCKET}/${encoded}`;
}
