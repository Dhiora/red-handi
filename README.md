# red-handi

RedHandi food ordering app — React storefront/admin (Vite) with an Express + MongoDB API.

## Project structure

```
red-handi/
├── frontend/              React + Vite app
│   ├── public/            Static assets (logo, images, favicon)
│   ├── src/               Pages, components and API client
│   ├── index.html
│   ├── vite.config.js     Dev server on :5173, proxies /api to the backend
│   └── package.json
├── backend/               Express + Mongoose API
│   ├── src/               App, routes, auth, orders, payments, models
│   ├── scripts/           Local MongoDB runner and admin setup
│   ├── tests/             node:test unit and integration tests
│   ├── .env.example
│   └── package.json
├── scripts/dev.mjs        Runs frontend and backend together
└── package.json           Convenience scripts for the whole project
```

## Getting started

```bash
npm run install:all          # installs backend and frontend dependencies
cp backend/.env.example backend/.env   # optional; without MONGODB_URI a local MongoDB is started in dev
npm run dev                  # frontend on http://127.0.0.1:5173, API on http://127.0.0.1:4000
```

Run only the frontend with `FRONTEND_ONLY=true npm run dev`.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Starts frontend and backend in watch mode |
| `npm run build` | Builds the frontend into `frontend/dist` |
| `npm start` | Starts the backend in production mode and serves `frontend/dist` |
| `npm test` | Runs backend tests (integration tests need MongoDB on port 27018) |
| `npm run setup-admin` | Sets the super admin password |

Each folder can also be run on its own (`cd frontend && npm run dev`, `cd backend && npm run dev`).
Set `FRONTEND_DIST` on the backend to serve the built frontend from a different path.

## Brand animations

The frontend includes a CSS 3D logo loader and a confirmation dialog with a short confetti animation. The confirmation appears only after the API reports a paid, confirmed order (or an explicitly labelled development preview order), including delayed payment confirmation. Pending, failed, cancelled, expired, and previously viewed orders do not trigger a new celebration. Customers can close the dialog immediately to track or cancel their order; the cancellation clock continues to run from the server confirmation time.

Both animations respect the device's reduced-motion preference. No WebGL or additional animation dependency is required.

Run the confirmation-state regression checks with `npm test --prefix frontend`.
