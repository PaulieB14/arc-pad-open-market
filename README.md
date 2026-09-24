# Pad → Open Market (Arc)

Live **Argus launchpad → Uniswap V4 Arc** lifecycle cards for Graphtronauts.

Joins:

- **Argus** subgraph `JBG4rStwjXA3XbD8K4NVJddcjPMGpNgsQPNm3KZdD2GW` — bonded / line / pad hook / pad volume
- **Uni V4 Arc (tip)** `7xLobfNG9xx8yM5hkxagRuPmdjCJP4Kj9vtomrn9LrRM` — open-market volume, `Pool.hooks` string
- **Uni V4 Arc hooks IPFS** `Qmdyx7tqmQzyQu7viYqqfE3oNYs8EtxhcPs1VHBfXi7p2p` — `Hook` entity, permission flags, custom accounting (may lag tip)

Featured demos: **DUKE** (hooked pad → same hook on Uni) and **ARGUS** (legacy pad → vanilla Uni).

## Run locally

```bash
npm install
npm run dev
```

Open the app, paste a [Subgraph Studio](https://thegraph.com/studio/) / gateway API key (stored in `localStorage` only), then **Refresh**.

```bash
npm run build
npm run preview
```

## Deploy

Any static host works (GitHub Pages, Vercel, Netlify). No server secrets required — users bring their own gateway key in the UI.

## Notes

- Hooks deployment can be days behind tip; tip volumes are authoritative for “right now,” hooks IPFS for permission intelligence.
- Dual-USDC / odd fee tiers exist on Arc Uni V4 — treat USD metrics carefully.
- Not financial advice.
