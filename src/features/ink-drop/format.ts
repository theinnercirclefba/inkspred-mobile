/**
 * Presentation helpers for Ink Drops — slot labels, savings copy and date
 * phrasing. Kept feature-local (no cross-import from the booking wizard) so the
 * Ink Drop surfaces read consistently on both the customer and artist sides.
 * Money is integer PENCE throughout; formatGBP does the currency rendering.
 */

import { formatGBP } from "../../lib/money";
import type { SlotType } from "./data";

/** Human slot label. For an "hours" drop, prefer the artist's free-text note. */
export function slotLabel(slotType: SlotType, hoursNote?: string | null): string {
  switch (slotType) {
    case "full_day":
      return "Full day";
    case "half_day":
      return "Half day";
    case "hours":
      return hoursNote?.trim() || "A few hours";
    default:
      return "Session";
  }
}

/** Short slot tag for compact chips ("Full day" / "Half day" / "Hours"). */
export function slotTag(slotType: SlotType): string {
  switch (slotType) {
    case "full_day":
      return "Full day";
    case "half_day":
      return "Half day";
    case "hours":
      return "Hours";
    default:
      return "Session";
  }
}

/** "Save £40" when there's a genuine markdown, else null. */
export function savingsLabel(
  normalPence: number | null | undefined,
  dropPence: number,
): string | null {
  if (normalPence == null || normalPence <= dropPence) return null;
  return `Save ${formatGBP(normalPence - dropPence)}`;
}

/** Whole-number discount percentage (e.g. 33), or null when there's none. */
export function savingsPercent(
  normalPence: number | null | undefined,
  dropPence: number,
): number | null {
  if (normalPence == null || normalPence <= dropPence || normalPence <= 0) {
    return null;
  }
  return Math.round(((normalPence - dropPence) / normalPence) * 100);
}

/** "Sat 26 Jul" from a yyyy-mm-dd drop date. */
export function formatDropDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

/** "Today" / "Tomorrow" / "In 4 days" / "Sat 26 Jul" — warm relative phrasing. */
export function relativeDropDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  const date = new Date(y, m - 1, d);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.round(
    (date.getTime() - today.getTime()) / 86_400_000,
  );
  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays < 7) return `In ${diffDays} days`;
  return formatDropDate(iso);
}

/** "· 2.3 mi" style distance suffix, or null when distance is unknown. */
export function distanceLabel(miles: number | null | undefined): string | null {
  if (miles == null || !Number.isFinite(miles)) return null;
  if (miles < 0.1) return "Here";
  if (miles < 10) return `${miles.toFixed(1)} mi`;
  return `${Math.round(miles)} mi`;
}
