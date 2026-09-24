import { EXAMPLES } from "./config";

export type DeepLink = {
  token: string | null;
  example: string | null;
};

/** Read ?token=0x… and/or ?example=DUKE from the current URL. */
export function readDeepLink(search = window.location.search): DeepLink {
  const params = new URLSearchParams(search);
  const tokenRaw = params.get("token")?.trim().toLowerCase() ?? null;
  const exampleRaw = params.get("example")?.trim().toUpperCase() ?? null;

  const token =
    tokenRaw && tokenRaw.startsWith("0x") && tokenRaw.length === 42
      ? tokenRaw
      : null;

  const exampleMatch = exampleRaw
    ? EXAMPLES.find((e) => e.label.toUpperCase() === exampleRaw)
    : undefined;

  // Prefer explicit token; else resolve example label → address
  if (token) {
    const known = EXAMPLES.find((e) => e.id.toLowerCase() === token);
    return {
      token,
      example: known?.label ?? (exampleMatch?.label ?? null),
    };
  }
  if (exampleMatch) {
    return { token: exampleMatch.id.toLowerCase(), example: exampleMatch.label };
  }
  return { token: null, example: null };
}

/** Build a shareable path+query for a focused token (prefer ?example= when known). */
export function buildShareUrl(tokenId: string): string {
  const id = tokenId.trim().toLowerCase();
  const known = EXAMPLES.find((e) => e.id.toLowerCase() === id);
  const url = new URL(window.location.href);
  url.search = "";
  if (known) {
    url.searchParams.set("example", known.label);
    url.searchParams.set("token", known.id.toLowerCase());
  } else {
    url.searchParams.set("token", id);
  }
  return url.pathname + url.search + url.hash;
}

/** Sync focus into the address bar without reload. */
export function replaceDeepLink(tokenId: string | null) {
  const url = new URL(window.location.href);
  if (!tokenId) {
    url.search = "";
    window.history.replaceState({}, "", url.pathname + url.hash);
    return;
  }
  const next = buildShareUrl(tokenId);
  window.history.replaceState({}, "", next);
}
