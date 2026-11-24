'use strict';
/** Register the three lazy catalog meta-tools (plain tool objects for ctx.tools.register). */
function createTools({ source, families, limits = {} }) {
  const { search } = require('./catalog');
  const tools = () => (source.catalog && source.catalog.tools) || [];
  const find = (id) => tools().find(t => t.name === id || `mcp:rea/${t.name}` === id);
  const brief = (t) => `- mcp:rea/${t.name} [${t.family || 'misc'}, params ${(JSON.stringify(t.inputSchema||{}).length)} B] ${String(t.description || '').slice(0, 110)}`;
  const textRender = (_a, v) => ({ text: v.text });
  const OUT = { schema: { type:'object', properties:{ text:{type:'string'} }, required:['text'], additionalProperties:false }, render: textRender };

  const searchTool = {
    name: 'capability_search',
    description: 'Search the REA capability catalog by keywords or family. Returns ids with one-line summaries; read exact parameters with capability_describe before calling.',
    parameters: { type:'object', properties:{
      query:{type:'string',description:'Keywords or a short description of the task'},
      family:{type:'string',description:'Restrict to one family'},
      limit:{type:'integer',minimum:1,maximum:limits.maxSearch||60,description:'Maximum results'},
    }, required:['query'], additionalProperties:false },
    output: OUT,
    execute: async ({ query, family, limit }) => {
      let list = tools();
      if (family) list = list.filter(t => (t.family||'misc') === family);
      const hits = search(list, query, Math.min(limit||8, limits.maxSearch||60));
      return { text: hits.length ? hits.map(brief).join('\n') : 'No capability matched.' };
    },
  };
  const describeTool = {
    name: 'capability_describe',
    description: 'Read the exact JSON Schema of one REA capability (loaded into context only on demand).',
    parameters: { type:'object', properties:{ id:{type:'string',description:'Capability id, e.g. mcp:rea/list_procedures'} }, required:['id'], additionalProperties:false },
    output: OUT,
    execute: async ({ id }) => {
      const t = find(id);
      if (!t) return { text:`Unknown capability: ${id}` };
      return { text:`mcp:rea/${t.name}\n${t.description||''}\n\nParameters (exact JSON Schema):\n${JSON.stringify(t.inputSchema||{},null,2)}` };
    },
  };
  const callTool = {
    name: 'capability_call',
    description: 'Call one REA capability. The REA process starts on demand and disconnects when idle.',
    parameters: { type:'object', properties:{
      id:{type:'string',description:'Capability id'},
      arguments:{type:'object',additionalProperties:true,description:'Tool arguments (read them with capability_describe first)'},
    }, required:['id'], additionalProperties:false },
    output: OUT,
    execute: async ({ id, arguments: args }) => {
      const t = find(id);
      if (!t) return { text:`Unknown capability: ${id}` };
      const r = await source.call(t.name, args||{});
      const out = r.content.map(c => c.text || (c.structuredContent ? JSON.stringify(c.structuredContent) : '')).join('\n');
      return { text: out.slice(0, limits.callMaxChars||120000) || '(no output)' };
    },
  };
  return [searchTool, describeTool, callTool];
}
module.exports = { createTools };
