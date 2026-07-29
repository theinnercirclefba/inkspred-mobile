/**
 * App Store rating prompt — the single biggest lever on our star rating, and
 * therefore on ranking as "the #1 tattoo app". The whole trick is WHEN we ask:
 * only ever at a genuine peak-happiness moment (a booking just got confirmed, a
 * quote just got accepted), never after an error or a neutral tap.
 *
 * {@link maybeRequestReview} is heavily self-throttled so we never nag:
 *   - silent no-op if the native review prompt isn't available;
 *   - never asks twice within {@link MIN_DAYS_BETWEEN} days (Apple itself caps
 *     the prompt to ~3×/year, but we're stricter — a nagged user leaves 1★);
 *   - only asks once the user has hit at least {@link MIN_POSITIVE_EVENTS}
 *     genuinely positive moments, so a first-run tyre-kicker is never prompted.
 *
 * It NEVER throws — reviews are a nice-to-have and must never disrupt a happy
 * flow — so call sites can fire it and forget it.
 */
import * as StoreReview from "expo-store-review";
import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY_LAST_ASKED = "review:lastAskedAt";
const KEY_POSITIVE = "review:positiveCount";
const MIN_DAYS_BETWEEN = 90;
const MIN_POSITIVE_EVENTS = 1;
const DAY_MS = 86_400_000;

/**
 * Record a peak-happiness moment and, if the throttle allows, ask for a review.
 * Call ONLY from genuinely positive events (confirmed booking, accepted quote).
 */
export async function maybeRequestReview(): Promise<void> {
  try {
    if (!(await StoreReview.isAvailableAsync())) return;

    const now = Date.now();
    const last = Number((await AsyncStorage.getItem(KEY_LAST_ASKED)) ?? 0);
    if (last && now - last < MIN_DAYS_BETWEEN * DAY_MS) return;

    const positive = Number((await AsyncStorage.getItem(KEY_POSITIVE)) ?? 0) + 1;
    await AsyncStorage.setItem(KEY_POSITIVE, String(positive));
    if (positive < MIN_POSITIVE_EVENTS) return;

    await AsyncStorage.setItem(KEY_LAST_ASKED, String(now));
    await StoreReview.requestReview();
  } catch {
    // Never let a rating prompt disrupt a happy flow.
  }
}
