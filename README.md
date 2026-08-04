# daily-report-bot

Telegram bot that logs into Taghyeer PM and generates a daily task report.

## Local

```bash
npm install
cp .env.example .env   # fill TELEGRAM_BOT_TOKEN + PM_API_URL
npm run telegram
```

Credentials are saved in `sessions.json` keyed by Telegram user id (gitignored).

## Commands

| Command | What it does |
|---------|----------------|
| `/start` | Help + Telegram user id |
| `/login` | Ask for email/password (two lines) |
| `/run` | Login with saved credentials (retries 3x) then generate report |
| `/logout` | Clear saved credentials |
| `/whoami` | Telegram id + login status |

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
| `PM_API_URL` | `https://api.pmv3.taghyeer.ai/api/v1` |
| `TIMEZONE` | `Asia/Dhaka` |
| `BLOB_READ_WRITE_TOKEN` | From Vercel Blob store |
| `BLOB_STORE_ID` | Optional |

### 4. Deploy, then register webhook

```
https://YOUR_APP.vercel.app/api/setup-webhook
```

Then `/start` in Telegram.

### Notes

- Stop local `npm run telegram` while using Vercel — polling deletes the webhook.
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
