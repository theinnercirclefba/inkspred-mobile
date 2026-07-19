/**
 * Thin wrappers around expo-image-picker for the profile editor. Permission is
 * requested lazily on first use; the Info.plist photo-library usage strings live
 * in app.json's infoPlist. Returns picked assets (uri + mimeType) or an empty
 * array when the user cancels / denies — never throws.
 */

import * as ImagePicker from "expo-image-picker";

/** A picked image asset, narrowed to the fields the uploader needs. */
export interface PickedImage {
  uri: string;
  mimeType: string | null;
}

/**
 * Pick a single image from the library, compressed to 0.8 quality. Returns null
 * on cancel / permission denial.
 */
export async function pickSingleImage(): Promise<PickedImage | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return null;

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsMultipleSelection: false,
    quality: 0.8,
  });
  if (result.canceled || result.assets.length === 0) return null;

  const asset = result.assets[0];
  return { uri: asset.uri, mimeType: asset.mimeType ?? null };
}

/**
 * Pick one or more images from the library (up to `limit`), compressed to 0.8
 * quality. Returns an empty array on cancel / permission denial.
 */
export async function pickMultipleImages(limit = 10): Promise<PickedImage[]> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return [];

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsMultipleSelection: true,
    selectionLimit: limit,
    quality: 0.8,
  });
  if (result.canceled || result.assets.length === 0) return [];

  return result.assets.map((a) => ({ uri: a.uri, mimeType: a.mimeType ?? null }));
}
