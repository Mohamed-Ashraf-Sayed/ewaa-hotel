const { prisma } = require('../lib/db');
const { pollOnce } = require('./poller');

let timer = null;
let running = false;

async function tick() {
  if (running) return;
  running = true;
  try {
    const result = await pollOnce({ verbose: true });
    if (result.ok && result.processed > 0) {
      console.log(`[scheduler] processed ${result.processed} (newer:${result.newer || 0} backfill:${result.older || 0})`);
      if (!result.backfillDone && result.older > 0) {
        setTimeout(tick, 5000);
      }
    }
  } catch (e) {
    console.error('[scheduler] tick error:', e.message);
  } finally {
    running = false;
  }
}

async function start() {
  await reschedule();
  console.log('[scheduler] started');
}

async function reschedule() {
  if (timer) clearInterval(timer);
  const account = await prisma.otaImapAccount.findFirst({ where: { enabled: true } });
  const intervalSec = account?.pollIntervalSec || 120;
  timer = setInterval(tick, intervalSec * 1000);
  console.log(`[scheduler] interval set to ${intervalSec}s`);
}

function stop() {
  if (timer) clearInterval(timer);
  timer = null;
}

module.exports = { start, stop, reschedule, tick };
