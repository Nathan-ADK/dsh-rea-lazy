'use strict';
/**
 * Family assignment: curated glob rules first, then a name-derived heuristic.
 * Reimplemented in-house from the published algorithm description (subject-word
 * frequency clustering): verbs and generic words are ignored; a tool joins the
 * family of its most widely shared subject word, small groups fold into misc.
 */
const VERBS = new Set(('add analyze annotate apply batch build call capture check close collect compare correlate create current decode decompile delete demangle describe discover evaluate execute export extract fetch find get goto identify import inspect install instrument list load next observe open prev project pull push query read reconcile record recover remove resolve resume run search send set start stop trace uninstall unload unset update upload verify write').split(' '));
const GENERIC = new Set(('to with of and session status command console client target targets file files data info the a').split(' '));

function globToRegExp(glob) {
  const e = glob.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.');
  return new RegExp('^' + e + '$', 'u');
}
function words(name) {
  return String(name).split(/[_\-.:]+|(?<=[a-z0-9])(?=[A-Z])/u).map(w => w.toLowerCase()).filter(Boolean);
}
function subjectWords(name) {
  const s = words(name).filter(w => !VERBS.has(w) && !GENERIC.has(w));
  return s.length ? s : [words(name)[0] || 'misc'];
}

/** Assign every tool name to a family: curated rules win, heuristic fills the rest. */
function assignFamilies(names, rules, minSize = 3) {
  const family = new Map();
  const compiled = (rules || []).map(r => ({ r, p: (r.match || []).map(globToRegExp) }));
  const unassigned = [];
  for (const name of names) {
    const hit = compiled.find(({ p }) => p.some(re => re.test(name)));
    if (hit) family.set(name, hit.r.name);
    else unassigned.push(name);
  }
  const subjects = new Map(unassigned.map(n => [n, subjectWords(n)]));
  const freq = new Map();
  for (const ws of subjects.values()) for (const w of new Set(ws)) freq.set(w, (freq.get(w) || 0) + 1);
  for (const name of unassigned) {
    let best, bestCount = 0;
    for (const w of subjects.get(name) || []) {
      const c = freq.get(w) || 0;
      if (c > bestCount) { best = w; bestCount = c; }
    }
    family.set(name, best !== undefined && (bestCount >= minSize || unassigned.length < minSize) ? best : 'misc');
  }
  if (unassigned.length >= minSize) {
    const sizes = new Map();
    for (const n of unassigned) sizes.set(family.get(n), (sizes.get(family.get(n)) || 0) + 1);
    for (const n of unassigned) if ((sizes.get(family.get(n)) || 0) < minSize) family.set(n, 'misc');
  }
  return family;
}

function summarizeFamilies(tools, families) {
  const fam = new Map();
  for (const rule of families || []) fam.set(rule.name, { name: rule.name, description: rule.description || '', count: 0, examples: [] });
  for (const t of tools) {
    const f = t.family || 'misc';
    if (!fam.has(f)) fam.set(f, { name: f, description: '', count: 0, examples: [] });
    const g = fam.get(f); g.count++;
    if (g.examples.length < 4) g.examples.push(t.name);
  }
  return [...fam.values()].filter(f => f.count > 0).sort((a, b) => b.count - a.count);
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
  const lines = ['## REA capability catalog', '',
    'REA tools are NOT declared as native tools; their schemas are not in context.',
    'Find one with `capability_search`, read exact parameters with `capability_describe`, then run it with `capability_call`.',
    'When a task matches a family below, search before concluding no tool exists.', ''];
  for (const f of fams) lines.push(`- ${f.name} (${f.count}): ${f.examples.join(', ')}${f.count > f.examples.length ? ', …' : ''}`);
  return lines.join('\n');
}

module.exports = { assignFamilies, summarizeFamilies, search, renderIndex, globToRegExp };
