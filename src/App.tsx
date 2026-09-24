import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  API_KEY_STORAGE,
  EXAMPLES,
  FEATURED,
  UNI_ARC_SUBGRAPH_ID,
  UNI_HOOKS_IPFS,
  ARGUS_SUBGRAPH_ID,
} from "./lib/config";
import {
  buildLifecycleRow,
  fetchFeaturedLaunches,
  fetchRecentBonded,
  type LifecycleRow,
  normalizeGraphApiKey,
} from "./lib/graph";
import { formatInt, formatUsd, formatUsdFromQuote, shortAddr } from "./lib/format";
import {
  buildJourney,
  hookContinuity,
  hookContinuityLabel,
  type HookContinuity,
} from "./lib/lifecycle";
import { buildShareUrl, readDeepLink, replaceDeepLink } from "./lib/url";
import "./App.css";

const FLAG_TIPS: Record<string, string> = {
  "custom accounting":
    "Hook uses custom accounting — can adjust balances beyond vanilla swap math.",
  afterSwap: "afterSwap: runs after the core Uniswap V4 swap settles.",
  beforeSwap: "beforeSwap: runs before the core swap; can modify or gate the trade.",
  "Δ after": "afterSwapReturnsDelta: hook can return currency deltas after the swap.",
  "Δ before": "beforeSwapReturnsDelta: hook can return currency deltas before the swap.",
};

function readInitialApiKey(): string {
  const stored = localStorage.getItem(API_KEY_STORAGE) ?? "";
  if (stored.trim()) {
    const normalized = normalizeGraphApiKey(stored);
    // Rewrite dashed UUID keys so a refresh alone recovers from "malformed".
    if (normalized && normalized !== stored.trim()) {
      localStorage.setItem(API_KEY_STORAGE, normalized);
    }
    return normalized;
  }
  const fromEnv = import.meta.env.VITE_GRAPH_API_KEY;
  return typeof fromEnv === "string" ? normalizeGraphApiKey(fromEnv) : "";
}

function continuityClass(c: HookContinuity): string {
  if (c === "kept") return "hot";
  if (c === "legacy") return "muted";
  if (c === "diverged") return "";
  return "muted";
}

function HookFlags({ row }: { row: LifecycleRow }) {
  const h = row.hookEntity ?? row.hooksPool?.hook;
  if (!h) {
    if (row.launch.line === "legacy" || !row.launch.hook) {
      return <span className="pill muted">no pad hook</span>;
    }
    return (
      <span
        className="pill muted"
        title="Hooks-enhanced deploy may lag tip — flags appear once indexed."
      >
        hook flags on lagged deploy
      </span>
    );
  }
  const pills: { key: string; label: string; hot?: boolean }[] = [];
  if (h.hasCustomAccounting)
    pills.push({ key: "custom accounting", label: "custom accounting", hot: true });
  if (h.afterSwap) pills.push({ key: "afterSwap", label: "afterSwap" });
  if (h.beforeSwap) pills.push({ key: "beforeSwap", label: "beforeSwap" });
  if (h.afterSwapReturnsDelta) pills.push({ key: "Δ after", label: "Δ after" });
  if (h.beforeSwapReturnsDelta) pills.push({ key: "Δ before", label: "Δ before" });

  return (
    <div className="flags">
      {pills.map((p) => (
        <span
          key={p.key}
          className={`pill${p.hot ? " hot" : ""}`}
          title={FLAG_TIPS[p.key]}
        >
          {p.label}
        </span>
      ))}
      <span className="pill muted" title="Bitmap of enabled hook permissions">
        perms {h.permissions}
      </span>
    </div>
  );
}

function JourneyTimeline({ row }: { row: LifecycleRow }) {
  const steps = buildJourney(row);
  return (
    <div className="journey" aria-label={`${row.launch.symbol} journey`}>
      <div className="journey-head">
        <h3>Journey</h3>
        <span className="pill muted">{row.launch.symbol}</span>
      </div>
      <ol className="journey-strip">
        {steps.map((step, i) => (
          <li key={step.id} className={`journey-step ${step.state}`}>
            <div className="journey-dot" aria-hidden />
            {i < steps.length - 1 && <div className="journey-line" aria-hidden />}
            <div className="journey-body">
              <span className="journey-label">{step.label}</span>
              <span className="journey-detail">{step.detail}</span>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

function CompareHero({
  duke,
  argus,
  onFocus,
}: {
  duke: LifecycleRow | undefined;
  argus: LifecycleRow | undefined;
  onFocus: (id: string) => void;
}) {
  if (!duke && !argus) return null;

  const cols: { key: string; row: LifecycleRow; story: string; accent: string }[] =
    [];
  if (duke) {
    cols.push({
      key: "duke",
      row: duke,
      story: "Pad hook kept on Uni — hook continuity across graduation.",
      accent: "kept",
    });
  }
  if (argus) {
    cols.push({
      key: "argus",
      row: argus,
      story: "Legacy line → vanilla Uni books (no pad hook on the open market).",
      accent: "legacy",
    });
  }

  return (
    <section className="panel compare-hero">
      <div className="compare-head">
        <div>
          <p className="eyebrow">Hero teaching moment</p>
          <h2 className="panel-title">DUKE vs ARGUS</h2>
          <p className="explain-copy">
            Same pad → open-market join, two endings.{" "}
            <strong>DUKE</strong> keeps the pad hook on Uniswap;{" "}
            <strong>ARGUS</strong> is the legacy line that lands on vanilla Uni
            books.
          </p>
        </div>
      </div>
      <div className={`compare-grid cols-${cols.length}`}>
        {cols.map(({ key, row, story, accent }) => {
          const cont = hookContinuity(row);
          const tipVol = row.tipPool?.volumeUSD ?? row.tipToken?.volumeUSD;
          return (
            <button
              key={key}
              type="button"
              className={`compare-card accent-${accent}`}
              onClick={() => onFocus(row.launch.id)}
            >
              <div className="compare-card-top">
                <h3>{row.launch.symbol}</h3>
                <span className={`pill line ${row.launch.line === "hooked" ? "hot" : "muted"}`}>
                  {row.launch.line || "—"}
                </span>
              </div>
              <p className="compare-story">{story}</p>
              <dl className="compare-metrics">
                <div>
                  <dt>Pad vol</dt>
                  <dd>{formatUsdFromQuote(row.launch.volumeQuote)}</dd>
                </div>
                <div>
                  <dt>Uni tip vol</dt>
                  <dd>{formatUsd(tipVol)}</dd>
                </div>
                <div>
                  <dt>Hook kept</dt>
                  <dd>
                    <span className={`pill ${continuityClass(cont)}`}>
                      {cont === "kept" ? "yes" : cont === "legacy" ? "no · legacy" : cont}
                    </span>
                  </dd>
                </div>
                <div>
                  <dt>Line type</dt>
                  <dd className="mono">{row.launch.line || "—"}</dd>
                </div>
              </dl>
              <span className="compare-cta">Focus lifecycle →</span>
            </button>
          );
        })}
      </div>
      {(!duke || !argus) && (
        <p className="hint">
          Loading both featured tokens for the full side-by-side…
        </p>
      )}
    </section>
  );
}

function Card({
  row,
  selected,
  cardRef,
  onCopyLink,
  copyState,
}: {
  row: LifecycleRow;
  selected?: boolean;
  cardRef?: (el: HTMLElement | null) => void;
  onCopyLink?: () => void;
  copyState?: "idle" | "copied" | "error";
}) {
  const { launch } = row;
  const tipVol = row.tipPool?.volumeUSD ?? row.tipToken?.volumeUSD;
  const cont = hookContinuity(row);

  return (
    <article className={`card${selected ? " selected" : ""}`} ref={cardRef}>
      <header>
        <div>
          <h2>{launch.symbol}</h2>
          <p className="sub">{launch.name || shortAddr(launch.id, 6)}</p>
        </div>
        <div className="card-actions">
          {selected && onCopyLink && (
            <button
              type="button"
              className="ghost-btn"
              onClick={(e) => {
                e.stopPropagation();
                onCopyLink();
              }}
              title={buildShareUrl(launch.id)}
            >
              {copyState === "copied"
                ? "Copied"
                : copyState === "error"
                  ? "Copy failed"
                  : "Copy link"}
            </button>
          )}
          <span className={`pill line ${launch.line === "hooked" ? "hot" : "muted"}`}>
            {launch.line || "—"}
          </span>
        </div>
      </header>

      {selected && <JourneyTimeline row={row} />}

      <div className="grid2">
        <div>
          <h3>Argus pad</h3>
          <dl>
            <div>
              <dt>Pad volume</dt>
              <dd>{formatUsdFromQuote(launch.volumeQuote)}</dd>
            </div>
            <div>
              <dt>Pad swaps</dt>
              <dd>{formatInt(launch.swapCount)}</dd>
            </div>
            <div>
              <dt>Holders</dt>
              <dd>{formatInt(launch.holderCount)}</dd>
            </div>
            <div>
              <dt>Pad hook</dt>
              <dd className="mono">{shortAddr(launch.hook, 4)}</dd>
            </div>
          </dl>
        </div>
        <div>
          <h3>Uni open market</h3>
          <dl>
            <div>
              <dt>Pool / token vol (tip)</dt>
              <dd>{formatUsd(tipVol)}</dd>
            </div>
            <div>
              <dt>Pool txs</dt>
              <dd>{formatInt(row.tipPool?.txCount)}</dd>
            </div>
            <div>
              <dt>Fee tier</dt>
              <dd>{row.tipPool?.feeTier ?? "—"}</dd>
            </div>
            <div>
              <dt>Hook continuity</dt>
              <dd>
                <span className={`pill ${continuityClass(cont)}`}>
                  {hookContinuityLabel(cont)}
                </span>
              </dd>
            </div>
          </dl>
        </div>
      </div>

      <div className="hook-row">
        <h3>Hooks schema</h3>
        <HookFlags row={row} />
        {row.hooksMeta && <p className="hint">{row.hooksMeta.lagNote}</p>}
      </div>

      {row.error && <p className="err">{row.error}</p>}
      <p className="mono tiny">{launch.id}</p>
    </article>
  );
}

export default function App() {
  const [apiKey, setApiKey] = useState(readInitialApiKey);
  const [draftKey, setDraftKey] = useState(apiKey);
  const [featured, setFeatured] = useState<LifecycleRow[]>([]);
  const [recent, setRecent] = useState<LifecycleRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [tokenLookup, setTokenLookup] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");
  const selectedCardEl = useRef<HTMLElement | null>(null);
  const deepLinkHandled = useRef(false);
  const pendingDeepLink = useRef<string | null>(null);

  const demoMode = !apiKey.trim();

  const saveKey = () => {
    const k = normalizeGraphApiKey(draftKey);
    setDraftKey(k);
    localStorage.setItem(API_KEY_STORAGE, k);
    setApiKey(k);
  };

  const clearKey = () => {
    localStorage.removeItem(API_KEY_STORAGE);
    setDraftKey("");
    setApiKey("");
  };

  const focusToken = useCallback((id: string, opts?: { scroll?: boolean }) => {
    const normalized = id.trim().toLowerCase();
    setSelectedId(normalized);
    setTokenLookup(normalized);
    replaceDeepLink(normalized);
    setCopyState("idle");
    if (opts?.scroll !== false) {
      requestAnimationFrame(() => {
        selectedCardEl.current?.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
        });
      });
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const ids = FEATURED.map((f) => f.id);
      const [featLaunches, bonded] = await Promise.all([
        fetchFeaturedLaunches(apiKey, ids),
        fetchRecentBonded(apiKey, 12),
      ]);
      const byId = new Map(featLaunches.map((l) => [l.id.toLowerCase(), l]));
      const ordered = ids
        .map((id) => byId.get(id.toLowerCase()))
        .filter(Boolean) as typeof featLaunches;

      const featRows = await Promise.all(
        ordered.map((l) => buildLifecycleRow(apiKey, l)),
      );
      setFeatured(featRows);

      const featSet = new Set(ids.map((i) => i.toLowerCase()));
      const recentLaunches = bonded
        .filter((l) => !featSet.has(l.id.toLowerCase()))
        .slice(0, 10);
      const recentRows: LifecycleRow[] = [];
      for (const l of recentLaunches) {
        recentRows.push(await buildLifecycleRow(apiKey, l));
      }
      setRecent(recentRows);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [apiKey]);

  useEffect(() => {
    void load();
  }, [load]);

  // Capture deep link once on mount
  useEffect(() => {
    const link = readDeepLink();
    if (link.token) {
      pendingDeepLink.current = link.token;
      setSelectedId(link.token);
      setTokenLookup(link.token);
    }
  }, []);

  const runLookup = useCallback(
    async (rawId: string, opts?: { fromDeepLink?: boolean }) => {
      const id = rawId.trim().toLowerCase();
      if (!id.startsWith("0x") || id.length !== 42) {
        setErr("Paste a 0x token address (42 chars).");
        return;
      }
      focusToken(id, { scroll: !opts?.fromDeepLink });
      setLookupLoading(true);
      setErr(null);
      try {
        const launches = await fetchFeaturedLaunches(apiKey, [id]);
        if (!launches.length) {
          setErr("No Argus launch for that address.");
          return;
        }
        const row = await buildLifecycleRow(apiKey, launches[0]);
        setFeatured((prev) => {
          const rest = prev.filter((r) => r.launch.id.toLowerCase() !== id);
          return [row, ...rest];
        });
        if (!opts?.fromDeepLink) {
          requestAnimationFrame(() => {
            selectedCardEl.current?.scrollIntoView({
              behavior: "smooth",
              block: "nearest",
            });
          });
        }
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e));
      } finally {
        setLookupLoading(false);
      }
    },
    [apiKey, focusToken],
  );

  // After featured load, honor pending deep link (select existing or fetch)
  useEffect(() => {
    if (deepLinkHandled.current) return;
    if (loading) return;
    const pending = pendingDeepLink.current;
    if (!pending) {
      deepLinkHandled.current = true;
      return;
    }
    deepLinkHandled.current = true;
    const existing = featured.find(
      (r) => r.launch.id.toLowerCase() === pending,
    );
    if (existing) {
      focusToken(pending, { scroll: true });
      return;
    }
    void runLookup(pending, { fromDeepLink: true });
  }, [loading, featured, focusToken, runLookup]);

  const onLookup = () => void runLookup(tokenLookup);

  const onCopyLink = useCallback(async () => {
    if (!selectedId) return;
    const share = new URL(buildShareUrl(selectedId), window.location.origin).href;
    try {
      await navigator.clipboard.writeText(share);
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 1800);
    } catch {
      setCopyState("error");
      window.setTimeout(() => setCopyState("idle"), 1800);
    }
  }, [selectedId]);

  const tipBlock = useMemo(
    () => featured.find((r) => r.tipMeta)?.tipMeta?.block,
    [featured],
  );

  const selectedRow = useMemo(
    () =>
      selectedId
        ? featured.find((r) => r.launch.id.toLowerCase() === selectedId.toLowerCase())
        : undefined,
    [featured, selectedId],
  );

  const dukeRow = useMemo(
    () =>
      featured.find(
        (r) =>
          r.launch.id.toLowerCase() ===
          "0x41358defd0dedc90528b3f1835715e907b686e6a",
      ),
    [featured],
  );
  const argusRow = useMemo(
    () =>
      featured.find(
        (r) =>
          r.launch.id.toLowerCase() ===
          "0xece5ca8bf9220718e5727754026757512212cb3c",
      ),
    [featured],
  );

  const busy = loading || lookupLoading;
  const showOnboarding = !featured.length && !busy;

  return (
    <div className="page">
      <header className="hero">
        <p className="eyebrow">Graphtronauts · Arc</p>
        <h1>Pad → Open Market</h1>
        <p className="lede">
          Follow a token from Argus launchpad graduation into Uniswap V4 Arc —
          pad status, hook continuity, and open-market volume in one join story.
        </p>
        <div className="meta-line">
          {demoMode ? (
            <span className="pill hot">demo mode · shared proxy</span>
          ) : (
            <span className="pill">your Studio key</span>
          )}
          <span className="pill muted">Argus {shortAddr(ARGUS_SUBGRAPH_ID, 4)}</span>
          <span className="pill muted">Uni tip {shortAddr(UNI_ARC_SUBGRAPH_ID, 4)}</span>
          <span className="pill muted">Hooks IPFS {shortAddr(UNI_HOOKS_IPFS, 4)}</span>
          {tipBlock != null && (
            <span className="pill">tip block {formatInt(tipBlock)}</span>
          )}
        </div>
      </header>

      <section className="panel explain">
        <h2 className="panel-title">What am I looking at?</h2>
        <p className="explain-copy">
          Each card joins three Graph sources: <strong>Argus</strong> (bonded /
          pad hook / pad volume), <strong>Uni V4 Arc tip</strong> (live pool
          volume + <code>Pool.hooks</code>), and a lagged{" "}
          <strong>hooks-enhanced</strong> deploy (permission flags, custom
          accounting). Click an example to load the story instantly — no key
          required in demo mode. Share any focus with{" "}
          <code>?example=DUKE</code> or <code>?token=0x…</code>.
        </p>
      </section>

      <CompareHero
        duke={dukeRow}
        argus={argusRow}
        onFocus={(id) => void runLookup(id)}
      />

      <section className="panel key-panel">
        <label>
          Graph gateway API key <span className="optional">(optional)</span>
          <input
            type="password"
            placeholder="Leave blank for demo mode — or paste your Studio key"
            value={draftKey}
            onChange={(e) => setDraftKey(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && saveKey()}
          />
        </label>
        <div className="row">
          <button type="button" onClick={saveKey}>
            {draftKey.trim() ? "Save key" : "Use demo mode"}
          </button>
          {!demoMode && (
            <button type="button" className="secondary" onClick={clearKey}>
              Clear key
            </button>
          )}
          <button
            type="button"
            className="secondary"
            onClick={() => void load()}
            disabled={busy}
          >
            {loading ? "Loading…" : "Refresh all"}
          </button>
        </div>
        <p className="hint">
          Leave blank for demo mode — no key needed. If you paste a Studio key, use the
          key alone (not a full URL). UUID keys with dashes are fine; we strip
          them for the gateway. Keys stay in this browser only.
        </p>
      </section>

      <section className="panel try-panel">
        <div className="try-head">
          <div>
            <h2 className="panel-title">Try these</h2>
            <p className="hint tight">
              One click loads a real bonded graduate and runs the pad → open
              market join. URL updates for sharing.
            </p>
          </div>
          {lookupLoading && <span className="pill hot">Looking up…</span>}
        </div>
        <div className="example-grid" role="list">
          {EXAMPLES.map((ex) => {
            const active =
              selectedId?.toLowerCase() === ex.id.toLowerCase() ||
              tokenLookup.trim().toLowerCase() === ex.id.toLowerCase();
            return (
              <button
                key={ex.id}
                type="button"
                role="listitem"
                className={`example-chip${active ? " active" : ""}`}
                disabled={busy}
                onClick={() => void runLookup(ex.id)}
                title={ex.id}
              >
                <span className="example-label">{ex.label}</span>
                <span className="example-tag">{ex.tag}</span>
                <span className="example-blurb">{ex.blurb}</span>
                <span className="example-addr mono">{shortAddr(ex.id, 4)}</span>
              </button>
            );
          })}
        </div>

        <div className="lookup">
          <label>
            Or paste your own token
            <input
              value={tokenLookup}
              onChange={(e) => setTokenLookup(e.target.value)}
              placeholder="0x… bonded Argus token address"
              onKeyDown={(e) => e.key === "Enter" && onLookup()}
            />
          </label>
          <button type="button" onClick={onLookup} disabled={busy}>
            {lookupLoading ? "Loading…" : "Load lifecycle"}
          </button>
        </div>
      </section>

      {err && <p className="err banner">{err}</p>}

      {showOnboarding && (
        <section className="panel onboarding">
          <h2 className="panel-title">Start the join story</h2>
          <p className="explain-copy">
            Tokens graduate from the Argus bonding curve onto Uniswap V4 Arc.
            This pad joins those two worlds so you can see whether the pad hook
            survived, and how much open-market volume followed. Click{" "}
            <strong>DUKE</strong> or <strong>ARGUS</strong> above — demo mode
            works with no key.
          </p>
        </section>
      )}

      <section>
        <div className="section-head">
          <h2 className="section-title">Lifecycle cards</h2>
          {selectedRow && (
            <span className="pill hot">Focus: {selectedRow.launch.symbol}</span>
          )}
        </div>
        <div className="cards">
          {featured.map((row) => {
            const isSelected =
              selectedId?.toLowerCase() === row.launch.id.toLowerCase();
            return (
              <Card
                key={row.launch.id}
                row={row}
                selected={isSelected}
                onCopyLink={isSelected ? onCopyLink : undefined}
                copyState={isSelected ? copyState : undefined}
                cardRef={
                  isSelected
                    ? (el) => {
                        selectedCardEl.current = el;
                      }
                    : undefined
                }
              />
            );
          })}
          {!featured.length && !busy && (
            <p className="muted empty-hint">
              No cards yet — click a Try these example to auto-run the lookup.
            </p>
          )}
          {busy && !featured.length && (
            <p className="muted empty-hint">Fetching pad → open market…</p>
          )}
        </div>
      </section>

      <section>
        <h2 className="section-title">Recent graduates</h2>
        <p className="hint tight section-hint">
          Latest bonded launches (excluding the examples above). Click a row to
          load its lifecycle card.
        </p>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Token</th>
                <th>Line</th>
                <th>Pad vol</th>
                <th>Uni tip vol</th>
                <th>Hook kept</th>
                <th>Flags</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((row) => {
                const cont = hookContinuity(row);
                return (
                  <tr
                    key={row.launch.id}
                    className="clickable-row"
                    onClick={() => void runLookup(row.launch.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        void runLookup(row.launch.id);
                      }
                    }}
                    tabIndex={0}
                    title="Load lifecycle card"
                  >
                    <td>
                      <strong>{row.launch.symbol}</strong>
                      <div className="mono tiny">
                        {shortAddr(row.launch.id, 4)}
                      </div>
                    </td>
                    <td>
                      <span
                        className={`pill line ${
                          row.launch.line === "hooked" ? "hot" : "muted"
                        }`}
                      >
                        {row.launch.line}
                      </span>
                    </td>
                    <td>{formatUsdFromQuote(row.launch.volumeQuote)}</td>
                    <td>
                      {formatUsd(
                        row.tipPool?.volumeUSD ?? row.tipToken?.volumeUSD,
                      )}
                    </td>
                    <td>
                      {cont === "kept"
                        ? "yes"
                        : cont === "legacy"
                          ? "n/a"
                          : cont === "diverged"
                            ? "check pool"
                            : "—"}
                    </td>
                    <td>
                      <HookFlags row={row} />
                    </td>
                  </tr>
                );
              })}
              {!recent.length && !busy && (
                <tr>
                  <td colSpan={6} className="muted">
                    No recent graduates loaded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <footer className="foot">
        Built for Graphtronauts · queries Argus + Uni V4 Arc on The Graph · not
        financial advice
      </footer>
    </div>
  );
}
