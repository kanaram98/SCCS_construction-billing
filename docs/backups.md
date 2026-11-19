# Automatic nightly backup (free)

Every night at about 02:00 India time, GitHub copies all the cloud data into a backup file and saves it in
a **separate private repository** (one commit per night, so the history keeps every night; the latest 90
nights are also kept as plain files). If the cloud data is ever lost or damaged, you restore a night's copy.
It uses GitHub Actions and no paid Google service.

The app's own repository never holds the data: the nightly job lives here, the backups live in the other repository.

## One-time setup (about 15 minutes)

1. **Create the backup repository.** GitHub → *New repository* → name it for example `sccs-billing-backups`,
   choose **Private**, tick *Add a README file* (so it is not empty). Nothing else is needed in it.
   The backup refuses to run if this repository is ever made public.
2. **Create a key that can only read the cloud data.**
   Google Cloud console (console.cloud.google.com), choose the project **sccs-billing-eb0c7**:
   *IAM & Admin* → *Service accounts* → *Create service account*, name it `nightly-backup`,
   give it the role **Cloud Datastore Viewer** (read only), then *Keys* → *Add key* → *JSON*.
   A `.json` file downloads.
3. **Create a token that can only write to the backup repository.**
   GitHub → your profile picture → *Settings* → *Developer settings* → *Personal access tokens* →
   *Fine-grained tokens* → *Generate new token*. Name `backup-writer`, expiry 1 year, *Repository access* →
   **Only select repositories** → the backup repository, *Permissions* → *Repository permissions* →
   **Contents: Read and write** (and *Metadata: Read-only*, added automatically). Copy the token once.
4. **Give the keys to this repository (never commit them).** This (app) repository → *Settings* →
   *Secrets and variables* → *Actions* → *New repository secret*, four secrets:
   - `FIREBASE_SERVICE_ACCOUNT`: the whole text of the downloaded `.json` file
   - `FIREBASE_PROJECT_ID`: `sccs-billing-eb0c7`
   - `BACKUP_REPO`: your GitHub name and the backup repository, like `your-name/sccs-billing-backups`
   - `BACKUP_REPO_TOKEN`: the token from step 3
   Then delete the downloaded `.json` file from your computer.
5. **Test it.** This repository → *Actions* → *Nightly backup* → *Run workflow*. After a minute the run
   shows a green tick and a new commit "Backup YYYY-MM-DD" appears in the backup repository under `backups/`.
   GitHub emails you if a nightly run ever fails.

When the token expires (after a year), create a new one the same way and replace the `BACKUP_REPO_TOKEN` secret.

## Restoring

1. In the backup repository open `backups/`, choose the night you want, and download
   `construction-billing-backup-YYYY-MM-DD.json` (older nights: open the repository history).
2. In the app: *Settings* → *Backup & restore* → *Restore from file* → choose that file.
3. Restoring replaces what is on that phone. If the cloud is empty, the next sync uploads it all.
   If the cloud still has newer copies, the cloud copy wins when the phone syncs, so restore into an
   empty cloud (or ask for help) when you are recovering from a real loss.
4. `documents-YYYY-MM-DD.json` is a raw copy of every cloud document, for an expert to recover single items.

## Good to know

- Small mistakes (a deleted bill, a wrong edit) are better fixed from *History* in the app: undo, or
  *Recently deleted* for 30 days. The nightly backup is for bigger problems.
- Look at the backup repository now and then to see that a commit appears every night.
- Take one by hand before a live release: *Actions* → *Nightly backup* → *Run workflow*.
- Run it from a computer: `FIREBASE_SERVICE_ACCOUNT="$(cat key.json)" node scripts/backup-firestore.mjs --project sccs-billing-eb0c7`.
- Backups hold your clients' and workers' details. Keep the backup repository private and do not add people to it you would not trust with the books.
