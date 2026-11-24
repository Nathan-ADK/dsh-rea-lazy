'use strict';
/**
 * dsh-rea-lazy v2.0.0 — self-contained on-demand REA capability layer.
 * Includes its own compact-index + search/describe/call meta-tools,
 * on-disk catalog cache and on-demand spawn. No third-party catalog required.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');
const { McpSource, cacheKey } = require('./core/mcp-source');
const { renderIndex } = require('./core/catalog');
const { createTools } = require('./core/tools');
const { createUpdater } = require('./core/updater');

function which(name) {
  try {
    const cmd = process.platform === 'win32' ? 'where' : 'which';
    const r = spawnSync(cmd, [name], { encoding: 'utf8', timeout: 3000 });
    if (r.status === 0 && r.stdout) return String(r.stdout).split(/\r?\n/).find(Boolean).trim();
  } catch (_) {}
  return null;
}
function readEnvFile() {
  try {
    const home = process.env.DSH_HOME || path.join(os.homedir(), '.dsh');
    const f = path.join(home, '.env');
    if (!fs.existsSync(f)) return {};
    const out = {};
    for (const line of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (m) out[m[1]] = m[2];
    }
    return out;
  } catch (_) { return {}; }
}
function findRea() {
  const envCmd = process.env.REA_COMMAND || readEnvFile().REA_COMMAND;
  if (envCmd && envCmd.trim()) {
    const p = envCmd.trim().split(/\s+/);
    return { command: p[0], args: p.slice(1) };
  }
  const onPath = which('rea');
  if (onPath) return { command: onPath, args: ['mcp'] };
  const roots = [
    path.join(__dirname, '..', 'node_modules', 'rea-agents'),
    path.join(process.cwd(), 'node_modules', 'rea-agents'),
    path.resolve(__dirname, '../../../node_modules/rea-agents'),
  ];
  for (const root of roots) {
    const entry = path.join(root, 'scripts', 'rea.mjs');
    if (fs.existsSync(entry)) return { command: process.execPath, args: [entry, 'mcp'] };
  }
  return null;
}

const FAMILIES = require('./core/families');

async function apply(ctx, config = {}) {
  const found = findRea();
  if (!found) {
    (ctx.logger && ctx.logger.warn) && ctx.logger.warn('[dsh-rea-lazy] no REA found; set REA_COMMAND');
    return;
  }
  const home = process.env.DSH_HOME || path.join(os.homedir(), '.dsh');
  const cacheDir = config.cacheDir || process.env.REA_CACHE_DIR || path.join(home, 'capability-catalog');
  const cachePath = path.join(cacheDir, 'mcp-rea.json');
  const server = {
    name: 'rea', command: found.command, args: found.args, env: config.env || {},
    headers: config.headers || {}, idleDisconnectMs: config.idleDisconnectMs || 300000,
  };
  const source = new McpSource(server, cachePath);
  await source.start(); // cache hit = no spawn; miss = one discovery
  ctx.effect(() => () => source.dispose(), 'dsh-rea-lazy.source');

  // register three meta-tools
  if (ctx.tools && ctx.tools.register) {
    for (const t of createTools({ source, families: FAMILIES, ctx, limits: config.limits })) {
      try { ctx.tools.register(t); } catch (_) {}
    }
  }
  // inject compact index into system prompt (section API, like the reference catalog)
  if (ctx.systemPrompt && ctx.systemPrompt.section) {
    try {
      ctx.systemPrompt.section({
        name: 'dsh-rea-lazy',
        order: 40,
        interpolate: false,
        text: () => renderIndex(source.catalog ? source.catalog.tools : [], FAMILIES),
      });
    } catch (_) {}
  }

  // daily upstream check (no spawn, no token)
  const updater = createUpdater({
    cacheDir, markerPath: path.join(cacheDir, 'update-marker.json'),
    intervalMs: config.checkIntervalMs === undefined ? 86400000 : config.checkIntervalMs,
    logger: ctx.logger,
  });
  updater.start();
  ctx.effect(() => () => updater.stop(), 'dsh-rea-lazy.updater');

  ctx.reaRefresh = async () => { await source.discover(true); return source.toolCount; };
}

module.exports = { name: 'dsh-rea-lazy', inject: ['tools', 'systemPrompt'], apply, findRea, cacheKey };
