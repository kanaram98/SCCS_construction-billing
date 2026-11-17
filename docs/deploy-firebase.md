# Going live on Firebase (free Spark plan, no card)

One-time setup in the Firebase console (https://console.firebase.google.com), signed in with the Google account that will be the admin.

1. **Create the project**: Add project, name it (e.g. `sccs-billing`). Google Analytics: off. Note the **Project ID**.
2. **Authentication**: Build > Authentication > Get started > Sign-in method > **Google** > Enable, choose a support email, Save.
3. **Firestore**: Build > Firestore Database > Create database > production mode > pick a region close to you (e.g. `asia-south1` Mumbai). The location cannot be changed later.
4. **Web app**: Project settings (gear) > General > Your apps > `</>` Web > register (tick "Also set up Firebase Hosting" off; we configure it here). Copy the config values.
5. **Allow-list yourself**: Firestore Database > Start collection `owners` > Document ID = **your Gmail address** (lower case) > add one field, e.g. `note` = `admin` > Save. Only accounts listed in `owners` can create the workspace; the app can never write this collection.

In the project folder:

```
cp .env.production.example .env.production     # fill in the values from step 4
npx firebase login                              # opens a browser, once
npx firebase use --add                          # pick the project, alias: live
npm run deploy                                  # tests + build + deploy rules and hosting
```

Then open `https://<project-id>.web.app`, Settings > Sign in with Google. The first sign-in by a listed owner creates the workspace and makes that account admin. Invite your father from Settings > People.

**Data already on a phone** stays in that browser's storage for that website address. The Firebase address is a new website, so it starts empty. To bring data across: on the old site use Settings > Backup & restore > Back up now, then on the new site Restore from file.

**Updating later**: `npm run deploy`. Rules and the site are published together.
