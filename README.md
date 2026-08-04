# daily-report-bot

Telegram bot that logs into Taghyeer PM and generates a daily task report.

## Local

```bash
npm install
cp .env.example .env   # fill TELEGRAM_BOT_TOKEN + PM URLs
npm run telegram       # polling mode
```

CLI one-shot: `npm start` (uses `WEBSITE_USERNAME` / `WEBSITE_PASSWORD`).

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

### 1. Push repo to GitHub (done if you followed setup)

### 2. Import in Vercel

1. [vercel.com](https://vercel.com) → **Add New Project** → import `daily-report-bot`
2. Framework Preset: **Other**
3. Root Directory: `.` (default)
4. Build Command: leave empty
5. Output Directory: leave empty
6. Install Command: `npm install`

### 3. Environment variables (Project → Settings → Environment Variables)

Add for **Production** (and Preview if you want):

| Name | Value |
|------|--------|
| `TELEGRAM_BOT_TOKEN` | From @BotFather |
| `WEBSITE_LOGIN_URL` | `https://api.pmv3.taghyeer.ai/api/v1/login` |
| `PM_API_BASE` | `https://api.pmv3.taghyeer.ai/api/v1` |
| `TIMEZONE` | `Asia/Dhaka` |

Do **not** put real passwords in Vercel env for multi-user — users `/login` in Telegram. Optional CLI vars `WEBSITE_USERNAME` / `WEBSITE_PASSWORD` are only for local `npm start`.

### 4. Deploy

Click **Deploy**. Note your URL, e.g. `https://daily-report-bot.vercel.app`

### 5. Register Telegram webhook

Open once in the browser:

```
https://YOUR_APP.vercel.app/api/setup-webhook
```

You should see `"ok": true` and the webhook URL. Then message your bot `/start`.

### Note on sessions

Saved logins are stored in `/tmp` on Vercel (ephemeral). After cold starts or new instances you may need to `/login` again. For permanent storage later, use a database or Redis.

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
