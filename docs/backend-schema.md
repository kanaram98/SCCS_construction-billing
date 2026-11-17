# Backend schema (Firestore)

The cloud database is Firestore on the free Spark plan. There is no server API: the app reads and writes documents directly, and **security rules** ([`firestore.rules`](../firestore.rules)) are the server-side validators and access control.

| Layer | File | Role |
|---|---|---|
| Schema and app-side validators | [`src/backend/schema.js`](../src/backend/schema.js) | Collections, paths, size limits, a zod validator per document |
| Roles | [`src/domain/permissions.js`](../src/domain/permissions.js) | What admin and contractor may do (`can(role, action)`) |
| Mapping | [`src/backend/mapping.js`](../src/backend/mapping.js) | App state ⇄ documents (`toDocuments`, `fromDocuments`) |
| Server-side validators | [`firestore.rules`](../firestore.rules) | Roles plus validation of every write |
| Tests | `tests/backend/` (`npm run test:unit`), `tests/rules/` (`npm run test:rules`) | Validators, round trip, roles and rules on the emulator |

## People and roles

There is one shared workspace for the business (SCCS). People join it as members:

| Role | Who | Can |
|---|---|---|
| **admin** | You | Everything, plus: invite and remove members, delete forever from the recycle bin, unlock closed months, change firm and bank details, trim history |
| **contractor** | Your father | All daily work: bills and estimates, measurements, rates, clients, templates, quotation, print layout, attendance, advances and payments, closing a month, undo and restore from the recycle bin |

**Setup (one time):**
1. Add a document `owners/{your Gmail}` in the Firebase console. Only accounts listed there can create a workspace.
2. Sign in to the app. It creates the workspace, and you become its admin.
3. Invite your father by his Gmail as contractor. He joins the first time he signs in with that account.

**Built-in protections:**
- An admin can't remove or demote themselves, so the workspace can't be locked out.
- A removed member immediately loses access.
- A signed-in account that isn't a member sees nothing.

## Collections

| Path | Contents | Who can write |
|---|---|---|
| `owners/{email}` | Allowed to create a workspace | Nobody from the app (console only) |
| `workspaces/{wid}` | `name`, `schemaVersion`, `createdAt`, `createdBy` | Created by an owner; edited by admin |
| `…/members/{uid}` | `uid`, `name`, `email`, `role`, `addedAt` | The creator becomes admin; the invited person joins with the invited role; admin manages others |
| `…/invites/{email}` | `email`, `role`, `invitedAt`, `invitedBy` | Admin; the invited person removes it after joining |
| `…/bills/{id}` | Bill or estimate, including measurements (`sections`) and payments | Admin and contractor (higher `version`); delete forever: admin, only from the recycle bin |
| `…/rates/{id}` | Work-item rate | Same as bills |
| `…/clients/{id}` | Saved client | Same as bills |
| `…/templates/{id}` | Saved section or area | Same as bills |
| `…/workers/{id}` | Labour worker | Same as bills |
| `…/labourPayments/{id}` | Advance or wage payment: `workerId`, `date`, `amount`, `mode`, `note` | Same as bills |
| `…/attendance/{YYYY-MM}` | `marks[DD][workerId] = { units, wage, at }` | Admin and contractor, mark by mark; never deleted |
| `…/closedMonths/{YYYY-MM}` | `closedAt`, `closedBy` | Closed by admin or contractor; unlocked (deleted) by admin only |
| `…/history/{id}` | History of bills, rates, clients, templates, firm and quotation, with `by` | Added by admin and contractor; never edited; trimmed by admin |
| `…/labourLog/{id}` | History of labour changes, with `by` | Same as history |
| `…/settings/firm` | Firm details, bank/UPI, logo and signature (`data:image/…`) | Admin only |
| `…/settings/quotation` | Rate quotation | Admin and contractor |
| `…/settings/printSettings` | PDF and print layout | Admin and contractor |

Kept **on each device, not shared**: language, text size, which bill is open, onboarding and backup reminders. Your father's Hindi doesn't change your app's language.

## Record metadata

Every record (bills, rates, clients, templates, workers, labour payments) has:

| Field | Meaning |
|---|---|
| `id` | Must equal the document id |
| `createdAt`, `updatedAt` | ISO times, set by the app |
| `deletedAt` | `null`, or the time it was moved to the recycle bin |
| `version` | Starts at 1 and goes up with every change. **The server rejects a write that doesn't increase it**, so an older copy from another device can't overwrite a newer one. |
| `updatedBy` | Account that made the latest change: the writer themselves, or another member when an older change is uploaded for the first time |
| `order` | Position in the app's list |
| `syncedAt` | Server time of the last write. It must be the request's server time; the sync layer uses it to fetch only what changed. |

`settings/firm` and `settings/quotation` carry `version` and `updatedBy` too. Attendance avoids conflicts differently: each mark is written as its own field (`marks.04.w1`), so two phones marking different workers on the same day don't overwrite each other.

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
- **Which measurement entries a contractor may delete inside a bill.** A bill is one document, so the contractor can edit its measurements. Every change is recorded in History with who made it, and can be undone.
