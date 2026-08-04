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

Hobby plans cannot run one recurring hourly cron, so `vercel.json` defines **separate once-daily jobs** for:

**18:30, 19:30, 20:30, 21:30, 22:30, 23:30 Asia/Dhaka**

Each run only notifies if:
- time is at/after 18:30
- PM JWT is still valid
- user has an active task
- user has not already `/pause` or `/complete` today (`activeTaskResolvedDate`)

After adding `CRON_SECRET`, redeploy. Confirm under **Vercel → Settings → Cron Jobs**.

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
