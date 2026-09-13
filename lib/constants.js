const BOT_COMMANDS = [
  { command: 'start', description: 'Show help' },
  { command: 'login', description: 'Login — bot will ask for email and password' },
  { command: 'run', description: "Today's report, or /run dd-mm-yyyy for another day" },
  { command: 'etwt', description: 'Estimated vs work time: /etwt dd-mm-yyyy dd-mm-yyyy' },
  { command: 'daily_report_all', description: "All users' today report" },
  { command: 'next_day_task_all', description: "All users' next-day tasks" },
  { command: 'active', description: 'Show your active task' },
  { command: 'pause', description: 'Pause your active task' },
  { command: 'complete', description: 'Complete your active task' },
  { command: 'logout', description: 'Clear saved email and password' },
  { command: 'whoami', description: 'Show login status' },
];

const CREDENTIALS_PROMPT =
  'Please send your email and password in this format:\n\nexample@gmail.com\nexample123';

const LOGIN_REQUIRED = 'No credentials saved.\nPlease login first:\n/login';

const SESSION_EXPIRED = 'Session expired.\nPlease /login again.';

const RUN_USAGE = 'Usage:\n/run\n/run dd-mm-yyyy';

const ETWT_USAGE =
  'Usage:\n/etwt dd-mm-yyyy dd-mm-yyyy\n\nExample:\n/etwt 10-09-2026 13-09-2026\n\nOne date works too: /etwt 13-09-2026';

/** Telegram hard-caps messages at 4096 chars; leave headroom for HTML. */
const TELEGRAM_MAX_MESSAGE = 4000;

const MAX_RUN_ATTEMPTS = 3;

module.exports = {
  BOT_COMMANDS,
  CREDENTIALS_PROMPT,
  LOGIN_REQUIRED,
  SESSION_EXPIRED,
  RUN_USAGE,
  ETWT_USAGE,
  TELEGRAM_MAX_MESSAGE,
  MAX_RUN_ATTEMPTS,
};
