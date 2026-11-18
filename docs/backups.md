# Automatic nightly backup (free)

Every night at about 02:00 India time, GitHub copies all the cloud data into a backup file and keeps
it for **30 days**. If the cloud data is ever lost or damaged, you restore a night's copy.
It uses GitHub Actions (free for a private repository) and no paid Google service.

## One-time setup (about 10 minutes)

1. **Make the repository private.** GitHub → your repository → *Settings* → *General* → *Danger zone* →
   *Change visibility* → *Private*. The backup refuses to run in a public repository, because the files
   hold your clients' and workers' details.
2. **Create a key that can only read the data.**
   Google Cloud console (console.cloud.google.com), choose the project **sccs-billing-eb0c7**:
   *IAM & Admin* → *Service accounts* → *Create service account*, name it `nightly-backup`,
   give it the role **Cloud Datastore Viewer** (read only), then *Keys* → *Add key* → *JSON*.
   A `.json` file downloads.
3. **Give the key to GitHub (never commit it).** Repository → *Settings* → *Secrets and variables* →
   *Actions* → *New repository secret*:
   - name `FIREBASE_SERVICE_ACCOUNT`, value: the whole text of the downloaded `.json` file
   - name `FIREBASE_PROJECT_ID`, value: `sccs-billing-eb0c7`
   Then delete the downloaded file from your computer.
4. **Test it.** Repository → *Actions* → *Nightly backup* → *Run workflow*. After a minute the run shows a
   green tick and a *cloud-backup-…* file under *Artifacts*. GitHub emails you if a nightly run ever fails.

## Restoring

1. Repository → *Actions* → open the night you want → download the *cloud-backup-…* artifact and unzip it.
2. In the app: *Settings* → *Backup & restore* → *Restore from file* → choose
   `construction-billing-backup-YYYY-MM-DD.json`.
3. Restoring replaces what is on that phone. If the cloud is empty, the next sync uploads it all.
   If the cloud still has newer copies, the cloud copy wins when the phone syncs, so restore into an
   empty cloud (or ask for help) when you are recovering from a real loss.
4. `documents-YYYY-MM-DD.json` is a raw copy of every cloud document, for an expert to recover single items.

## Good to know

- Small mistakes (a deleted bill, a wrong edit) are better fixed from *History* in the app: undo, or
  *Recently deleted* for 30 days. The nightly backup is for bigger problems.
- Check the *Artifacts* list now and then to see that nights are being saved.
- Run it by hand any time: `FIREBASE_SERVICE_ACCOUNT="$(cat key.json)" node scripts/backup-firestore.mjs --project sccs-billing-eb0c7`.
