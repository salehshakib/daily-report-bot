# Daily Report Bot

A small Telegram companion for Taghyeer PM.

Log in once, then pull today’s report, check what’s still running after work hours, and pause or complete it — without opening the PM dashboard.

Built as a personal tool. Runs locally for quick iteration, or on Vercel with webhooks + Blob, with the after-hours cron on GitHub Actions.

---

## How I built it

I started with [@BotFather](https://t.me/BotFather) — created the bot, grabbed the token, and got a basic Telegram listener talking to Taghyeer PM.

From there it grew with whatever I actually needed day to day:

1. **Daily report** — `/run` for today + next working day  
2. **Login per user** — save PM credentials, survive Vercel cold starts with Blob  
3. **Active task** — `/active`, `/pause`, `/complete` when something is still running  
4. **After-hours reminders** — hourly pings from 18:30 Dhaka until I pause or complete  

Not a product roadmap — just features I asked for as the workflow got clearer.

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
| `/run 2026-09-13` | Report for a specific day (yyyy-mm-dd) |
| `/etwt` | Estimated vs actual work time for last, this and next week (Sun–Thu), one message each |
| `/etwt 2026-09-10 2026-09-13` | Estimated vs actual work time over a date range |
| `/etwt_all` | Every assignee’s ET/WT as a Date/ET/WT table, one row per week (same three weeks) |
| `/etwt_all 2026-09-10 2026-09-13` | Every assignee’s ET/WT totals over a date range |
| `/daily_report_all` | All assignees’ today tasks (due-date filter) |
| `/next_day_task_all` | All assignees’ next-day tasks (due-date filter) |
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

2026-08-04:
#TASK-2096: api requirements for local lp

2026-08-05: N/A
```

Second section = next working day. Thursday rolls to Sunday.

---

## Run locally

```bash
npm install
cp .env.example .env   # fill in your values
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

**Storage → Create → Blob** and connect it to this project. Without Blob, logins vanish on cold starts.

Copy the same keys from `.env.example` into the Vercel project (Production), then redeploy.

### 3. Wire Telegram

After deploy, open once:

```
https://YOUR_APP.vercel.app/api/setup-webhook
```

Then `/start` in the bot.

### 4. After-hours cron

Vercel Hobby only allows **once-per-day** crons, so the schedule lives in GitHub Actions instead — [`.github/workflows/active-task-alerts.yml`](.github/workflows/active-task-alerts.yml) curls `/api/cron-active-task` at:

**18:30 · 19:30 · 20:30 · 21:30 · 22:30 · 23:30** Asia/Dhaka

Add two repository secrets (**Settings → Secrets and variables → Actions**):

| secret | value |
|---|---|
| `APP_URL` | `https://YOUR_APP.vercel.app` |
| `CRON_SECRET` | same value as the Vercel env var |

Run it once by hand from the **Actions** tab to check the wiring.

A ping only fires when:

- it’s at/after 18:30  
- credentials are stored (an expired JWT is refreshed automatically)  
- there’s an active task  
- you haven’t `/pause` or `/complete` yet today  

---

## Stack

Node 18+ · `node-telegram-bot-api` · Axios · Vercel Blob · GitHub Actions cron

---

## License

Personal / pet project. Use and fork freely.
