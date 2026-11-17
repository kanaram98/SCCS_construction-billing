# Construction Billing

A mobile-first React app (Material UI) for construction measurements, bills, rate quotations and labour attendance. It runs in the browser, installs as a Progressive Web App (PWA) on phones and computers, and works offline. English and Hindi.

## Features

- **Home**: totals, this month, overdue payments with WhatsApp reminders, clients with dues, recent bills.
- **Bills and estimates** with running (RA) bills, discount, optional GST (CGST + SGST or IGST), total in words, and payments received.
- **Measurements** in feet.inches (`15.4` = 15′4″) by floor and room: area, length, volume, count and direct-quantity work items. Entries can be reordered, copied, searched and saved as templates.
- **Rates** as a printable, shareable rate quotation with your terms and disclaimer.
- **PDF and print**: firm letterhead (logo, details), summary, bill, measurement sheet and item totals, bank/UPI details with a UPI QR code, and a signature. Hindi documents are exported from the rendered page so Devanagari prints correctly.
- **Labour**: daily attendance (A, ½P, 1P, 1½P, 2P) on a month calendar, advances and payments (with mode and description), a monthly report, an all-workers register PDF and a PDF sheet for each worker.
- **Safety**: undo for deletes; for labour, a full activity log with undo, a 30-day recycle bin and closed (locked) months. Backup files can be saved and restored.

All data is stored on each device. With cloud sync (Firebase, free plan) the admin and a contractor share one workspace: sign in with Google in Settings. Cloud sync currently runs on the local emulators (`npm run dev` with `npm run emulators`); going live is Phase B3.

## Run locally

```powershell
npm install
npm run dev
```

Open the local URL printed by Vite. `npm run build` creates the production app in `dist`; `npm run preview` serves that build.

### Local backend (Firebase emulators)

Needs Java 21 (`winget install Microsoft.OpenJDK.21`).

```powershell
npm run emulators
```

This runs the Firebase Auth, Firestore and Hosting emulators under the offline demo project `demo-sccs`. Nothing connects to a real Firebase project. The Emulator UI is at http://localhost:4000.

The database layout, validators and security rules are described in [docs/backend-schema.md](docs/backend-schema.md). `npm run test:rules` starts the Firestore emulator and tests the security rules (if the emulators are already running, use `npx vitest run --config vitest.rules.config.js` instead).

## Testing

- `npm test` runs `test:unit` (domain, document and backend mapping logic, with Node's test runner) and `test:ui` (screens rendered at phone size with Vitest + Testing Library).
- `npm run test:rules` tests the Firestore security rules and the sync engine (two simulated phones) on the emulator (needs Java 21).
- `npm run test:e2e` runs the app in a real browser (Playwright) as admin and contractor on two "phones", against running emulators (`npm run emulators`). It wipes the emulators' data first. One-time setup: `npx playwright install chromium`.
- `npm run verify` runs the tests and the production build. Netlify runs it on every deploy, so a failing test stops a broken update from going live.
- GitHub Actions (`.github/workflows/ci.yml`) runs the same checks on every push.

## Hosting

Pushing to `main` on GitHub deploys to Netlify ([`netlify.toml`](./netlify.toml)) after `npm run verify` passes. PWA installation needs HTTPS:

- **Android:** open the site in Chrome, tap **⋮**, then **Install app**.
- **iPhone/iPad:** open the site in Safari, tap **Share**, then **Add to Home Screen**.
- **Computer:** use the install button in Chrome or Edge.

## Project layout

Lower layers never import from higher ones, so the business logic is tested in Node without a browser.

```
src/
  domain/       Pure business logic (no React, no browser APIs)
                bills: measurements, rates, calculations, validation, bill-tree, factories,
                       bill-kinds (estimates, RA bills), payments, amount-in-words, warnings
                labour: labour (model, reports), labour-ops (every change + activity log),
                        labour-log (readable history)
                other: app-state (initial state, loading saved data), backup, quotation,
                       dashboard, clients, templates, print-settings, whatsapp, relabel
  documents/    Printable documents: document model shared by preview and PDF, jsPDF
                renderers (bill, quotation, labour), letterhead, image PDFs for Hindi
  services/     Browser integrations: local storage, files/sharing, images, service worker
  state/        App store (useBillingStore), actions and BillingContext
  hooks/        Shared React hooks
  i18n/         tr()/trn() translation and the Hindi dictionary (hi.js)
  components/   ui/ (reusable MUI building blocks), layout/ (header, navigation, error boundary)
  features/     One folder per screen: home, bills, entry, labour, rates, project, print,
                settings, backup, onboarding
  config/       App constants and default branding
  styles/       print.css: paper preview and print output only
  theme.js      MUI theme
tests/          domain/ and documents/ (node:test), ui/ (Vitest)
public/         PWA manifest, service worker and icons
firebase.json, .firebaserc, firestore.rules   Firebase emulator setup (local only)
```
