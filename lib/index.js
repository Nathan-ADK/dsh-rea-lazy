'use strict';
/**
 * dsh-rea-lazy bootstrap (zero dependency).
 * Detects a usable REA command at activation time and registers it with the
 * capability catalog. No local paths are hardcoded: resolution order is
 *   REA_COMMAND env  >  "rea" on PATH  >  bundled rea-agents via process.execPath
 * The server is configured with a 10-year catalog TTL and idle disconnect, so
 * once the tool catalog is cached, rea mcp never starts in the background.
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const FAMILIES = [
  {
    "name": "session",
    "description": "open/close a target, provider binding, readiness and navigation context",
    "match": [
      "open_binary",
      "close_binary",
      "binary_session",
      "binary_overview",
      "get_navigation_context",
      "list_documents",
      "current_document",
      "list_architectures"
    ]
  },
  {
    "name": "native-code",
    "description": "functions, pseudocode, assembly, call graph and references in native binaries (Hopper/Ghidra/IDA)",
    "match": [
      "procedure_*",
      "list_procedures",
      "search_procedures",
      "current_procedure",
      "resolve_containing_procedure",
      "analyze_function",
      "batch_decompile",
      "read_function_instructions",
      "get_call_graph",
      "build_call_path",
      "trace_call_path",
      "xrefs",
      "find_xrefs_to_name",
      "resolve_native_call_targets",
      "trace_native_values",
      "compare_functions",
      "inspect_native_*",
      "inspect_address_context"
    ]
  },
  {
    "name": "native-navigation",
    "description": "addresses, bytes, strings, names, segments, comments and bookmarks",
    "match": [
      "*address*",
      "goto_address",
      "next_address",
      "prev_address",
      "read_bytes",
      "search_bytes",
      "list_strings",
      "search_strings",
      "list_names",
      "list_segments",
      "*comment*",
      "*bookmark*",
      "annotate_native_function"
    ]
  },
  {
    "name": "native-formats",
    "description": "Mach-O, PE, ELF layout, signatures, Go/Rust/Swift/ObjC metadata, objdump and rizin",
    "match": [
      "inspect_macho",
      "inspect_pe_resources",
      "inspect_binary_layout",
      "inspect_signature",
      "inspect_go_binary",
      "inspect_rust_binary",
      "*swift*",
      "get_objc_*",
      "inspect_native_dispatch_metadata",
      "inspect_with_objdump",
      "execute_rizin_command",
      "cutter_command",
      "list_cutter_sessions",
      "trace_dylib_resolution",
      "inspect_dart_aot",
      "identify_flutter_build",
      "inspect_wasm_artifact",
      "compare_wasm_interfaces",
      "inspect_evm_interface"
    ]
  },
  {
    "name": "javascript-electron",
    "description": "JavaScript/Electron apps, bundles, source maps, IPC and runtime tracing",
    "match": [
      "*javascript*",
      "analyze_web_bundle",
      "recover_javascript_sources",
      "compare_source_to_bundle",
      "compare_bundles",
      "*electron*",
      "trace_application_feature",
      "trace_feature",
      "compare_application_versions"
    ]
  },
  {
    "name": "web-browser",
    "description": "live pages through a Chrome-family browser, network captures, screenshots and WebMCP",
    "match": [
      "*web*",
      "capture_browser_scenario",
      "list_browser_targets"
    ]
  },
  {
    "name": "android",
    "description": "APKs, classes, methods, resources (JADX, Apktool, JEB) and app graphs",
    "match": [
      "*android*",
      "inspect_apktool_client",
      "*jeb*"
    ]
  },
  {
    "name": "adb-device",
    "description": "attached Android devices over adb: packages, files, logs, screens and app control",
    "match": [
      "*adb*"
    ]
  },
  {
    "name": "managed-dotnet",
    "description": ".NET assemblies, members, native boundaries and reconstruction",
    "match": [
      "*managed*"
    ]
  },
  {
    "name": "apple-bundles",
    "description": "plists, keyed archives, asset catalogs, Interface Builder and Apple/Harmony app graphs",
    "match": [
      "inspect_plist",
      "inspect_keyed_archive",
      "inspect_asset_catalog",
      "decode_interface_builder",
      "project_apple_application_graph",
      "project_harmony_application_graph"
    ]
  },
  {
    "name": "artifacts",
    "description": "archives, packages, firmware, SQLite and file-level comparisons",
    "match": [
      "inspect_artifact",
      "extract_artifact",
      "compare_artifacts",
      "inspect_firmware_regions",
      "extract_firmware",
      "inspect_sqlite_database",
      "inspect_analysis_view"
    ]
  },
  {
    "name": "runtime-debug",
    "description": "Frida, GDB and rizin debugging, process and native UI capture, recorded crashes",
    "match": [
      "*frida*",
      "*gdb*",
      "*rizin_debug*",
      "capture_process_scenario",
      "compare_process_captures",
      "observe_native_*",
      "capture_native_ui_scenario",
      "trace_native_ui_action",
      "inspect_recorded_crash",
      "correlate_static_and_runtime",
      "find_changed_behavior"
    ]
  },
  {
    "name": "captures-signals",
    "description": "pcap/pcapng packets and recorded logic signals",
    "match": [
      "*pcap*",
      "*packet*",
      "*signal*"
    ]
  },
  {
    "name": "evidence",
    "description": "evidence bundles, residual unknowns and reconstruction verification",
    "match": [
      "*evidence*",
      "*unknown*",
      "*reconstruction*"
    ]
  }
];

function which(name) {
  try {
    const cmd = process.platform === 'win32' ? 'where' : 'which';
    const r = spawnSync(cmd, [name], { encoding: 'utf8', timeout: 3000 });
    if (r.status === 0 && r.stdout) {
      const line = String(r.stdout).split(/\r?\n/).find(Boolean);
      if (line) return line.trim();
    }
  } catch (_) {}
  return null;
}

function readEnvFile() {
  // DSH injects $DSH_HOME/.env into the process at launch; read it here too so
  // detection also works in plain Node / tests. No hardcoded paths.
  try {
    const home = process.env.DSH_HOME || require('path').join(require('os').homedir(), '.dsh');
    const f = require('path').join(home, '.env');
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
  // 1) explicit override (process env first, then DSH .env)
  const envCmd = process.env.REA_COMMAND || readEnvFile().REA_COMMAND;
  if (envCmd && envCmd.trim()) {
    const parts = envCmd.trim().split(/\s+/);
    return { command: parts[0], args: parts.slice(1) };
  }
  // 2) on PATH
  const onPath = which('rea');
  if (onPath) return { command: onPath, args: ['mcp'] };
  // 3) rea-agents installed near this package / in the DSH profile
  const roots = [
    path.join(__dirname, '..', 'node_modules', 'rea-agents'),
    path.join(process.cwd(), 'node_modules', 'rea-agents'),
  ];
  for (const root of roots) {
    const entry = path.join(root, 'scripts', 'rea.mjs');
    if (fs.existsSync(entry)) {
      return { command: process.execPath, args: [entry, 'mcp'] };
    }
  }
  return null;
}

async function apply(ctx, config = {}) {
  const found = findRea();
  if (!found) {
    ctx.logger?.warn('[dsh-rea-lazy] no REA executable found; set REA_COMMAND to enable');
    return;
  }
  const server = {
    name: 'rea',
    title: 'REA reverse engineering (on-demand)',
    description: '263 REA tools via the lazy capability catalog; the rea process starts only on an actual tool call.',
    enabled: true,
    transport: 'stdio',
    command: found.command,
    args: found.args,
    // McpServerSchema defaults: cacheKey() calls Object.entries(config.env)
    // and Object.keys(config.headers) directly, so these must never be undefined.
    env: {},
    headers: {},
    catalogTtlMs: 315360000000,
    idleDisconnectMs: 300000,
    callTimeoutMs: 600000,
    discoveryTimeoutMs: 60000,
    families: FAMILIES,
    ...config,
  };
  const remove = await ctx.capabilityCatalogServers.addMcpServer(server);
  ctx.effect(() => () => { try { remove && remove(); } catch (_) {} }, 'dsh-rea-lazy.server');
}

module.exports = { name: 'dsh-rea-lazy', inject: ['capabilityCatalogServers'], apply, findRea };
