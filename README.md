# daily-report-bot

Telegram bot that logs into Taghyeer PM and generates a daily task report.

## Local

```bash
npm install
cp .env.example .env   # fill TELEGRAM_BOT_TOKEN + PM_API_URL
npm run telegram
```

Users provide PM email/password via Telegram `/login` — nothing stored in `.env`.

## Commands

| Command | What it does |
|---------|----------------|
| `/start` | Help + Telegram user id |
| `/login` | Ask for email/password (two lines) |
| `/run` | Generate report with saved credentials |
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
3. Root Directory: `.` (default)
4. Build Command: leave empty
5. Output Directory: leave empty
6. Install Command: `npm install`

### 2. Environment variables

| Name | Value |
|------|--------|
| `TELEGRAM_BOT_TOKEN` | From @BotFather |
| `PM_API_URL` | `https://api.pmv3.taghyeer.ai/api/v1` |
| `TIMEZONE` | `Asia/Dhaka` |

### 3. Deploy, then register webhook

Open once:

```
https://YOUR_APP.vercel.app/api/setup-webhook
```

Then message the bot `/start`.

### Note

- Stop local `npm run telegram` while using Vercel — local polling deletes the webhook.
- After deploy, open `/api/setup-webhook` again if `/start` stops working.
- Saved logins live in `/tmp` on Vercel (ephemeral). You may need `/login` again after cold starts.

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
