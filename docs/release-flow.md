# Release flow: PC → test → live

Two separate Firebase projects, one codebase. Code moves forward; data never does.

| | Live (your father) | Test (you) |
|---|---|---|
| Firebase project | `sccs-billing-eb0c7` | `sccs-billing-test-1` |
| Address | https://sccs-billing-eb0c7.web.app | https://sccs-billing-test-1.web.app |
| Data | real bills | fake data only |
| Settings file (not committed) | `.env.production` | `.env.staging` |
| Banner | none | red "TEST COPY · fake data only" |

## Every change

1. Build and try it on your PC (`npm run dev`, emulators, fake data). `npm test` must pass.
2. **Commit** it in Git.
3. `npm run deploy:test` — runs the tests, builds with the test settings, publishes to the test project, and records which commit it published.
4. Try it on your phone at the test address. Fix and repeat from step 1 if needed.
5. `npm run deploy:live` — publishes **exactly that tested commit** to the real project.

`deploy:live` refuses to run when the commit was not published to test first, or when there are uncommitted edits. `--force-untested` overrides it for a real emergency only.

## Rolling back live

Firebase Hosting keeps every release. Console → Hosting → Release history → *Rollback* on the previous one (about a minute). Data is untouched by a rollback. Rules are separate: redeploy an earlier commit with `deploy:test` then `deploy:live`, or restore the earlier `firestore.rules`.

## Rules for changes that touch data

- Add fields as **optional**; never rename or remove existing ones.
- Server rules are published with the app by the same command, so a new field is accepted before the app uses it.
- Changing the shape of existing data needs a tested migration, tried on test first (with a copy of a backup if realistic data is needed).

## First sign-in on test

Test has its own members and data. Sign in on the test address with the admin account (listed in `OWNER_EMAILS` of `.env.staging`) and it creates the test workspace. Invite your other account from Settings the same way as on live.
