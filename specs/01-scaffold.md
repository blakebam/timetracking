# Spec 1 — Project Scaffold

## Goal
Set up a working monorepo where `npm run dev` runs the client and server with hot reload, and `npm run build && npm start` runs the whole app as **one Node process** on localhost. No features yet; this is just the skeleton later specs plug into.

## Layout
```
/
├─ package.json            # workspaces + top-level scripts
├─ tsconfig.base.json      # strict TS settings shared by all packages
├─ vitest.config.ts       # test.projects: shared, server
├─ .gitignore  .nvmrc  .prettierrc
├─ data/                   # SQLite file lives here (gitignored, .gitkeep committed)
├─ shared/                 # @tt/shared — types, zod schemas, time utils
│  ├─ package.json         # "exports": { ".": "./src/index.ts" }  (consumed as TS source)
│  └─ src/index.ts
├─ server/                 # @tt/server — Express API
│  ├─ package.json
│  ├─ tsconfig.json
│  ├─ tsup.config.ts       # bundles server + @tt/shared into dist/; better-sqlite3 stays external
│  └─ src/
│     ├─ index.ts          # entry point: load config, open DB, createApp(), listen
│     ├─ app.ts            # createApp(deps) → express app (no listen; used by tests)
│     ├─ config.ts         # reads env, applies defaults
│     └─ middleware/errors.ts
└─ client/                 # @tt/client — Vite + React
   ├─ package.json
   ├─ vite.config.ts       # dev proxy /api → http://127.0.0.1:4000
   ├─ index.html
   └─ src/ main.tsx, App.tsx
```

## Tooling decisions
- **Node 24 LTS** (`.nvmrc`, `"engines": { "node": ">=22" }`).
- **TypeScript strict** everywhere (`strict`, `noUncheckedIndexedAccess`).
- **Shared package as TS source.** Vite and `tsx` consume it directly. For prod, `tsup` bundles it into the server, so there is no separate build step for `shared`.
- **Server:** Express 5 (forwards async errors natively), `tsx watch` in dev, `tsup` for build.
- **Client:** React 19 + Vite + react-router. Routing is set up here with placeholder pages.
- **Tests:** Vitest `test.projects` covering `shared` and `server`. Client tests come later if needed.
- **Formatting:** Prettier. No ESLint for now (`tsc --noEmit` is the gate).
- **concurrently** runs client and server dev processes from the root.
- Exact dependency versions are pinned in `package-lock.json` at scaffold time.

## Root scripts
| Script | Does |
|---|---|
| `dev` | `concurrently` → `server: tsx watch src/index.ts` + `client: vite` |
| `build` | `vite build` (client → `client/dist`) then `tsup` (server → `server/dist`) |
| `start` | `node server/dist/index.js` (`NODE_ENV=production`) |
| `test` | `vitest run` |
| `typecheck` | `tsc --noEmit -p` for each package |
| `format` | `prettier --write .` |

## Server behavior
- `config.ts` reads:
  - `PORT` (default `4000`)
  - `HOST` (default `127.0.0.1`)
  - `DB_PATH` (default `<repo>/data/timetracking.db`)
  - `NODE_ENV`
- `createApp({ clientDistDir? })` returns the Express app. Spec 2 adds the `db` dependency. It:
  - mounts `express.json()`
  - mounts `GET /api/health` → `200 { ok: true }`
  - returns `404 { error: "not_found" }` for any other `/api/*`
  - in production, serves `client/dist` statically, with an SPA fallback (any non-`/api` GET returns `index.html`)
  - uses a final error handler that returns `500 { error: "internal" }` and logs the stack
- `index.ts` listens on `HOST:PORT` and logs the URL.

## Client behavior
- `App.tsx` has a nav bar (Day · Calendar · Week · Invoices · Settings) and react-router routes with placeholder pages.
- The footer shows server status by calling `/api/health` (green "connected" / red "server unreachable").

## .gitignore
`node_modules/`, `dist/`, `data/*.db*`, `.env`, `coverage/`

## Acceptance criteria
- [ ] Fresh clone → `npm install` → `npm run dev` opens the client at `http://localhost:5173`, and the footer shows "connected".
- [ ] Editing a server file restarts the server; editing a client file hot-reloads.
- [ ] `npm run build && npm start` serves the app and the API at `http://127.0.0.1:4000`. A deep link like `/calendar` loads (SPA fallback works).
- [ ] The server is not reachable from another machine on the LAN (it binds to 127.0.0.1).
- [ ] `npm run typecheck` and `npm test` pass. There is at least one test: `GET /api/health` via supertest.
- [ ] Importing a value from `@tt/shared` works in client dev, server dev, and the server prod build.

## Out of scope
Database (spec 2), any real API routes (spec 3), and UI beyond the shell.
