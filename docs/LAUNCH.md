# Restaurant management v1 — launch handover

Branch: `release/restaurant-management-v1`.

## Release decision

The local build and automated checks pass. This is a release candidate, not a deployed production site. The checked local configuration has no production MongoDB URI, public HTTPS origin, or Razorpay/webhook configuration. Do not point customers at the development server.

## Owner workflow

- Overview shows today's real orders and paid receipts across the full day, rather than only the recent-order list.
- Table QR, direct in-person and counter orders appear in the restaurant queue. Active orders and unpaid closed orders remain visible. Staff use `/staff` to prepare and mark food ready; managers complete service and record payment.
- Counter billing has menu search, quantities, cash/UPI/card or payment-due selection, retry protection and a printable receipt. A receipt is created only after the server saves the order. Order details also offer a kitchen ticket and reprinting.
- Billing reserves ingredients. Starting preparation consumes them once. Cancelling before preparation releases reservations; cooked ingredients are not magically returned to stock. Low-stock alerts and menu availability follow recipes.
- Reports provide the last 30 days, the current month plus five preceding months, and individual days/months/years. Charts include zero-sales periods, drill-down and CSV exports. Preview orders are excluded. Reports refresh every minute while visible.
- Reports group receipts by **order creation date**, using current payment/refund status. Expenses use their entered date. “Net after recorded costs” excludes GST and entered costs; it is not audited accounting profit, and unrecorded costs are not estimated.
- Employees have restricted kitchen accounts. Owners record expenses and salary payments; the app does not transfer money or run bank payroll.

## GST

GST stays off by default. Kitchen settings allows a GSTIN, a manually entered percentage, and inclusive/exclusive menu pricing. The current implementation applies a single outlet-wide rate to food items, with CGST/SGST split; delivery charges are separate. Historical orders retain their original seller, prices and tax calculation. Set the applicable details before enabling GST. Mixed item rates, IGST, e-invoicing and return filing are outside this release.

## Deployment

Use Node 22 or the included Dockerfile. Install locked dependencies with `npm ci --prefix backend` and `npm ci --prefix frontend`; build with `npm run build`. Start with `npm start`. Supply secrets through the hosting platform, using `backend/.env.production.example` as a checklist. Never commit real keys or passwords.

1. Provision a durable MongoDB replica set with authentication, TLS, automatic backups and restricted network access. Verify a restore before accepting orders. The app uses multi-document transactions for stock and ordering.
2. Configure `MONGODB_URI`, the exact HTTPS `APP_ORIGIN` without a trailing slash, and owner credentials. `TRUST_PROXY_HOPS` must match the actual number of trusted reverse proxies; do not set it blindly. Production rejects missing/insecure essential settings.
3. A fresh production seed leaves its sample outlet inactive. Sign in and replace sample menu prices, recipe quantities, opening stock, address, phone and hours before activating. A previously used database needs the same review; it is not reset automatically.
4. Table/counter pay-at-restaurant flows work with online payments disabled. To enable online checkout, set Razorpay keys and webhook secret, configure captured-payment/refund events, and verify payment/refund behavior with the provider before live use.
5. Print QR codes using the actual public website address. Complete one table order and one counter order on physical devices, check the kitchen screen, confirm payment, print a receipt and reconcile the reports.
6. Use the admin **Launch checklist**. Also monitor `/api/health` and application logs, test a process restart and arrange backup/restore ownership.

The Docker recipe and GitHub workflow are supplied; Docker was unavailable on the local machine, so a container build has not been verified here. Physical printers, real phones on the public network, real payment webhooks, backups and production-load testing still require the deployed environment.

## Verification and automation

`npm test` runs backend and frontend checks; the backend integration suite uses a separate disposable test database on a local replica set. `npm run test:ci` starts its own replica set and runs both suites plus the build. CI runs these checks on pushes and pull requests and checks production dependencies for known high/critical vulnerabilities.

Automated app work includes queue refresh, stock reservation/consumption, unpaid checkout expiry, authenticated online-payment confirmation, refund reconciliation/processing, sold-out calculation, low-stock indicators, report aggregation and the 10-second in-person welcome reset. Payment collection, food preparation/serving, purchases and salary payments remain explicit staff actions.

The full-screen introduction currently uses the AI-generated welcome/thank-you images. The AI video is still pending a connected provider and is not a release requirement for ordering. The browser does not load the old live Blender scene.
