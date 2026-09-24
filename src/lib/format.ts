export function formatUsdFromQuote(raw: string | number | null | undefined, decimals = 6): string {
  if (raw == null || raw === "") return "—";
  const n = typeof raw === "string" ? Number(raw) : raw;
  if (!Number.isFinite(n)) return "—";
  return formatUsd(n / 10 ** decimals);
}

export function formatUsd(n: number | string | null | undefined): string {
  if (n == null || n === "") return "—";
  const v = typeof n === "string" ? Number(n) : n;
  if (!Number.isFinite(v)) return "—";
  if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (Math.abs(v) >= 1_000) return `$${(v / 1_000).toFixed(1)}k`;
  if (Math.abs(v) >= 1) return `$${v.toFixed(2)}`;
  return `$${v.toFixed(4)}`;
}

export function formatInt(n: number | string | null | undefined): string {
  if (n == null || n === "") return "—";
  const v = typeof n === "string" ? Number(n) : n;
  if (!Number.isFinite(v)) return "—";
  return new Intl.NumberFormat("en-US").format(v);
}

export function shortAddr(a: string | null | undefined, n = 4): string {
  if (!a) return "—";
  if (a === "0x0000000000000000000000000000000000000000") return "vanilla (0x0)";
  return `${a.slice(0, 2 + n)}…${a.slice(-n)}`;
}
