'use strict';
/**
 * Minimal stdio MCP source: on-disk catalog cache + on-demand connection.
 * - start(): load cached tool list; spawn only when cache is missing/stale.
 * - ensureClient(): connect on a REAL tool call; idle timer disconnects.
 * No network / no token cost at startup when the cache key matches.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function cacheKey(config) {
  const identity = {
    transport: 'stdio', command: config.command, args: config.args,
    env: Object.entries(config.env || {}).sort(),
    cwd: config.cwd, url: config.url, headers: Object.keys(config.headers || {}).sort(),
  };
  return crypto.createHash('sha256').update(JSON.stringify(identity)).digest('hex');
}

class McpSource {
  constructor(config, cachePath) {
    this.config = config;
    this.cachePath = cachePath;
    this.name = config.name || 'rea';
    this.client = null;
    this.connecting = null;
    this.catalog = null;
    this.inFlight = 0;
    this.idleTimer = null;
    this.disposed = false;
  }
  get configuredEnabled() { return this.config.enabled !== false; }
  get connected() { return !!this.client; }
  get toolCount() { return this.catalog ? this.catalog.tools.length : 0; }

  async start() {
    try {
      const c = JSON.parse(fs.readFileSync(this.cachePath, 'utf8'));
      if (c.version === 1 && c.key === cacheKey(this.config) && Array.isArray(c.tools)) {
        this.catalog = c; // cache hit: NO spawn
        return;
      }
    } catch (_) {}
    // cache missing/mismatch: do a one-time discovery (spawn) to build the catalog
    await this.discover(false).catch(() => {});
  }

  _loadMcp() {
    // Resolve the MCP client from our own deps first, then from the DSH host
    // node_modules tree (plugins may live outside that tree).
    if (!this._mcp) {
      try { this._mcp = { StdioClientTransport: require('@modelcontextprotocol/client/stdio').StdioClientTransport, Client: require('@modelcontextprotocol/client').Client }; }
      catch (_) {
        const { createRequire } = require('module');
        const { homedir } = require('os');
        const path = require('path');
        const candidates = [
          path.join(__dirname, '../../node_modules/@modelcontextprotocol/client'),
          path.join(__dirname, '../../../node_modules/@modelcontextprotocol/client'),
          path.join(__dirname, '../../../e-drive-plugin-host/node_modules/@modelcontextprotocol/client'),
          path.join(homedir(), '.dsh', 'profiles', 'desktop', 'node_modules', '@modelcontextprotocol', 'client'),
        ];
        for (const c of candidates) {
          try { const r = createRequire(c + '/x.js'); this._mcp = { StdioClientTransport: r('@modelcontextprotocol/client/stdio').StdioClientTransport, Client: r('@modelcontextprotocol/client').Client }; break } catch (_) {}
        }
      }
    }
    if (!this._mcp) throw new Error('dsh-rea-lazy: @modelcontextprotocol/client not found');
    return this._mcp;
  }

  async _transport() {
    const { StdioClientTransport, Client } = this._loadMcp();
    const transport = new StdioClientTransport({
      command: this.config.command,
      args: this.config.args || [],
      env: { ...process.env, ...(this.config.env || {}) },
      stderr: 'ignore',
    });
    const client = new Client({ name: 'dsh-rea-lazy', version: '2.0.0' });
    await client.connect(transport);
    return client;
  }

  async discover(keepAlive) {
    const client = await this._transport();
    try {
      const tools = [];
      let cursor;
      do {
        const page = await client.listTools(cursor ? { cursor } : {});
        tools.push(...(page.tools || []));
        cursor = page.nextCursor;
      } while (cursor);
      this.catalog = { version: 1, key: cacheKey(this.config), fetchedAt: Date.now(), tools };
      fs.mkdirSync(path.dirname(this.cachePath), { recursive: true });
      const tmp = this.cachePath + '.' + process.pid + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(this.catalog), { mode: 0o600 });
      fs.renameSync(tmp, this.cachePath);
    } finally {
      if (!keepAlive) await this.disconnect();
    }
  }

  async ensureClient() {
    this._clearIdle();
    if (this.client) return this.client;
    if (!this.connecting) {
      this.connecting = this._transport().then(c => {
        this.client = c;
        return c;
      }).finally(() => { this.connecting = null; });
    }
    return this.connecting;
  }

  async call(name, args) {
    const client = await this.ensureClient();
    this.inFlight++;
    try {
      const r = await client.callTool({ name, arguments: args });
      const content = Array.isArray(r.content) ? r.content : [];
      return { content, isError: r.isError === true };
    } finally {
      this.inFlight--;
      this._scheduleIdle();
    }
  }

  _clearIdle() { if (this.idleTimer) { clearTimeout(this.idleTimer); this.idleTimer = null; } }
  _scheduleIdle() {
    this._clearIdle();
    const ms = this.config.idleDisconnectMs || 300000;
    if (this.inFlight === 0 && this.client) {
      this.idleTimer = setTimeout(() => { this.disconnect().catch(() => {}); }, ms);
      this.idleTimer.unref && this.idleTimer.unref();
    }
  }
  async disconnect() {
    this._clearIdle();
    const c = this.client; this.client = null;
    if (c) { try { await c.close(); } catch (_) {} }
  }
  async dispose() { this.disposed = true; await this.disconnect(); }
}

module.exports = { McpSource, cacheKey };
