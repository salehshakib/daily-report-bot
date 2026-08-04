const {
  getSession,
  clearSession,
  replaceSession,
  setPendingLogin,
  clearPendingLogin,
} = require('../sessions');
const { getAuth, runPipeline } = require('./report');

const BOT_COMMANDS = [
  { command: 'start', description: 'Show help' },
  { command: 'login', description: 'Login — bot will ask for email and password' },
  { command: 'run', description: "Generate today's report" },
  { command: 'logout', description: 'Clear saved email and password' },
  { command: 'whoami', description: 'Show login status' },
];

const CREDENTIALS_PROMPT =
  'Please send your email and password in this format:\n\nexample@gmail.com\nexample123';

const MAX_RUN_ATTEMPTS = 3;

function helpText() {
  return [
    'Commands:',
    ...BOT_COMMANDS.map(c => `/${c.command} — ${c.description}`),
  ].join('\n');
}

function parseEmailPassword(text) {
  const trimmed = (text || '').trim();
  if (!trimmed) return null;

  const lines = trimmed
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean);

  if (lines.length >= 2) {
    return { email: lines[0], password: lines.slice(1).join('\n') };
  }

  const space = trimmed.indexOf(' ');
  if (space > 0 && trimmed.includes('@')) {
    const email = trimmed.slice(0, space).trim();
    const password = trimmed.slice(space + 1).trim();
    if (email && password) return { email, password };
  }

  return null;
}

function commandName(text) {
  if (!text || !text.startsWith('/')) return null;
  const token = text.trim().split(/\s+/)[0];
  return token.split('@')[0].slice(1).toLowerCase();
}

async function completeLogin(bot, msg, email, password) {
  const chatId = msg.chat.id;
  const telegramUserId = String(msg.from.id);

  try {
    await bot.deleteMessage(chatId, msg.message_id);
  } catch {
    // ignore
  }

  try {
    await bot.sendMessage(chatId, 'Logging in...');
    const auth = await getAuth(email, password);
    await replaceSession(telegramUserId, {
      email,
      password,
      name: auth.name,
    });
    await bot.sendMessage(
      chatId,
      `Login successful\nLogged in as ${auth.name} (${auth.email}).\n\nUse /run to generate your report.`
    );
  } catch (err) {
    console.error('completeLogin error:', err);
    const detail = err.response?.data?.message || err.message;
    await bot.sendMessage(chatId, `Login failed: ${detail}`);
  }
}

async function runWithRetries(email, password) {
  let lastError;
  for (let attempt = 1; attempt <= MAX_RUN_ATTEMPTS; attempt++) {
    try {
      return await runPipeline({ email, password });
    } catch (err) {
      lastError = err;
      console.error(`Report attempt ${attempt}/${MAX_RUN_ATTEMPTS} failed:`, err.message);
    }
  }
  throw lastError;
}

async function handleUpdate(bot, update) {
  const msg = update.message;
  if (!msg || !msg.from) return;

  const chatId = msg.chat.id;
  const telegramUserId = String(msg.from.id);
  const text = (msg.text || '').trim();
  const cmd = commandName(text);

  if (cmd === 'start') {
    await bot.sendMessage(chatId, helpText());
    return;
  }

  if (cmd === 'whoami') {
    const session = await getSession(telegramUserId);
    const status =
      session?.email && session?.password
        ? `Logged in as ${session.email} (${session.name || 'unknown'})`
        : 'Not logged in — use /login';
    await bot.sendMessage(chatId, status);
    return;
  }

  if (cmd === 'logout') {
    await clearSession(telegramUserId);
    await bot.sendMessage(
      chatId,
      'Logged out. Email and password cleared for your account.'
    );
    return;
  }

  if (cmd === 'login') {
    await setPendingLogin(telegramUserId, { step: 'credentials' });
    await bot.sendMessage(chatId, CREDENTIALS_PROMPT);
    return;
  }

  if (cmd === 'run') {
    const session = await getSession(telegramUserId);

    if (!session?.email || !session?.password) {
      await bot.sendMessage(
        chatId,
        'No credentials saved.\nPlease login first:\n/login'
      );
      return;
    }

    try {
      await bot.sendMessage(chatId, 'Generating report...');
      const report = await runWithRetries(session.email, session.password);
      console.log(`[tg:${telegramUserId}] ${session.email}\n${report}`);
      await bot.sendMessage(chatId, report);
    } catch (err) {
      console.error(err.response?.data || err.message || err);
      await clearSession(telegramUserId);
      await bot.sendMessage(
        chatId,
        'Some error occurred.\nPlease /login again with proper credentials.'
      );
    }
    return;
  }

  if (!text || text.startsWith('/')) return;

  const parsed = parseEmailPassword(text);
  if (parsed) {
    await completeLogin(bot, msg, parsed.email, parsed.password);
    return;
  }

  const session = await getSession(telegramUserId);
  const pending = session?.pendingLogin;

  if (pending?.step === 'password') {
    await completeLogin(bot, msg, pending.email, text);
    return;
  }

  if (text.includes('@') && !text.includes(' ')) {
    await setPendingLogin(telegramUserId, { step: 'password', email: text });
    await bot.sendMessage(chatId, 'Now send your password.');
    return;
  }

  await bot.sendMessage(
    chatId,
    `I could not read your login.\nSend /login first, then:\n\nexample@gmail.com\nexample123`
  );
}

function registerBotHandlers(bot) {
  bot
    .setMyCommands(BOT_COMMANDS)
    .catch(err => console.error('Failed to set bot commands:', err.message));

  bot.on('message', async msg => {
    try {
      await handleUpdate(bot, { message: msg });
    } catch (err) {
      console.error(err);
      try {
        if (msg?.chat?.id) {
          await bot.sendMessage(msg.chat.id, `Error: ${err.message}`);
        }
      } catch {
        // ignore
      }
    }
  });
}

module.exports = {
  BOT_COMMANDS,
  handleUpdate,
  registerBotHandlers,
};
