import { useCallback, useEffect, useMemo, useState } from "react";
import {
  API_KEY_STORAGE,
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

function Card({ row }: { row: LifecycleRow }) {
  const { launch } = row;
  const tipVol = row.tipPool?.volumeUSD ?? row.tipToken?.volumeUSD;
  const hookKept =
    launch.hook &&
    row.tipPool?.hooks &&
    launch.hook.toLowerCase() === row.tipPool.hooks.toLowerCase();

  return (
    <article className="card">
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
            <div><dt>Pad volume</dt><dd>{formatUsdFromQuote(launch.volumeQuote)}</dd></div>
            <div><dt>Pad swaps</dt><dd>{formatInt(launch.swapCount)}</dd></div>
            <div><dt>Holders</dt><dd>{formatInt(launch.holderCount)}</dd></div>
            <div><dt>Pad hook</dt><dd className="mono">{shortAddr(launch.hook, 4)}</dd></div>
          </dl>
        </div>
        <div>
          <h3>Uni open market</h3>
          <dl>
            <div><dt>Pool / token vol (tip)</dt><dd>{formatUsd(tipVol)}</dd></div>
            <div><dt>Pool txs</dt><dd>{formatInt(row.tipPool?.txCount)}</dd></div>
            <div><dt>Fee tier</dt><dd>{row.tipPool?.feeTier ?? "—"}</dd></div>
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
  const [apiKey, setApiKey] = useState(() => localStorage.getItem(API_KEY_STORAGE) ?? "");
  const [draftKey, setDraftKey] = useState(apiKey);
  const [featured, setFeatured] = useState<LifecycleRow[]>([]);
  const [recent, setRecent] = useState<LifecycleRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [tokenLookup, setTokenLookup] = useState("");

  const saveKey = () => {
    const k = draftKey.trim();
    localStorage.setItem(API_KEY_STORAGE, k);
    setApiKey(k);
  };

  const load = useCallback(async () => {
    if (!apiKey.trim()) {
      setErr("Add a Graph Studio / gateway API key to query.");
      return;
    }
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

      // skip featured in recent table
      const featSet = new Set(ids.map((i) => i.toLowerCase()));
      const recentLaunches = bonded.filter((l) => !featSet.has(l.id.toLowerCase())).slice(0, 10);
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
    if (apiKey) void load();
  }, [apiKey, load]);

  const onLookup = async () => {
    const id = tokenLookup.trim().toLowerCase();
    if (!id.startsWith("0x") || id.length !== 42) {
      setErr("Paste a 0x token address (42 chars).");
      return;
    }
    if (!apiKey) return;
    setLoading(true);
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
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const tipBlock = useMemo(
    () => featured.find((r) => r.tipMeta)?.tipMeta?.block,
    [featured],
  );

  return (
    <div className="page">
      <header className="hero">
        <p className="eyebrow">Graphtronauts · Arc</p>
        <h1>Pad → Open Market</h1>
        <p className="lede">
          Live join of Argus launchpad lifecycle with Uniswap V4 Arc — including
          hook continuity and permission flags from the hooks-enhanced deploy.
        </p>
        <div className="meta-line">
          <span className="pill muted">Argus {shortAddr(ARGUS_SUBGRAPH_ID, 4)}</span>
          <span className="pill muted">Uni tip {shortAddr(UNI_ARC_SUBGRAPH_ID, 4)}</span>
          <span className="pill muted">Hooks IPFS {shortAddr(UNI_HOOKS_IPFS, 4)}</span>
          {tipBlock != null && <span className="pill">tip block {formatInt(tipBlock)}</span>}
        </div>
      </header>

      <section className="panel key-panel">
        <label>
          Graph gateway API key
          <input
            type="password"
            placeholder="Studio / gateway API key (stored only in this browser)"
            value={draftKey}
            onChange={(e) => setDraftKey(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && saveKey()}
          />
        </label>
        <div className="row">
          <button type="button" onClick={saveKey}>
            Save key
          </button>
          <button type="button" className="secondary" onClick={() => void load()} disabled={loading || !apiKey}>
            {loading ? "Loading…" : "Refresh"}
          </button>
        </div>
        <p className="hint">
          Key never leaves your browser except to gateway.thegraph.com. Create one in
          Subgraph Studio.
        </p>
      </section>

      <section className="panel lookup">
        <label>
          Paste a token address
          <input
            value={tokenLookup}
            onChange={(e) => setTokenLookup(e.target.value)}
            placeholder="0x…"
            onKeyDown={(e) => e.key === "Enter" && void onLookup()}
          />
        </label>
        <button type="button" onClick={() => void onLookup()} disabled={loading || !apiKey}>
          Lifecycle card
        </button>
      </section>

      {err && <p className="err banner">{err}</p>}

      <section>
        <h2 className="section-title">Featured</h2>
        <div className="cards">
          {featured.map((row) => (
            <Card key={row.launch.id} row={row} />
          ))}
          {!featured.length && !loading && (
            <p className="muted">Save an API key to load DUKE & ARGUS.</p>
          )}
        </div>
      </section>

      <section>
        <h2 className="section-title">Recent graduates</h2>
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
                  row.launch.hook.toLowerCase() === row.tipPool.hooks.toLowerCase();
                return (
                  <tr key={row.launch.id}>
                    <td>
                      <strong>{row.launch.symbol}</strong>
                      <div className="mono tiny">{shortAddr(row.launch.id, 4)}</div>
                    </td>
                    <td>
                      <span className={`pill line ${row.launch.line === "hooked" ? "hot" : "muted"}`}>
                        {row.launch.line}
                      </span>
                    </td>
                    <td>{formatUsdFromQuote(row.launch.volumeQuote)}</td>
                    <td>{formatUsd(row.tipPool?.volumeUSD ?? row.tipToken?.volumeUSD)}</td>
                    <td>{kept ? "yes" : row.launch.hook ? "check pool" : "n/a"}</td>
                    <td><HookFlags row={row} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <footer className="foot">
        Built for Graphtronauts · queries Argus + Uni V4 Arc on The Graph · not financial advice
      </footer>
    </div>
  );
}
