<p align="center">
  <img src="client/ghostgrid/public/logo.png" alt="Ghost Grid" width="140" />
</p>

# Ghost Grid 👻

**Ghost Grid** is a tiny, *Phasmophobia*-inspired on-chain ghost-hunting game built with **Dojo** (Cairo/Starknet).  
Frontend is **React + Vite + TypeScript** with a custom dithery shader background for retro vibes.  
Wallet/session is via **Cartridge Controller** so you don’t have to sign every click (session key).

- 🎮 Explore rooms, listen for heartbeats, and use tools (UV, EMF, Thermo, Writing, Spirit Box) to narrow ghosts.
- 🧠 Runs & credits recorded on-chain; **leaderboard** aggregates stats via Torii models/events.
- 📊 **Torii** indexer gives you GraphQL & SQL playgrounds for queries.

---

## Live Network (Sepolia)

This repo is configured for **Starknet Sepolia** by default.

- **World address:** `0x7e50e3d05225a874e027237145044ff1475c7ef11ea2d855c81654fcadfeb34`
- **RPC:** `https://api.cartridge.gg/x/starknet/sepolia`

> If you redeploy your own world, update the `.env` values accordingly.

---

## Tech Stack

- **Cairo/Dojo:** systems & models (`sozo`, `katana`)
- **Indexer:** **Torii** (GraphQL + SQL; models + events)
- **Frontend:** React + Vite + TypeScript
- **Wallet/Session:** Cartridge Controller (session keys)

---

## Environment Variables (client)

Create **`client/ghostgrid/.env.local`** with:

```env
# Torii (GraphQL)
VITE_TORII_URL=http://127.0.0.1:8080/graphql
# Optional SQL endpoint if you wire it in code
VITE_TORII_SQL_URL=http://127.0.0.1:8080/sql

# Starknet RPC
# - Sepolia: Cartridge RPC (default)
VITE_STARKNET_RPC=https://api.cartridge.gg/x/starknet/sepolia
# - Local dev (katana): uncomment when using katana
# VITE_STARKNET_RPC=http://127.0.0.1:5050

# Dojo world + contracts
# - Sepolia defaults (update if you redeploy)
VITE_WORLD_ADDRESS=0x7e50e3d05225a874e027237145044ff1475c7ef11ea2d855c81654fcadfeb34
VITE_ACTIONS_ADDRESS=0x2514331784b838703fe74cac04882a3b3d2fd1050f8ca8c3e81bd92a54701d1
VITE_SPIRIT_ADDRESS=0x3ddf8600633f8a49f27f9f7d347f8d85d537f1e5cc2c9347066732fe9aff3cc
# - Local dev: set to the world printed by `sozo migrate`
# VITE_WORLD_ADDRESS=0xLOCAL_WORLD
# VITE_ACTIONS_ADDRESS=0xLOCAL_ACTIONS
# VITE_SPIRIT_ADDRESS=0xLOCAL_SPIRIT

# Session config (Sepolia)
VITE_SESSION_CHAIN=SN_SEPOLIA
VITE_SESSION_TTL=1800
VITE_SESSION_MAX_CALLS=100
VITE_SESSION_MAX_FEE_WEI=5000000000000000

# (Optional) Cartridge Controller base if exposed in UI/hooks
VITE_CONTROLLER_URL=https://controller.cartridge.gg
```

Vite tip: keys must start with `VITE_` to be available in the browser.

⸻

## Frontend Quickstart

```bash
cd client/ghostgrid
npm install
npm run dev   # http://localhost:5173
```

With Sepolia (default config), run a Torii indexer pointed at your deployed world:

```bash
torii \
  --world 0x7e50e3d05225a874e027237145044ff1475c7ef11ea2d855c81654fcadfeb34 \
  --rpc https://api.cartridge.gg/x/starknet/sepolia \
  --http.cors_origins "*"
```

Handy while Torii runs:
- GraphQL: http://127.0.0.1:8080/graphql
- SQL: http://127.0.0.1:8080/sql
- Worlds Explorer: https://worlds.dev/torii?url=http%3A%2F%2F127.0.0.1%3A8080%2Fgraphql

Update `VITE_TORII_URL` in `.env.local` to match.

⸻

## Local Loop (Katana)

1. **Start a dev chain**
   ```bash
   katana --dev --dev.no-fee
   ```
2. **Build & deploy**
   ```bash
   sozo build
   sozo migrate   # note the printed world address
   ```
3. **Index locally**
   ```bash
   torii --world 0xLOCAL_WORLD --rpc http://127.0.0.1:5050 --http.cors_origins "*"
   ```
4. **Point the client at local services** (add/override in `client/ghostgrid/.env.local`)
   ```env
   VITE_TORII_URL=http://127.0.0.1:8080/graphql
   VITE_STARKNET_RPC=http://127.0.0.1:5050
   VITE_WORLD_ADDRESS=0xLOCAL_WORLD
   ```

## Leaderboard / Indexing Notes

The leaderboard queries Torii models (player/run aggregates) and events (evidence, run start/finish). If the table reads “Unknown type …” or appears empty:
- Ensure `VITE_TORII_URL` points at the Torii that indexed your world.
- Start Torii before running your `register_model`/`register_event` transactions (or wipe the DB).
- Reset local DB: stop Torii, delete `torii.sqlite*`, restart Torii.

⸻

## Build & Deploy

```bash
cd client/ghostgrid
npm run build   # outputs dist/
```

Deploy the static `dist/` directory to your host of choice (Vercel, Netlify, etc.). If you host Torii as well, remember to point `VITE_TORII_URL` at that public endpoint (e.g., a Cartridge Slot).

⸻

License

MIT © Karan Singh Bisht
