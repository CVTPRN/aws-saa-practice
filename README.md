# SAA Studio — AWS SAA-C03 Practice

Hungarian learning dashboard with the original English questions. Built with Flask, server-rendered Jinja templates and SQLite on a persistent Render disk. No third-party frontend/CDN dependencies.

## Features

- Username/password registration and login (scrypt password hashes, CSRF protection, secure cookies on Render, throttled authentication).
- One persistent 30-question daily attempt per user and **Europe/Budapest calendar day**. Refreshing, logging out or restarting the service never resets an existing attempt.
- Unlimited free practice: each start samples 30 distinct active questions. Different rounds may overlap.
- Every submitted answer is saved. Unsubmitted selections are not saved. Resume unfinished attempts from the dashboard.
- Exact-match grading for multiple answers. Results and correct answers are revealed only after completing all 30 questions. Practice percentages are not AWS scaled exam scores.
- Daily accuracy, session history, a 28-day activity grid and practice streaks. Daily statistics use the **completion day** in Budapest and include completed rounds only.
- `/admin`: add/edit/disable questions, search, review invalid rows, import CSV and export the question bank.
- Each attempt stores a snapshot, so later admin edits cannot change its grading.

## Imported question bank

The supplied CSV has 1,025 data rows: 37 completely empty rows and 6 repeated question texts are skipped. The resulting bank has **982 unique questions: 972 active and 10 requiring review**. Validation checks that answer text matches the options and the requested answer count. It does not verify factual AWS correctness. Inconsistent records remain editable in `/admin?status=review`; they never enter new attempts until fixed and activated. The original file is preserved in `data/questions.csv`.

Seeding happens once per database. Redeploys do not overwrite admin changes. Further files should be imported through `/admin`.

CSV headers: `question,correct_answer,option1,option2,option3,option4,option5` (up to `option8` supported). Multiple correct answers are exact option texts separated by `; `. Semicolons inside option text are supported. UTF-8 with or without BOM is accepted. Duplicate question text is skipped, not overwritten. The CSV export preserves questions/answer keys, but not activation states or explanations; it is **not** a full application backup.

## Local run

```bash
python -m venv .venv
.venv/bin/pip install -r requirements.txt
export SECRET_KEY="$(python -c 'import secrets; print(secrets.token_hex(32))')"
export ADMIN_SETUP_TOKEN="$(python -c 'import secrets; print(secrets.token_urlsafe(32))')"
.venv/bin/flask --app 'app:create_app()' run
```

Local data is saved in `instance/practice.db`. Visit `/setup`, enter the setup token, and choose your own admin username and password (12–128 characters). Ordinary users sign up at `/register`. Public registration **never** grants administrator access, including to the first registered user. `/setup` closes as soon as the admin exists. `/account` changes your own password.

## Render deployment

`render.yaml` defines one Python web service in Frankfurt (Starter plan) and a 1 GB persistent disk mounted at `/var/data`. SQLite stores users, questions and all progress on that disk. Do not deploy with ephemeral storage or remove the disk: local changes would be lost. The estimated base charge is $7/month compute plus $0.25/month storage, before tax and any usage overages; check the current Render plan before applying.

Render generates `SECRET_KEY` and `ADMIN_SETUP_TOKEN`. It sets `DATABASE_PATH=/var/data/practice.db`. The app uses one Gunicorn worker with four threads and SQLite transactions. This deployment is intended for personal/small-group practice, not horizontal scaling. Disk-attached redeploys have a brief interruption.

After the deploy is live:

1. In the service's **Environment** page, reveal `ADMIN_SETUP_TOKEN` privately.
2. Open `https://<your-service>.onrender.com/setup`.
3. Enter that token and set your own admin credentials.
4. Use `/admin` to manage questions. The setup token alone cannot log in after setup has closed.

Never commit passwords, environment files, session secrets or database files. Do not paste the setup token into a URL. Keep disk snapshots/backups; for a consistent manual SQLite backup, use SQLite's `.backup` command or Python's `sqlite3.Connection.backup`, not a raw copy of an active database without its WAL.

Health check: `GET /health` checks the database connection. The build only installs dependencies. Database initialization runs at service startup, when the persistent disk is mounted. No external AWS account or API keys are required.

## Tests

```bash
.venv/bin/pip install pytest==8.4.2
.venv/bin/python -m pytest -q
```

Covers import validation, duplicate/idempotent seeding, password storage, CSRF, admin isolation, one-time setup, daily uniqueness and concurrent starts, daily rollover, saved answers, replay prevention, grading, attempt ownership, snapshots, CSV import/export, XSS escaping and authentication throttling.
