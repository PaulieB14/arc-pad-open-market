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
} from "./lib/graph";
import { formatInt, formatUsd, formatUsdFromQuote, shortAddr } from "./lib/format";
import "./App.css";

function readInitialApiKey(): string {
  const stored = localStorage.getItem(API_KEY_STORAGE) ?? "";
  if (stored.trim()) return stored.trim();
  const fromEnv = import.meta.env.VITE_GRAPH_API_KEY;
  return typeof fromEnv === "string" ? fromEnv.trim() : "";
}

function HookFlags({ row }: { row: LifecycleRow }) {
  const h = row.hookEntity ?? row.hooksPool?.hook;
  if (!h) {
    if (row.launch.line === "legacy" || !row.launch.hook) {
      return <span className="pill muted">no pad hook</span>;
    }
    return <span className="pill muted">hook flags on lagged deploy</span>;
  }
  return (
    <div className="flags">
      {h.hasCustomAccounting && <span className="pill hot">custom accounting</span>}
      {h.afterSwap && <span className="pill">afterSwap</span>}
      {h.beforeSwap && <span className="pill">beforeSwap</span>}
      {h.afterSwapReturnsDelta && <span className="pill">Δ after</span>}
      {h.beforeSwapReturnsDelta && <span className="pill">Δ before</span>}
      <span className="pill muted">perms {h.permissions}</span>
    </div>
  );
}

function Card({
  row,
  selected,
  cardRef,
}: {
  row: LifecycleRow;
  selected?: boolean;
  cardRef?: (el: HTMLElement | null) => void;
}) {
  const { launch } = row;
  const tipVol = row.tipPool?.volumeUSD ?? row.tipToken?.volumeUSD;
  const hookKept =
    launch.hook &&
    row.tipPool?.hooks &&
    launch.hook.toLowerCase() === row.tipPool.hooks.toLowerCase();

  return (
    <article className={`card${selected ? " selected" : ""}`} ref={cardRef}>
      <header>
        <div>
          <h2>{launch.symbol}</h2>
          <p className="sub">{launch.name || shortAddr(launch.id, 6)}</p>
        </div>
        <span className={`pill line ${launch.line === "hooked" ? "hot" : "muted"}`}>
          {launch.line || "—"}
        </span>
      </header>

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
                {hookKept === true && <span className="pill hot">pad hook kept</span>}
                {hookKept === false && row.tipPool?.hooks && (
                  <span className="pill muted">pool {shortAddr(row.tipPool.hooks)}</span>
                )}
                {!row.tipPool && <span className="muted">no pool yet</span>}
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
  const selectedCardEl = useRef<HTMLElement | null>(null);

  const demoMode = !apiKey.trim();

  const saveKey = () => {
    const k = draftKey.trim();
    localStorage.setItem(API_KEY_STORAGE, k);
    setApiKey(k);
  };

  const clearKey = () => {
    localStorage.removeItem(API_KEY_STORAGE);
    setDraftKey("");
    setApiKey("");
  };

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

  const runLookup = useCallback(
    async (rawId: string) => {
      const id = rawId.trim().toLowerCase();
      if (!id.startsWith("0x") || id.length !== 42) {
        setErr("Paste a 0x token address (42 chars).");
        return;
      }
      setTokenLookup(id);
      setSelectedId(id);
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
        requestAnimationFrame(() => {
          selectedCardEl.current?.scrollIntoView({
            behavior: "smooth",
            block: "nearest",
          });
        });
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e));
      } finally {
        setLookupLoading(false);
      }
    },
    [apiKey],
  );

  const onLookup = () => void runLookup(tokenLookup);

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
          required in demo mode.
        </p>
      </section>

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
          Demo mode hits an allowlisted <code>/api/graphql</code> proxy (no paste
          needed). Your own key talks to gateway.thegraph.com with your Studio
          quota and stays in this browser only.
        </p>
      </section>

      <section className="panel try-panel">
        <div className="try-head">
          <div>
            <h2 className="panel-title">Try these</h2>
            <p className="hint tight">
              One click loads a real bonded graduate and runs the pad → open
              market join.
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
                const kept =
                  row.launch.hook &&
                  row.tipPool?.hooks &&
                  row.launch.hook.toLowerCase() ===
                    row.tipPool.hooks.toLowerCase();
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
                      {kept ? "yes" : row.launch.hook ? "check pool" : "n/a"}
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
