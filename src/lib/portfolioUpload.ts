/**
 * Native half of portfolio / avatar image uploads — the Expo counterpart to
 * apps/web/lib/data/portfolio-upload.ts.
 *
 * Bytes go straight from the device to the PUBLIC `portfolio` bucket under the
 * signed-in user's own `{auth.uid()}/…` prefix — the only prefix the storage
 * RLS in 0009_portfolio_storage.sql lets an authenticated client write. The
 * small path string is then recorded as a portfolio_items row (portfolio
 * actions) or written onto artists.avatar_path (profile actions).
 *
 * The image picker hands us a local file URI; we read it into an ArrayBuffer
 * with `fetch` (no extra native module) and upload that. Every function returns
 * `{ path }` on success or `{ error }` on failure — never throws.
 */

import * as Crypto from "expo-crypto";
import { supabase } from "./supabase";

const PORTFOLIO_BUCKET = "portfolio";

/** ~8 MB cap, matching the web upload + server remote-saver limits. */
const MAX_BYTES = 8 * 1024 * 1024;

/** File extension for a known image mime type; defaults to jpg. */
const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/heic": "heic",
  "image/heif": "heif",
  "image/avif": "avif",
};

export interface UploadResult {
  /** Storage object key within the portfolio bucket. */
  path?: string;
  /** A human error message when the upload was rejected or failed. */
  error?: string;
}

function extensionFor(mimeType: string | null | undefined, uri: string): string {
  if (mimeType && EXT_BY_MIME[mimeType]) return EXT_BY_MIME[mimeType];
  const fromUri = uri.split("?")[0].split(".").pop()?.toLowerCase();
  if (fromUri && /^[a-z0-9]{2,5}$/.test(fromUri)) return fromUri;
  return "jpg";
}

/**
 * Read a local file URI into an ArrayBuffer. Returns null on any failure (an
 * empty read is treated as failure so we never upload a 0-byte object).
 */
async function readLocalFile(uri: string): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(uri);
    const buffer = await res.arrayBuffer();
    return buffer.byteLength > 0 ? buffer : null;
  } catch {
    return null;
  }
}

/** Resolve the signed-in user's id, or null when signed out. */
async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

/**
 * Core uploader: puts `uri`'s bytes at `{uid}/{objectName}` in the portfolio
 * bucket. `objectName` must NOT include the uid prefix — this adds it so the
 * storage RLS first-segment check always passes.
 */
async function uploadToOwnFolder(
  uri: string,
  objectName: string,
  mimeType: string | null | undefined,
): Promise<UploadResult> {
  const userId = await currentUserId();
  if (!userId) return { error: "Please sign in to upload." };

  const bytes = await readLocalFile(uri);
  if (!bytes) return { error: "Couldn't read that image — please try another." };
  if (bytes.byteLength > MAX_BYTES) {
    return { error: "That image is over 8 MB — please pick a smaller one." };
  }

  const contentType = mimeType && mimeType.startsWith("image/") ? mimeType : "image/jpeg";
  const path = `${userId}/${objectName}`;

  const { error } = await supabase.storage
    .from(PORTFOLIO_BUCKET)
    .upload(path, bytes, {
      cacheControl: "3600",
      contentType,
      upsert: false,
    });

  if (error) return { error: "Upload failed — please try again." };
  return { path };
}

/**
 * Upload a portfolio image picked from the camera roll / camera. Stored at
 * `{uid}/{uuid}.{ext}`, mirroring the web `uploadPortfolioImage` layout so the
 * same `registerPortfolioImages`-style row recording applies.
 */
export async function uploadPortfolioImage(
  uri: string,
  mimeType?: string | null,
): Promise<UploadResult> {
  const ext = extensionFor(mimeType, uri);
  return uploadToOwnFolder(uri, `${Crypto.randomUUID()}.${ext}`, mimeType);
}

/**
 * Upload a new avatar. Stored at `{uid}/avatar-{ts}.jpg` (timestamped so a new
 * avatar never collides with the old object and the public URL busts cache),
 * per the profile-editing spec. Returns the storage key for artists.avatar_path.
 */
export async function uploadAvatarImage(
  uri: string,
  mimeType?: string | null,
): Promise<UploadResult> {
  const ext = extensionFor(mimeType, uri);
  return uploadToOwnFolder(uri, `avatar-${Date.now()}.${ext}`, mimeType);
}
