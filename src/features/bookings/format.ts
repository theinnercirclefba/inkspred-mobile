/**
 * Date formatting for the customer Bookings tab — the native mirror of
 * apps/web/app/(customer)/bookings/_lib/format.ts. Money formatting lives in
 * src/lib/money.ts (formatGBP); dates are formatted here so the two tabs read
 * identically to the web app.
 */

/** "Sat 18 Jul, 2:30pm" from an ISO datetime. */
export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const day = date.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  const time = date
    .toLocaleTimeString("en-GB", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
    .replace(/\s/g, "")
    .toLowerCase();
  return `${day}, ${time}`;
}

/** "18 Jul" / "18 Jul 2027" when the year differs from now. */
export function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  const sameYear = date.getFullYear() === now.getFullYear();
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}
