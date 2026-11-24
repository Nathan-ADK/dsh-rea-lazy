'use strict';
// Curated REA capability families (from upstream MIT families.yml, via dsh-rea).
module.exports = [
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
    "description": "functions, pseudocode, assembly, call graph and references in native binaries",
    "match": [
      "procedure_*",
      "list_procedures",
      "search_procedures",
      "analyze_function",
      "inspect_native_*",
      "get_call_graph",
      "trace_native_values",
      "compare_functions"
    ]
  },
  {
    "name": "native-navigation",
    "description": "addresses, bytes, strings, names, segments, comments and bookmarks",
    "match": [
      "*address*",
      "read_bytes",
      "search_bytes",
      "list_strings",
      "list_names",
      "list_segments",
      "*comment*",
      "*bookmark*"
    ]
  },
  {
    "name": "native-formats",
    "description": "Mach-O, PE, ELF, signatures, Go/Rust/Swift/ObjC metadata",
    "match": [
      "inspect_macho",
      "inspect_pe_resources",
      "inspect_binary_layout",
      "inspect_signature",
      "inspect_go_binary",
      "inspect_rust_binary",
      "*swift*",
      "get_objc_*"
    ]
  },
  {
    "name": "javascript-electron",
    "description": "JS/Electron apps, bundles, source maps, IPC and runtime tracing",
    "match": [
      "*javascript*",
      "analyze_web_bundle",
      "recover_javascript_sources",
      "*electron*",
      "trace_feature"
    ]
  },
  {
    "name": "web-browser",
    "description": "live pages, network captures, screenshots and WebMCP",
    "match": [
      "*web*",
      "capture_browser_scenario",
      "list_browser_targets"
    ]
  },
  {
    "name": "android",
    "description": "APKs, classes, methods, resources and app graphs",
    "match": [
      "*android*",
      "inspect_apktool_client",
      "*jeb*"
    ]
  },
  {
    "name": "adb-device",
    "description": "attached Android devices over adb",
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
    "description": "plists, keyed archives, asset catalogs, Interface Builder",
    "match": [
      "inspect_plist",
      "inspect_keyed_archive",
      "inspect_asset_catalog",
      "decode_interface_builder"
    ]
  },
  {
    "name": "artifacts",
    "description": "archives, packages, firmware, SQLite and file-level comparisons",
    "match": [
      "inspect_artifact",
      "extract_artifact",
      "compare_artifacts",
      "inspect_firmware_regions"
    ]
  },
  {
    "name": "runtime-debug",
    "description": "Frida, GDB and rizin debugging, process and native UI capture",
    "match": [
      "*frida*",
      "*gdb*",
      "*rizin_debug*",
      "capture_process_scenario",
      "observe_native_*"
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
