# Pad → Open Market (Arc)

Live **Argus launchpad → Uniswap V4 Arc** lifecycle cards for Graphtronauts.

Joins:

- **Argus** subgraph `JBG4rStwjXA3XbD8K4NVJddcjPMGpNgsQPNm3KZdD2GW` — bonded / line / pad hook / pad volume
- **Uni V4 Arc (tip)** `7xLobfNG9xx8yM5hkxagRuPmdjCJP4Kj9vtomrn9LrRM` — open-market volume, `Pool.hooks` string
- **Uni V4 Arc hooks IPFS** `Qmdyx7tqmQzyQu7viYqqfE3oNYs8EtxhcPs1VHBfXi7p2p` — `Hook` entity, permission flags, custom accounting (may lag tip)

**Try these** one-click demos: **DUKE** (hook continuity), **ARGUS** (legacy → vanilla Uni), plus bonded grads **REGI**, **AQUA**, and **WICKET**.

## Run locally

```bash
npm install
npm run dev
```

Without a key, the UI runs in **demo mode** and calls `/api/graphql` (needs `GRAPH_STUDIO_API_KEY` on the host — use `vercel dev` or deploy). Or paste a Subgraph Studio / gateway key in the UI (stored in `localStorage` only); that path hits the gateway with your quota.

```bash
npm run build
npm run preview
```

## Deploy (Vercel)

1. Connect the repo — Vite build + `api/graphql.ts` serverless route.
2. Set **server** env `GRAPH_STUDIO_API_KEY` (Production + Preview). Do **not** use a `VITE_` prefix.
3. The proxy allowlists only the three Argus / Uni tip / hooks IDs above.

## Notes

- Hooks deployment can be days behind tip; tip volumes are authoritative for “right now,” hooks IPFS for permission intelligence.
- Dual-USDC / odd fee tiers exist on Arc Uni V4 — treat USD metrics carefully.
- Not financial advice.
