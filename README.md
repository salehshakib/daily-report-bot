# daily-report-bot

Telegram bot that logs into Taghyeer PM and generates a daily task report.

## Local

```bash
npm install
cp .env.example .env   # fill TELEGRAM_BOT_TOKEN + PM_API_URL
npm start
```

Credentials are saved per Telegram user id:
- Local: `sessions/<telegramUserId>.json`
- Vercel: private Blob `sessions/<telegramUserId>.json` (requires `BLOB_READ_WRITE_TOKEN`)

## Commands

| Command | What it does |
|---------|----------------|
| `/start` | Help |
| `/login` | Ask for email/password (two lines) |
| `/run` | Generate today's report |
| `/active` | Show active task |
| `/pause` | Pause active task |
| `/complete` | Complete active task |
| `/logout` | Clear saved credentials |
| `/whoami` | Login status |

Login format:

```
example@gmail.com
example123
```

## Deploy on Vercel

Telegram **polling does not work** on Vercel. This app uses a **webhook**.

### 1. Import in Vercel

1. [vercel.com](https://vercel.com) → **Add New Project** → import `daily-report-bot`
2. Framework Preset: **Other**
3. Install Command: `npm install`

### 2. Add Blob storage (required for saved logins)

1. Vercel project → **Storage** → **Create** → **Blob**
2. Connect it to this project  
3. Ensure env var `BLOB_READ_WRITE_TOKEN` is present (Vercel usually adds it)

Without Blob, logins are lost on cold starts (`/tmp` only).

### 3. Environment variables

| Name | Value |
|------|--------|
| `TELEGRAM_BOT_TOKEN` | From @BotFather |
| `PM_API_URL` | Your PM API base URL (from `.env`) |
| `TIMEZONE` | `Asia/Dhaka` |
| `BLOB_READ_WRITE_TOKEN` | From Vercel Blob store |
| `BLOB_STORE_ID` | Optional |
| `CRON_SECRET` | Random string (same as local `.env`) |

### 4. Deploy, then register webhook

```
https://YOUR_APP.vercel.app/api/setup-webhook
```

Then `/start` in Telegram.

### 5. Cron (active-task alert)

Configured in `vercel.json` — runs **every 30 minutes**.

Alerts only start at **18:30 Asia/Dhaka**, then repeat every 30 minutes while the task is still active and the PM JWT is valid.

If the user `/pause` or `/complete` (or the active task is already gone), that day is marked resolved and cron stops notifying them.

After adding `CRON_SECRET`, redeploy. Confirm under **Vercel → Settings → Cron Jobs**.

> Note: Vercel Hobby may only allow once-daily crons. Frequent schedules need a Pro plan (or an external cron hitting `/api/cron-active-task` with `Authorization: Bearer $CRON_SECRET`).

### Notes

- Stop local `npm start` while using Vercel — polling deletes the webhook.
- `/run` retries PM login up to **3 times**; if all fail it clears that user’s saved credentials and asks them to `/login` again.

## Report format

```
Date: 2026-08-04
Name: Saleh Shakib
Projects: Admin Panel, Virtual Trading

Today:
#TASK-2096: api requirements for local lp

Next day: N/A
```

**Next day** = next working day (Sun–Thu). Thursday → Sunday.
