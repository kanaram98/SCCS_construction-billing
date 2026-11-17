# Backend schema (Firestore)

The cloud database is Firestore on the free Spark plan, used by a single owner. There is no server API: the app reads and writes documents directly, and **security rules** ([`firestore.rules`](../firestore.rules)) act as the server-side validators.

| Layer | File | Role |
|---|---|---|
| Schema and app-side validators | [`src/backend/schema.js`](../src/backend/schema.js) | Collections, paths, size limits, a zod validator per document |
| Mapping | [`src/backend/mapping.js`](../src/backend/mapping.js) | App state ⇄ documents (`toDocuments`, `fromDocuments`) |
| Server-side validators | [`firestore.rules`](../firestore.rules) | Access control and validation of every write |
| Tests | `tests/backend/` (`npm run test:unit`), `tests/rules/` (`npm run test:rules`) | Validators, round trip, rules on the emulator |

## Access

- **`owners/{uid}`** is the allow-list. Only accounts with a document here can use the database. You create it once by hand in the Firebase console. The app can read its own entry but can never write one.
- Each owner can only reach `users/{uid}/…`. Accounts that aren't signed in, and signed-in accounts not on the allow-list, are refused, even inside their own `users/{their uid}` space.

## Collections (all under `users/{uid}`)

| Path | Contents | Writes allowed |
|---|---|---|
| `users/{uid}` | `schemaVersion`, `createdAt` | create/update; no delete |
| `bills/{id}` | Bill or estimate, including measurements (`sections`) and payments | create/update with a higher `version`; delete only from the recycle bin |
| `rates/{id}` | Work-item rate: `name`, `unit`, `type`, `rate` | same as bills |
| `clients/{id}` | Saved client: `name`, `phone`, `address`, `gstin` | same as bills |
| `templates/{id}` | Saved section or area: `name`, `type`, `content` | same as bills |
| `workers/{id}` | Labour worker: `name`, `phone`, `role`, `dailyWage`, `active` | same as bills |
| `labourPayments/{id}` | Advance or wage payment: `workerId`, `date`, `amount`, `mode`, `note` | same as bills |
| `attendance/{YYYY-MM}` | `marks[DD][workerId] = { units, wage, at }` | create/update, changed mark by mark; no delete |
| `closedMonths/{YYYY-MM}` | `closedAt` | create; delete (unlock); no edit |
| `history/{id}` | History of bills, rates, clients, templates, firm and quotation | create; delete (trimming); never edited |
| `labourLog/{id}` | History of labour changes | create; delete (trimming); never edited |
| `settings/firm` | Firm details, bank/UPI, logo and signature (`data:image/…`) | create/update with a higher `version` |
| `settings/quotation` | Rate quotation title, client, validity, terms, disclaimer | create/update with a higher `version` |
| `settings/printSettings` | PDF/print layout | create/update |
| `settings/preferences` | `language` (`en`/`hi`), `textSize` | create/update |
| `settings/app` | `schemaVersion`, `activeBillId`, `meta` (backup reminder, onboarding) | create/update |

## Record metadata

Every record (bills, rates, clients, templates, workers, labour payments) has:

| Field | Meaning |
|---|---|
| `id` | Must equal the document id |
| `createdAt`, `updatedAt` | ISO times, set by the app |
| `deletedAt` | `null`, or the time it was moved to the recycle bin |
| `version` | Starts at 1 and goes up with every change. **The server rejects a write that doesn't increase it**, so an older copy from another device can't overwrite a newer one. |
| `order` | Position in the app's list |
| `syncedAt` | Server time of the last write. It must be the request's server time; the sync layer uses it to fetch only what changed. |

`settings/firm` and `settings/quotation` carry `version` too. Attendance avoids conflicts differently: each mark is written as its own field (`marks.04.w1`), so two phones marking different workers on the same day don't overwrite each other.

## Limits (enforced in the app and by the rules)

- **Bill text fields:**
  - names: 200 characters
  - addresses, notes and terms: 5,000
  - phone: 30
  - GSTIN: 20
- **Bill contents:** up to 300 sections, 500 payments (within a section, 200 areas; per area, 500 items)
- **Logo and signature:** `data:image/…;base64` only, up to 700 KB each
- **Firestore's own limit:** 1 MB per document

## Not enforced on the server

- **Closed (locked) labour months.** The app enforces them. Enforcing them on the server would make offline changes fail if they sync in a different order.
- **The inside of measurements, payments and template content.** Rules can't loop over lists, so the app validates these before sending (`validateDocument`). The server checks only the list sizes.
