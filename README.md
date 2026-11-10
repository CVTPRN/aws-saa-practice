# SAA Studio — Personal AWS SAA-C03 Practice

A free, static practice application with a Hungarian interface and the original English AWS questions. Runs on Render Static Sites. **No backend, accounts, passwords, database service, API keys or extra registration.**

## What it does

- A daily set of 30 distinct random questions, once per **Europe/Budapest calendar day** in the current browser.
- Unlimited free practice; each new round contains 30 distinct random questions, with possible overlap between rounds.
- Every submitted answer is saved in **IndexedDB**. Refreshing the page or closing/reopening the browser preserves committed progress. Wait until the next question appears before closing. Unsubmitted selections are not saved.
- Exact-match grading for multiple answers; correct answers and optional explanations appear after all 30 questions have been answered.
- Daily accuracy, a 28-day activity grid, streaks, full history and unfinished attempts. Statistics include completed rounds and use their **completion date** in Budapest.
- `/admin` or **Kérdésbank**: create/edit/deactivate questions, search, CSV import/export and review inconsistent answer keys. All changes stay in the current browser.
- **Mentések**: download a complete JSON backup of questions, edits, finished results and unfinished rounds. Restore includes structural validation and an explicit replacement confirmation. Export current data before replacing it.

This is a personal study tool, not a secure exam system. Questions and answer keys are public static assets. There is no login or server-side admin access; each visitor gets an independent local dataset. Practice percentages are not AWS scaled exam scores.

## Data and backups

Data is tied to the **browser profile and website origin**. There is no automatic device sync. Opening the app in another browser, on another device, or at another hostname creates a separate local dataset. Use JSON export/import to transfer it.

Browser data clearing, private-browsing sessions and automatic storage eviction can remove local records. Keep periodic JSON backups. The optional persistent-storage request may reduce automatic eviction when the browser supports and grants it; it does not prevent manual deletion. The app refuses to start if IndexedDB is unavailable and reports save failures instead of pretending to save.

Daily uniqueness and answer updates use IndexedDB transactions, including a unique daily index. Multiple tabs cannot start independent daily rounds or submit the same question twice. Local clock changes and edited backups are not treated as cheating threats in this personal app.

The supplied CSV contains 1,025 data rows. After skipping **37 completely empty rows and 6 duplicate question texts**, the bank contains **982 unique questions: 972 active and 10 requiring review**. Checks validate answer-key matching and requested answer count, not factual AWS correctness. Invalid entries remain editable but never appear in new rounds until fixed and activated.

The repository CSV is converted to static JSON at build time and imported once per browser. Redeploys never overwrite personal edits or results. To add questions to an existing local bank, use CSV import; duplicate question text/IDs are skipped. Use the editor to change existing questions. Already-started attempts retain their own question snapshots and cannot be regraded by later edits.

CSV headers: `question,correct_answer,option1,option2,option3,option4,option5` (up to `option8`; optional `explanation` and `active`). Correct answers are exact option texts joined with `; `. Embedded semicolons, quoted fields and multiline content are supported. UTF-8 with/without BOM is accepted. `active=false` preserves a disabled question in a CSV roundtrip.

A CSV export includes questions, keys, explanations and activation states. **It does not contain attempts or statistics. Use the complete JSON backup for those.**

## Run locally

Requires Node.js 22 or newer. There are no runtime dependencies. The single development dependency, `fake-indexeddb`, is used for transaction tests only.

```bash
npm ci
npm test
npm run dev
```

Default development address: `http://127.0.0.1:3000`.

```bash
npm run build
```

Publishes self-contained assets to `dist/`, including `dist/admin/index.html`. App screens use hash routing, so no SPA rewrite is required. `/admin` is also a real static directory. Serve over HTTPS or localhost; opening `index.html` directly with `file://` is unsupported.

## Render deployment

- Resource type: **Static Site** (not a Python Web Service).
- Repository: `https://github.com/CVTPRN/aws-saa-practice`, branch `main`.
- Build command: `npm ci && npm test && npm run build`.
- Publish directory: `dist`.
- Environment: `SKIP_INSTALL_DEPS=true` to avoid duplicate automatic installation.
- No disk, database, secrets or paid compute plan.

`render.yaml` documents this configuration. The live site is created directly through Render. The earlier, unapplied paid Blueprint is disabled and manages no resources; do not apply it as a second deployment.

Static hosting is within Render's free offering, subject to its workspace bandwidth and build quotas. Unlike a free web-service container, a static site does not need to wake up before serving the app.

## Validation

`npm test` covers the exact source import counts, CSV parsing and roundtrips, Budapest day boundaries/DST, random selection, exact multiple-answer grading, replay prevention, daily uniqueness across concurrent tabs, persistence after reopening storage, backup validation/restore, and invalid imports. Build runs tests before publication. Browser QA exercises a complete 30-question round, refresh/resume, local question creation and backup download.

The previous Flask implementation remains available in Git history; this version intentionally replaces account authentication with local personal storage.
