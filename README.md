## Live demo
- Live app: https://stockflow-hgon.onrender.com
- Demo login: demo@stockflow.com / Demo@1234
- Hosted on a free plan, so the first load can take up to a minute.

# StockFlow MVP

Multi-tenant inventory app: sign up, manage products, see a dashboard with low-stock items.

**Stack:** Node.js + Express, SQLite (Node's built-in `node:sqlite`, no native build needed), JWT auth with bcrypt, React (Vite) + React Router.

## Run it

Requires Node 22.13 or newer. (You may see an "ExperimentalWarning: SQLite" message on start; it is harmless.)

```bash
npm run install:all     # installs server and client dependencies
npm run build           # builds the React app into client/dist
npm start               # http://localhost:4000 (API + UI)
```

The SQLite database file (`server/stockflow.db`) is created automatically on first start.
Set `JWT_SECRET` and (optionally) `PORT` / `DB_FILE` in the environment for anything beyond a demo.

### Development (hot reload)

```bash
npm run dev:server      # API on :4000
npm run dev:client      # UI on :5173, proxies /api to :4000
```

## PRD coverage

| PRD item | Where |
|---|---|
| FR-1 Signup (email, password, confirm, org name) / login with validation | `server/index.js` `/api/auth/*`, `client/src/pages/Login.jsx`, `Signup.jsx` |
| FR-2 Org created on signup; all data scoped by org | `organizations` table; every query filters by `organization_id` taken from the DB user, never from the request |
| FR-3 Product model | `products` table in `server/db.js`; SKU unique per org |
| FR-4 CRUD, list table, edit form, confirm before delete (hard delete) | `/api/products`, `Products.jsx`, `ProductForm.jsx` |
| FR-5 Stock updates: edit form + inline "+/- N" with note; `last_updated_by` and timestamp | `/api/products/:id/adjust`, adjust row on the list |
| FR-6 Dashboard: total products, total units, low-stock table | `/api/dashboard`, `Dashboard.jsx` |
| FR-7 Settings: default low stock threshold (default 5) | `/api/settings`, `Settings.jsx` |
| Search by name or SKU | `?q=` on `/api/products` |

Low stock rule: `quantity_on_hand <= COALESCE(product threshold, org default)`.

Not included (per PRD): password reset, roles/invites, history, imports, integrations, billing.

## Demo account

On every start the server creates a demo login with sample products if it doesn't exist:

- Email: `demo@stockflow.com`
- Password: `Demo@1234`

Change it with `DEMO_EMAIL` / `DEMO_PASSWORD`, or turn it off with `SEED_DEMO=false`.
