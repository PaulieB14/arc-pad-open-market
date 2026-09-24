import type { LifecycleRow } from "./graph";

const ZERO = "0x0000000000000000000000000000000000000000";

export type HookContinuity = "kept" | "legacy" | "diverged" | "unknown";

export function isZeroAddr(a: string | null | undefined): boolean {
  return !a || a.toLowerCase() === ZERO;
}

/** Pad hook survived onto the Uni tip pool? */
export function hookContinuity(row: LifecycleRow): HookContinuity {
  const { launch, tipPool } = row;
  if (launch.line === "legacy" || isZeroAddr(launch.hook)) {
    return "legacy";
  }
  if (!tipPool) return "unknown";
  if (isZeroAddr(tipPool.hooks)) return "legacy";
  if (
    launch.hook &&
    tipPool.hooks &&
    launch.hook.toLowerCase() === tipPool.hooks.toLowerCase()
  ) {
    return "kept";
  }
  if (tipPool.hooks) return "diverged";
  return "unknown";
}

export function hookContinuityLabel(c: HookContinuity): string {
  switch (c) {
    case "kept":
      return "Hook kept";
    case "legacy":
      return "Legacy / vanilla";
    case "diverged":
      return "Different hook";
    default:
      return "Unknown";
  }
}

export type JourneyStep = {
  id: string;
  label: string;
  detail: string;
  state: "done" | "active" | "pending" | "muted";
};

/** Status-step journey from real LifecycleRow fields (no invented timestamps). */
export function buildJourney(row: LifecycleRow): JourneyStep[] {
  const { launch, tipPool, tipToken } = row;
  const cont = hookContinuity(row);
  const tipVol = tipPool?.volumeUSD ?? tipToken?.volumeUSD;
  const hasOpenMarket =
    Boolean(tipPool) ||
    (tipVol != null && tipVol !== "" && Number(tipVol) > 0);

  return [
    {
      id: "pad",
      label: "Pad launch",
      detail: `${launch.symbol} · ${launch.line || "line?"} · ${launch.swapCount} pad swaps`,
      state: "done",
    },
    {
      id: "bonded",
      label: "Bonded / graduated",
      detail: launch.bonded
        ? `${launch.holderCount} holders · curve complete`
        : "Not bonded yet",
      state: launch.bonded ? "done" : "pending",
    },
    {
      id: "uni",
      label: "Open market (Uni)",
      detail: hasOpenMarket
        ? `fee ${tipPool?.feeTier ?? "—"} · ${tipPool?.txCount ?? tipToken?.txCount ?? "—"} txs`
        : "No Uni pool / volume yet",
      state: hasOpenMarket ? "done" : launch.bonded ? "active" : "pending",
    },
    {
      id: "hook",
      label: "Hook continuity",
      detail: hookContinuityLabel(cont),
      state:
        cont === "unknown"
          ? "muted"
          : cont === "kept"
            ? "done"
            : cont === "legacy"
              ? "muted"
              : "active",
    },
  ];
}
