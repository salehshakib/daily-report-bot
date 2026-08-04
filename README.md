# Daily Report Bot

A small Telegram companion for Taghyeer PM.

Log in once, then pull today’s report, check what’s still running after work hours, and pause or complete it — without opening the PM dashboard.

Built as a personal tool. Runs locally for quick iteration, or on Vercel with webhooks + Blob + cron.

---

## What it does

| | |
|---|---|
| **Daily report** | `/run` → today + next working day (Sun–Thu week) |
| **Active task** | `/active` → what’s running, for how long |
| **Quick actions** | `/pause` · `/complete` |
| **After-hours nudge** | From **18:30 Asia/Dhaka**, hourly reminders until you pause/complete |

Sessions are per Telegram user. Passwords stay in private storage (local files, or Vercel Blob in production).

---

## Talk to it

| Command | |
|---------|--|
| `/start` | Help |
| `/login` | Save PM email + password |
| `/run` | Generate today’s report |
| `/active` | Show active task + timers |
| `/pause` | Pause the active task |
| `/complete` | Complete the active task |
| `/logout` | Clear saved credentials |
| `/whoami` | Login status |

**Login** — send two lines (or `/login` first):

```
you@company.com
your-password
```

---

## Sample report

```
Date: 2026-08-04
Name: Saleh Shakib
Projects: Admin Panel, Virtual Trading

Today:
#TASK-2096: api requirements for local lp

Next day: N/A
```

**Next day** = next working day. Thursday rolls to Sunday.

---

## Run locally

```bash
npm install
cp .env.example .env   # fill TELEGRAM_BOT_TOKEN, PM_API_URL, …
npm start
```

Uses Telegram **polling**. Sessions land in `sessions/<telegramUserId>.json`.

> Don’t run local polling and Vercel at the same time — polling replaces the webhook.

---

## Deploy on Vercel

Production uses a **webhook** (polling doesn’t work on serverless).

### 1. Project

1. Import the repo on [vercel.com](https://vercel.com)
2. Framework: **Other** · Install: `npm install`

### 2. Blob (required)

1. **Storage → Create → Blob** · connect to this project  
2. Confirm `BLOB_READ_WRITE_TOKEN` is in env  

Without Blob, logins vanish on cold starts.

### 3. Env vars

| Variable | |
|----------|--|
| `TELEGRAM_BOT_TOKEN` | From [@BotFather](https://t.me/BotFather) |
| `PM_API_URL` | e.g. `https://api.pmv3.taghyeer.ai/api/v1` |
| `TIMEZONE` | `Asia/Dhaka` |
| `BLOB_READ_WRITE_TOKEN` | From Blob store |
| `BLOB_STORE_ID` | Optional |
| `CRON_SECRET` | Long random string (keep private) |

### 4. Wire Telegram

After deploy, open once:

```
https://YOUR_APP.vercel.app/api/setup-webhook
```

Then `/start` in the bot.

### 5. After-hours cron

Hobby can’t schedule “every hour” as one expression, so `vercel.json` lists **once-daily** jobs for:

**18:30 · 19:30 · 20:30 · 21:30 · 22:30 · 23:30** Asia/Dhaka

A ping only fires when:

- it’s at/after 18:30  
- the stored PM JWT is still valid (`exp`)  
- there’s an active task  
- you haven’t `/pause` or `/complete` yet today  

Add `CRON_SECRET`, redeploy, then check **Settings → Cron Jobs**.

---

## Stack

Node 18+ · `node-telegram-bot-api` · Axios · Vercel Blob · Vercel Cron

---

## License

Personal / pet project. Use and fork freely.
