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

The frontend includes a clean logo loader with a red-and-gold orbit and a confirmation dialog with a short confetti animation. The confirmation appears only after the API reports a paid, confirmed order (or an explicitly labelled development preview order), including delayed payment confirmation. Pending, failed, cancelled, expired, and previously viewed orders do not trigger a new celebration. Customers can close the dialog immediately to track or cancel their order; the cancellation clock continues to run from the server confirmation time.

Both animations respect the device's reduced-motion preference. The original logo stays flat and crisp, without duplicated layers or perspective distortion. No additional animation dependency is required.

Run the confirmation-state regression checks with `npm test --prefix frontend`.

## Customer self-ordering and table QR codes

Open `/inperson` for the animated RedHandi introduction, menu, mobile-number checkout, and printable itemized bill. These orders are confirmed immediately, reserve stock, and show payment due at the restaurant. The confirmation page refreshes status every 10 seconds and provides a private tracking link. No SMS is sent and no online payment is taken in this flow.

In `/admin`, open **Restaurant layout**, add named tables, and download each table's QR image. Generate codes using the live website's public address before printing; localhost codes cannot be used by guests on their phones. Pausing a table disables new orders from its code. Table identity is resolved by the server from an opaque QR token.

The Orders queue includes all active orders, oldest first, plus the latest 250 closed orders. Staff move table orders through Start preparing → Mark ready → Mark served and record payment using **Collect** after receiving it. Table orders and direct in-person orders share the existing numbering and stock system. The admin refreshes every 12 seconds. Paid restaurant-order cancellations must be handled by the restaurant; they do not trigger Razorpay refunds.

The `/inperson` introduction is a full-screen Three.js cartoon, modeled and animated in Blender. It uses the supplied Red Handi blueprint as a style reference: red polo/cap, black apron, bearded chef and warm restaurant interior. After server confirmation, the host carries the numbered order slip to the kitchen. The editable Blender source and rebuild instructions are in `art/restaurant/`. The scene supports pause, opt-in voice, reduced motion, and a poster fallback.
