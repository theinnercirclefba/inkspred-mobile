/**
 * Pure formatting / parsing helpers for the artist-profile editor. Kept
 * dependency-free and platform-agnostic so they can be unit-reasoned in
 * isolation and reused across the hub / services / availability screens.
 *
 * Money is always integer PENCE. Durations are stored as whole minutes.
 */

/** The canonical style vocabulary, mirroring web's STYLE_OPTIONS. */
export const STYLE_OPTIONS: readonly string[] = [
  "Blackwork",
  "Fine-line",
  "Neo-traditional",
  "Realism",
  "Japanese",
  "Dotwork",
  "Colour",
  "Geometric",
  "Script",
  "Traditional",
];

/**
 * Best-effort parse of a free-text duration label into whole minutes — a direct
 * port of parseDurationMinutes in apps/web/lib/data/onboarding.ts. Handles
 * "2 h", "1.5 h", "3–4 h" (upper bound), "90 min", "1h30". Falls back to 120.
 */
export function parseDurationMinutes(label: string): number {
  const text = label.toLowerCase().replace(",", ".");

  const minOnly = text.match(/(\d+(?:\.\d+)?)\s*m(?:in)?\b/);
  const hourMatch = text.match(/(\d+(?:\.\d+)?)\s*h/);

  if (hourMatch) {
    const hourNums = Array.from(text.matchAll(/(\d+(?:\.\d+)?)/g)).map((m) =>
      Number.parseFloat(m[1]),
    );
    const hours =
      hourNums.length > 0 ? Math.max(...hourNums) : Number.parseFloat(hourMatch[1]);
    const trailing = text.match(/h\s*(\d{1,2})\b/);
    const extraMin = trailing ? Number.parseInt(trailing[1], 10) : 0;
    const total = Math.round(Number.isFinite(hours) ? hours * 60 + extraMin : 120);
    return total > 0 ? total : 120;
  }

  if (minOnly) {
    const mins = Math.round(Number.parseFloat(minOnly[1]));
    return mins > 0 ? mins : 120;
  }

  const bare = text.match(/(\d+(?:\.\d+)?)/);
  if (bare) {
    const n = Number.parseFloat(bare[1]);
    const mins = Math.round(n * 60);
    return mins > 0 ? mins : 120;
  }

  return 120;
}

/** Render whole minutes back into a compact human label: 90 → "1 h 30 min". */
export function minutesToLabel(mins: number): string {
  if (!Number.isFinite(mins) || mins <= 0) return "—";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}

/**
 * Parse a pounds string ("120", "120.50", "£120") to integer pence. Returns
 * null when it isn't a valid non-negative amount.
 */
export function poundsToPence(input: string): number | null {
  const cleaned = input.replace(/[£,\s]/g, "").trim();
  if (cleaned.length === 0) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const pounds = Number.parseFloat(cleaned);
  if (!Number.isFinite(pounds) || pounds < 0) return null;
  return Math.round(pounds * 100);
}

/** Pence → an editable pounds string ("12000" → "120", "12050" → "120.50"). */
export function penceToPoundsInput(pence: number | null | undefined): string {
  if (pence === null || pence === undefined) return "";
  const pounds = pence / 100;
  return pence % 100 === 0 ? String(pounds) : pounds.toFixed(2);
}

/** Strip a leading @ and surrounding whitespace from a social handle. */
export function stripHandle(input: string): string {
  return input.trim().replace(/^@+/, "");
}

/**
 * Sanitise a TikTok username to the DB check (`^[a-zA-Z0-9_.]{1,30}$`): drop the
 * leading @, remove disallowed characters and clamp to 30 chars. Empty → null.
 * Keeps the native write from ever tripping the 23514 check-constraint.
 */
export function sanitizeTiktok(input: string): string | null {
  const cleaned = stripHandle(input).replace(/[^a-zA-Z0-9_.]/g, "").slice(0, 30);
  return cleaned.length > 0 ? cleaned : null;
}

/** Instagram has no DB format check — just strip @ / whitespace. Empty → null. */
export function sanitizeInstagram(input: string): string | null {
  const cleaned = stripHandle(input).slice(0, 60);
  return cleaned.length > 0 ? cleaned : null;
}

/* ── Weekday + time helpers (availability) ───────────────────────────── */

/** Weekday indexes 0 = Sunday … 6 = Saturday, displayed Monday-first. */
export interface WeekdayMeta {
  /** DB weekday index (0 = Sun … 6 = Sat). */
  index: number;
  /** Short label, e.g. "Mon". */
  short: string;
  /** Full label, e.g. "Monday". */
  long: string;
}

export const WEEKDAYS_MONDAY_FIRST: readonly WeekdayMeta[] = [
  { index: 1, short: "Mon", long: "Monday" },
  { index: 2, short: "Tue", long: "Tuesday" },
  { index: 3, short: "Wed", long: "Wednesday" },
  { index: 4, short: "Thu", long: "Thursday" },
  { index: 5, short: "Fri", long: "Friday" },
  { index: 6, short: "Sat", long: "Saturday" },
  { index: 0, short: "Sun", long: "Sunday" },
];

/**
 * Every quarter-hour clock label across the working span (08:00 … 22:00), used
 * to populate the open/close pickers. Stored/compared as "HH:MM:SS" to match the
 * Postgres `time` columns, but displayed as "HH:MM".
 */
export function quarterHourSlots(
  firstHour = 8,
  lastHour = 22,
): { value: string; label: string }[] {
  const out: { value: string; label: string }[] = [];
  for (let h = firstHour; h <= lastHour; h += 1) {
    for (let m = 0; m < 60; m += 15) {
      if (h === lastHour && m > 0) break;
      const hh = String(h).padStart(2, "0");
      const mm = String(m).padStart(2, "0");
      out.push({ value: `${hh}:${mm}:00`, label: `${hh}:${mm}` });
    }
  }
  return out;
}

/** Normalise a stored time ("11:00:00" or "11:00") to a "HH:MM" display label. */
export function timeDisplay(raw: string | null | undefined): string {
  if (!raw) return "";
  const [h = "00", m = "00"] = raw.split(":");
  return `${h.padStart(2, "0")}:${m.padStart(2, "0")}`;
}

/** Normalise a stored/display time to the "HH:MM:SS" the `time` column wants. */
export function toDbTime(raw: string): string {
  const parts = raw.split(":");
  const h = (parts[0] ?? "00").padStart(2, "0");
  const m = (parts[1] ?? "00").padStart(2, "0");
  return `${h}:${m}:00`;
}
