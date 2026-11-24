'use strict';
/** Compact capability index + family-based search over cached MCP tools. */
function summarizeFamilies(tools, families) {
  const fam = new Map();
  for (const rule of families || []) fam.set(rule.name, { name: rule.name, description: rule.description || '', count: 0, examples: [] });
  const glob = (pat, s) => {
    const r = new RegExp('^' + String(pat).replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$');
    return r.test(s);
  };
  for (const t of tools) {
    const name = t.name;
    let hit = null;
    for (const rule of families || []) {
      if ((rule.match || []).some(p => glob(p, name))) { hit = rule.name; break; }
    }
    if (!hit) hit = 'misc';
    if (!fam.has(hit)) fam.set(hit, { name: hit, description: '', count: 0, examples: [] });
    const f = fam.get(hit);
    f.count++;
    if (f.examples.length < 4) f.examples.push(name);
  }
  return [...fam.values()].filter(f => f.count > 0);
}

function search(tools, query, limit = 8) {
  const q = String(query || '').toLowerCase().trim();
  if (!q) return [];
  const scored = [];
  for (const t of tools) {
    const name = (t.name || '').toLowerCase();
    const desc = (t.description || '').toLowerCase();
    let score = 0;
    if (name === q) score = 100;
    else if (name.includes(q)) score = 60;
    else if (q.split(/\s+/).some(w => name.includes(w))) score = 30;
    else if (desc.includes(q)) score = 10;
    if (score) scored.push({ t, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map(x => x.t);
}

function renderIndex(tools, families) {
  const fams = summarizeFamilies(tools, families);
  const lines = ['[REA capability index]'];
  for (const f of fams) {
    lines.push(`- ${f.name} (${f.count}): ${f.examples.join(', ')}${f.count > f.examples.length ? ', …' : ''}`);
  }
  lines.push('Find one with `capability_search`, read parameters with `capability_describe`, call with `capability_call`.');
  return lines.join('\n');
}

module.exports = { summarizeFamilies, search, renderIndex };
