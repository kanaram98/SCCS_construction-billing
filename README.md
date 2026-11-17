# Construction Billing

A React app for construction measurements in feet and inches, work-item rates, bill totals, and PDF export. It runs in a browser and can be installed as a Progressive Web App (PWA) on phones and desktops. The Windows `.exe` build is also available.

Bills and reusable section/area templates are stored locally. The dashboard can filter by project or bill search, client, date range, and payment status (derived from the bill's advance amount; it is not a payment ledger). PDF / Print includes document selection and ordering, paper size and orientation, margins, text size, headers, page breaks, row numbering, summary detail, page numbers, footer lines, and signature placement.

## Run locally

```powershell
npm install
npm run dev
```

Open the local URL printed by Vite. Run `npm run build` to create the production app in `dist`. To test the installable/offline production version locally, run `npm run preview` and open its local URL.

## Install as an app

- **Android:** Open the HTTPS site in Chrome, tap **⋮**, then **Install app** (or **Add to Home screen**).
- **iPhone/iPad:** Open the HTTPS site in Safari, tap **Share**, then **Add to Home Screen**.
- **Desktop:** Use the install button in Chrome or Edge, when offered.

PWA installation on a hosted site requires HTTPS. The app caches its files for offline use after the first visit. Bills stay in that browser's local storage and do not sync across devices.

## Host the app for your phone

The app is static, so hosting does not need a server or database. Netlify can build this project and provide the HTTPS address needed for PWA installation.

### Quick manual deploy

1. On your computer, open the project folder in a terminal.
2. Run `npm install` once, then `npm run build`. The production site is created in the `dist` folder.
3. Sign in to Netlify and open its manual deploy / deploy manually page.
4. Drag the project's **`dist` folder** into the deploy area. Do not upload the whole project folder.
5. Wait for Netlify to finish and open the HTTPS address it provides (ending in `.netlify.app`).
6. On your phone, open that address in Chrome on Android or Safari on iPhone/iPad and follow the install steps above.

For later updates, rebuild with `npm run build` and upload the new `dist` folder to the same Netlify site. The included [`netlify.toml`](./netlify.toml) sets the build output and cache behavior if you later connect the project to a Git-based Netlify deploy.

**Local data reminder:** hosting publishes the app files, not your bills. Bills, client profiles, rates, templates, and settings remain in the browser storage on each device; they are not shared with Netlify or synced between your computer and phone.

## Windows executable

Run `npm run dist:win` to create both an installer and a portable `.exe` in `release`.

## Project layout

The code is split into layers. Lower layers never import from higher ones, so all
billing logic can be unit-tested in Node without a browser.

```
src/
  domain/        Pure business logic (no React, no browser APIs)
    measurements.js     feet.inches parsing, validation and formatting
    rates.js            default rates, measurement types, dimension rules
    calculations.js     quantities, line/area/section/bill totals, payment status
    validation.js       entry, bill, amount and export validation
    bill-tree.js        immutable section → area → item updates, copy, templates
    factories.js        create/duplicate bills, sections, areas, items
    clients.js, templates.js, bill-filters.js
    print-settings.js, signature-layout.js
    app-state.js        initial state and hydration of saved data
    legacy-migration.js data from the original standalone app
  documents/     Printable documents
    document-model.js   rows for each document, shared by preview and PDF
    pdf-export.js       jsPDF renderer (loaded on demand)
  services/      Browser integrations: local storage, image resizing, service worker
  state/         App store (useBillingStore), actions, and BillingContext
  hooks/         Reusable React hooks (PWA install prompt)
  components/
    ui/          Reusable primitives: Button, TextField, SelectField, Card, Notice…
    layout/      App header, navigation, notices
  features/      One folder per screen: dashboard, entry, rates, project, print
  styles/        CSS split by concern, imported through styles/index.css
  config/        App constants (storage keys, navigation, upload limits)
tests/           node:test suites for domain/ and documents/
```

- `public/manifest.webmanifest` and `public/sw.js` configure the installable, offline-capable PWA.
- `electron.cjs` configures the Windows desktop build.
- `legacy/` holds the original standalone version (`billing.html`, `app.js`, `styles.css`). Its saved data is migrated automatically on first launch.

Run the tests with `npm test`.
