/**
 * Money formatting — the platform stores money as integer pence and renders in
 * pounds sterling. Never "pay later"; InkSpred spreads the cost.
 */

/** "£120" for whole pounds, "£120.50" when there are pence. */
export function formatGBP(pence: number | null | undefined): string {
  if (pence === null || pence === undefined) return "—";
  const pounds = pence / 100;
  const hasPennies = pence % 100 !== 0;
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: hasPennies ? 2 : 0,
    maximumFractionDigits: hasPennies ? 2 : 0,
  }).format(pounds);
}

/** Compact follower counts: 522 -> "522", 12500 -> "12.5k". */
export function formatCompact(n: number | null | undefined): string | null {
  if (n === null || n === undefined) return null;
  if (n < 1000) return String(n);
  if (n < 1_000_000) {
    const k = n / 1000;
    return `${k % 1 === 0 ? k : k.toFixed(1)}k`;
  }
  const m = n / 1_000_000;
  return `${m % 1 === 0 ? m : m.toFixed(1)}m`;
}

/** Human deposit line, e.g. "£30 deposit" or "20% deposit". */
export function depositLabel(
  type: "fixed" | "percent",
  value: number,
): string | null {
  if (!value) return null;
  return type === "percent"
    ? `${value}% deposit`
    : `${formatGBP(value)} deposit`;
}
