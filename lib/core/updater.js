'use strict';
/**
 * Daily update check for REA tooling.
 * Pure HTTP metadata check against the npm registry: no REA spawn, no token
 * cost, no context injection. Writes a marker file only when a new upstream
 * version is seen. Tool-list refresh remains user-triggered (via refresh()).
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

function checkRegistry(pkg) {
  return new Promise((resolve) => {
    const req = https.get({ host: 'registry.npmjs.org', path: '/' + encodeURIComponent(pkg), headers: { 'User-Agent': 'dsh-rea-lazy' }, timeout: 8000 }, (res) => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => { try { const j = JSON.parse(d); resolve(j['dist-tags'] && j['dist-tags'].latest || null); } catch (_) { resolve(null); } });
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
  });
}

function createUpdater({ cacheDir, markerPath, intervalMs = 86400000, logger }) {
  let timer = null;
  let lastVersion = null;
  try { const m = JSON.parse(fs.readFileSync(markerPath, 'utf8')); lastVersion = m.lastVersion || null; } catch (_) {}
  async function check() {
    const latest = await checkRegistry('rea-agents');
    if (!latest || latest === lastVersion) return;
    lastVersion = latest;
    try {
      fs.mkdirSync(path.dirname(markerPath), { recursive: true });
      fs.writeFileSync(markerPath, JSON.stringify({ lastVersion: latest, checkedAt: new Date().toISOString() }), 'utf8');
    } catch (_) {}
    try { logger && logger.info && logger.info(`[dsh-rea-lazy] upstream rea-agents ${latest} available; tool catalog can be refreshed on demand`); } catch (_) {}
  }
  function start() {
    if (intervalMs <= 0) return;
    check().catch(() => {});
    timer = setInterval(() => check().catch(() => {}), intervalMs);
    if (timer.unref) timer.unref();
  }
  function stop() { if (timer) { clearInterval(timer); timer = null; } }
  return { start, stop, check };
}

module.exports = { createUpdater };
