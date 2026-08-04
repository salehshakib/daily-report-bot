const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PID_FILE = path.join(__dirname, '.run.pid');

function isAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function commandLineFor(pid) {
  try {
    if (process.platform === 'win32') {
      const out = execSync(
        `wmic process where "ProcessId=${pid}" get CommandLine /VALUE`,
        { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }
      );
      const match = out.match(/CommandLine=(.*)/i);
      return (match ? match[1] : '').trim();
    }
    return fs.readFileSync(`/proc/${pid}/cmdline`, 'utf8').replace(/\0/g, ' ');
  } catch {
    return '';
  }
}

function looksLikeOurScript(cmd) {
  return /index\.js/.test(cmd);
}

function killPid(pid) {
  try {
    if (process.platform === 'win32') {
      execSync(`taskkill /F /PID ${pid} /T`, { stdio: 'ignore' });
    } else {
      process.kill(pid, 'SIGTERM');
    }
  } catch {
    // already gone
  }
}

function sleepSync(ms) {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    /* wait for OS to release Telegram polling lock */
  }
}

function cleanupPidFile() {
  try {
    if (!fs.existsSync(PID_FILE)) return;
    const stored = fs.readFileSync(PID_FILE, 'utf8').trim();
    if (stored === String(process.pid)) {
      fs.unlinkSync(PID_FILE);
    }
  } catch {
    // ignore
  }
}

/**
 * Ensure only one project script runs at a time.
 * Stops the previous instance (if still alive) before continuing.
 */
function claimSingleInstance() {
  if (fs.existsSync(PID_FILE)) {
    const prev = parseInt(fs.readFileSync(PID_FILE, 'utf8').trim(), 10);
    if (prev && prev !== process.pid && isAlive(prev)) {
      const cmd = commandLineFor(prev);
      // Kill if cmdline matches our scripts, or cmdline unknown (stale pid file we wrote)
      if (!cmd || looksLikeOurScript(cmd)) {
        console.log(`Stopping previous instance (pid ${prev})...`);
        killPid(prev);
        sleepSync(800);
      }
    }
  }

  fs.writeFileSync(PID_FILE, String(process.pid), 'utf8');

  process.on('exit', cleanupPidFile);
  process.on('SIGINT', () => {
    cleanupPidFile();
    process.exit(0);
  });
  process.on('SIGTERM', () => {
    cleanupPidFile();
    process.exit(0);
  });
}

module.exports = { claimSingleInstance };
