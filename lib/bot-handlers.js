const {
  getSession,
  setSession,
  clearSession,
  setPendingLogin,
  clearPendingLogin,
} = require('../sessions');
const { getAuth, runPipeline } = require('./report');

const BOT_COMMANDS = [
  { command: 'start', description: 'Show help and your Telegram user id' },
  { command: 'login', description: 'Login — bot will ask for email and password' },
  { command: 'run', description: "Generate today's report" },
  { command: 'logout', description: 'Clear saved email and password' },
  { command: 'whoami', description: 'Show Telegram id and login status' },
];

const CREDENTIALS_PROMPT =
  'Please send your email and password in this format:\n\nexample@gmail.com\nexample123';

function helpText(telegramUserId) {
  return [
    `Your Telegram user id: ${telegramUserId}`,
    '',
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

  return null;
}

async function completeLogin(tgBot, msg, email, password) {
  const chatId = msg.chat.id;
  const telegramUserId = String(msg.from.id);

  try {
    await tgBot.deleteMessage(chatId, msg.message_id);
  } catch {
    // ignore
  }

  try {
    await tgBot.sendMessage(chatId, 'Logging in...');
    const auth = await getAuth(email, password);
    clearPendingLogin(telegramUserId);
    setSession(telegramUserId, {
      email,
      password,
      name: auth.name,
      assigneeId: auth.assigneeId,
      telegramUsername: msg.from.username || null,
      telegramFirstName: msg.from.first_name || null,
    });
    await tgBot.sendMessage(
      chatId,
      `Login successful\nLogged in as ${auth.name} (${auth.email}).\n\nUse /run to generate your report.`
    );
  } catch (err) {
    const detail = err.response?.data?.message || err.message;
    await tgBot.sendMessage(chatId, `Login failed: ${detail}`);
  }
}

function registerBotHandlers(tgBot) {
  tgBot
    .setMyCommands(BOT_COMMANDS)
    .catch(err => console.error('Failed to set bot commands:', err.message));

  tgBot.onText(/\/start(?:@\w+)?/, async msg => {
    const chatId = msg.chat.id;
    const telegramUserId = String(msg.from.id);
    clearPendingLogin(telegramUserId);
    await tgBot.sendMessage(chatId, helpText(telegramUserId));
  });

  tgBot.onText(/\/whoami(?:@\w+)?/, async msg => {
    const chatId = msg.chat.id;
    const telegramUserId = String(msg.from.id);
    clearPendingLogin(telegramUserId);
    const session = getSession(telegramUserId);
    const status = session?.email
      ? `Logged in as ${session.email} (${session.name || 'unknown'})`
      : 'Not logged in — use /login';
    await tgBot.sendMessage(
      chatId,
      `Telegram id: ${telegramUserId}\n${status}`
    );
  });

  tgBot.onText(/\/logout(?:@\w+)?/, async msg => {
    const chatId = msg.chat.id;
    const telegramUserId = String(msg.from.id);
    clearSession(telegramUserId);
    await tgBot.sendMessage(chatId, 'Logged out. Email and password cleared for your account.');
  });

  tgBot.onText(/\/login(?:@\w+)?/, async msg => {
    const chatId = msg.chat.id;
    const telegramUserId = String(msg.from.id);
    setPendingLogin(telegramUserId, { step: 'credentials' });
    await tgBot.sendMessage(chatId, CREDENTIALS_PROMPT);
  });

  tgBot.onText(/\/run(?:@\w+)?/, async msg => {
    const chatId = msg.chat.id;
    const telegramUserId = String(msg.from.id);
    clearPendingLogin(telegramUserId);
    const session = getSession(telegramUserId);

    if (!session?.email || !session?.password) {
      await tgBot.sendMessage(
        chatId,
        'No credentials saved.\nPlease login first:\n/login'
      );
      return;
    }

    try {
      await tgBot.sendMessage(chatId, 'Generating report...');
      const { message } = await runPipeline({
        email: session.email,
        password: session.password,
      });
      console.log(`[tg:${telegramUserId}] ${session.email}\n${message}`);
      await tgBot.sendMessage(chatId, message);
    } catch (err) {
      console.error(err.response?.data || err.message || err);
      const detail = err.response?.data?.message || err.message;
      await tgBot.sendMessage(chatId, `Error: ${detail}`);
    }
  });

  tgBot.on('message', async msg => {
    if (!msg.from || !msg.text) return;
    if (msg.text.startsWith('/')) return;

    const telegramUserId = String(msg.from.id);
    const session = getSession(telegramUserId);
    const pending = session?.pendingLogin;
    if (!pending) return;

    const text = msg.text.trim();

    if (pending.step === 'password') {
      if (!text) {
        await tgBot.sendMessage(msg.chat.id, 'Please send your password.');
        return;
      }
      await completeLogin(tgBot, msg, pending.email, text);
      return;
    }

    const parsed = parseEmailPassword(text);
    if (parsed) {
      await completeLogin(tgBot, msg, parsed.email, parsed.password);
      return;
    }

    if (text.includes('@')) {
      setPendingLogin(telegramUserId, { step: 'password', email: text });
      await tgBot.sendMessage(msg.chat.id, 'Now send your password.');
      return;
    }

    await tgBot.sendMessage(msg.chat.id, CREDENTIALS_PROMPT);
  });
}

module.exports = {
  BOT_COMMANDS,
  registerBotHandlers,
};
