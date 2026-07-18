/**
 * Booking-flow view model — the native mirror of the web booking wizard's
 * `_lib` (apps/web/app/(discover)/a/[handle]/book/_lib). Pure data: the draft
 * shape, the placement/size vocabularies and a dependency-free week builder for
 * the date picker. No React, no Supabase — kept small so the steps stay dumb.
 */

/** Body-size buckets shown as a single-choice on the piece step. */
export type SizeKey = "S" | "M" | "L" | "XL";

/**
 * How the customer would LIKE to pay once the artist confirms. This is a
 * preference only — nothing is charged from the app, and the request row has no
 * column for it, so it is never persisted. It shapes the review copy and lets
 * us set expectations honestly ("a preference, not a charge").
 */
export type PayPref = "deposit" | "plan" | "klarna";

export interface SizeOption {
  key: SizeKey;
  label: string;
  detail: string;
}

export interface BookingDraft {
  /** Chosen service id (a real services.id uuid), or null for a custom piece. */
  serviceId: string | null;
  /** Body placement, e.g. "Forearm". */
  placement: string | null;
  /** Size bucket. */
  size: SizeKey | null;
  /** Free-text brief — REQUIRED downstream (the DB column is NOT NULL). */
  description: string;
  /** Optional working budget the customer types, in whole pounds (UI only). */
  budgetPounds: string;
  /** Selected ISO dates (yyyy-mm-dd). */
  dates: string[];
  /** "Any date works" — an explicit alternative to picking days. */
  flexible: boolean;
  /** How they'd like to pay later — a preference, never a charge. */
  payPref: PayPref | null;
}

export const INITIAL_DRAFT: BookingDraft = {
  serviceId: null,
  placement: null,
  size: null,
  description: "",
  budgetPounds: "",
  dates: [],
  flexible: false,
  payPref: null,
};

/** Placement chips — mirrors the web PLACEMENTS list. */
export const PLACEMENTS: string[] = [
  "Forearm",
  "Upper arm",
  "Full sleeve",
  "Chest",
  "Back",
  "Ribs",
  "Thigh",
  "Calf",
  "Hand",
  "Neck",
];

/** Size options — mirrors the web SIZE_OPTIONS (labels + detail lines). */
export const SIZE_OPTIONS: SizeOption[] = [
  { key: "S", label: "Small", detail: "Palm-sized · 1–2 hrs" },
  { key: "M", label: "Medium", detail: "Hand-span · half a day" },
  { key: "L", label: "Large", detail: "Quarter sleeve · full day" },
  { key: "XL", label: "Extra large", detail: "Full sleeve or back · multi-session" },
];

/** Minimum characters for a usable brief (matches the web validation). */
export const MIN_DESCRIPTION = 10;

export function sizeLabel(key: SizeKey | null): string | null {
  if (!key) return null;
  return SIZE_OPTIONS.find((s) => s.key === key)?.label ?? null;
}

/* ── Dates ─────────────────────────────────────────────────────────────
 * Eight rows of Mon–Sun starting from the Monday of the current week. Today
 * and earlier are `isPast` (requests need at least a day's notice). Ported
 * from apps/web/.../book/_lib/dates.ts — no external date library.
 */

export interface DayOption {
  /** yyyy-mm-dd */
  iso: string;
  dayOfMonth: number;
  /** 0 = Sunday … 6 = Saturday */
  weekday: number;
  isWeekend: boolean;
  isPast: boolean;
}

export interface WeekRow {
  /** e.g. "w/c 6 Jul" */
  label: string;
  days: DayOption[];
}

function toIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function buildWeeks(from = new Date()): WeekRow[] {
  const today = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const monday = new Date(today);
  const offsetToMonday = (today.getDay() + 6) % 7; // getDay(): 0 = Sun
  monday.setDate(monday.getDate() - offsetToMonday);

  const weeks: WeekRow[] = [];
  for (let w = 0; w < 8; w++) {
    const days: DayOption[] = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(monday);
      date.setDate(monday.getDate() + w * 7 + d);
      const weekday = date.getDay();
      days.push({
        iso: toIso(date),
        dayOfMonth: date.getDate(),
        weekday,
        isWeekend: weekday === 0 || weekday === 6,
        isPast: date.getTime() <= today.getTime(),
      });
    }
    const first = new Date(monday);
    first.setDate(monday.getDate() + w * 7);
    weeks.push({
      label: `w/c ${first.getDate()} ${first.toLocaleDateString("en-GB", { month: "short" })}`,
      days,
    });
  }
  return weeks;
}

/** "Sat 11 Jul" from a yyyy-mm-dd string. */
export function formatIsoShort(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}
