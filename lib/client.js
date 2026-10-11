window.__ModuleLoader__.load({id:"dsh-model-gateway",factory:(require)=>{var module={exports:{}};var exports=module.exports;
"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client/index.tsx
var index_exports = {};
__export(index_exports, {
  GatewayCard: () => GatewayCard,
  GatewayFooter: () => GatewayFooter,
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(index_exports);
var import_dsh_client_ui_primitives3 = require("@deepseek-ai/dsh-client-ui-primitives");
var import_react3 = __toESM(require("react"), 1);

// src/shared.ts
var NS = "llm-deepseek-gateway";
var EFFORTS = ["off", "low", "medium", "high", "xhigh", "max"];
var PROTOCOLS = ["chat-completions", "responses", "anthropic-messages"];
var NATIVE_SEARCH_MODES = ["none", "openai-chat", "openai-responses", "anthropic-messages"];
var ROUTE_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
var SENJIX_PRESET = {
  route: "senjix",
  displayName: "\u6DF1\u6781\u4E91\u7B97",
  baseURL: "https://senjix.cloud/v1",
  apiKeyEnv: "SENJIX_API_KEY",
  // The documented Flash model accepts text and image input. Keep the preset
  // free of a capability override so the catalog remains the source of truth.
  models: [{ id: "deepseek-flash", name: "DeepSeek V4.1 Flash" }]
};
function keyRefFor(route) {
  return `${route.toUpperCase().replace(/-/g, "_")}_API_KEY`;
}

// src/client/Editor.tsx
var import_react2 = __toESM(require("react"), 1);
var import_dsh_client_ui_primitives2 = require("@deepseek-ai/dsh-client-ui-primitives");

// src/catalog.ts
var deepseekSources = ["https://api-docs.deepseek.com/quick_start/pricing/", "https://api-docs.deepseek.com/guides/vision/", "https://api-docs.deepseek.com/guides/thinking_mode/", "https://api-docs.deepseek.com/guides/responses_api/"];
var entries = [];
function add(defaults, sources, style, aliases = []) {
  entries.push({ defaults, documentation: { sources, checkedAt: "2026-10-11", image: defaults.inputModalities.includes("image") ? "supported" : "unsupported", tools: defaults.supportsTools ? "supported" : "unsupported", reasoning: defaults.reasoningEfforts.some((e) => e !== "off") ? "supported" : "unsupported", nativeSearch: defaults.nativeSearch && defaults.nativeSearch !== "none" ? "supported" : "unsupported", reasoningStyle: style, temperature: defaults.defaultTemperature !== void 0 || style === "deepseek" || style === "anthropic-budget", aliases } });
  const protocols = defaults.providerFamily === "deepseek" ? ["chat-completions", "responses", "anthropic-messages"] : defaults.providerFamily === "anthropic" ? ["anthropic-messages"] : ["chat-completions", "responses"];
  Object.assign(entries.at(-1).documentation, { toolsProtocols: protocols, reasoningProtocols: protocols, imageProtocols: protocols, stop: style === "none" || style.startsWith("anthropic") || style === "deepseek" });
}
add({ id: "deepseek-flash", name: "DeepSeek V4.1 Flash", providerFamily: "deepseek", contextWindow: 1e6, maxTokens: 384e3, inputModalities: ["text", "image"], reasoningEfforts: ["off", "low", "high", "max"], defaultReasoningEffort: "high", supportsTools: true, nativeSearch: "none" }, deepseekSources, "deepseek", ["deepseek-v4-flash", "deepseek-v4-flash-vision-exp"]);
add({ id: "deepseek-v4-pro", name: "DeepSeek V4 Pro 0813", providerFamily: "deepseek", contextWindow: 1e6, maxTokens: 384e3, inputModalities: ["text"], reasoningEfforts: ["off", "low", "high", "max"], defaultReasoningEffort: "high", supportsTools: true, nativeSearch: "none" }, deepseekSources, "deepseek");
var openaiSearch = "https://developers.openai.com/api/docs/guides/tools-web-search";
add({ id: "gpt-4.1", name: "GPT-4.1", providerFamily: "openai", contextWindow: 1047576, maxTokens: 32768, inputModalities: ["text", "image"], reasoningEfforts: ["off"], defaultReasoningEffort: "off", supportsTools: true, defaultTemperature: 1, nativeSearch: "openai-responses" }, ["https://developers.openai.com/api/docs/models/gpt-4.1", openaiSearch], "none", ["gpt-4.1-2025-04-14"]);
for (const id of ["o3", "o4-mini"]) add({ id, name: id, providerFamily: "openai", contextWindow: 2e5, maxTokens: 1e5, inputModalities: ["text", "image"], reasoningEfforts: ["low", "medium", "high"], defaultReasoningEffort: "medium", supportsTools: true, nativeSearch: "openai-responses" }, ["https://developers.openai.com/api/docs/models/" + id, "https://developers.openai.com/api/docs/guides/reasoning", openaiSearch], "openai", [id + "-2025-04-16"]);
add({ id: "gpt-6.1-sol", name: "GPT-6.1 Sol", providerFamily: "openai", contextWindow: 105e4, maxTokens: 128e3, inputModalities: ["text", "image"], reasoningEfforts: ["low", "medium", "high", "xhigh", "max"], defaultReasoningEffort: "medium", supportsTools: true, nativeSearch: "openai-responses" }, ["https://developers.openai.com/api/docs/models/gpt-6.1-sol", "https://developers.openai.com/api/docs/guides/reasoning"], "openai");
entries.at(-1).documentation.toolsProtocols = ["responses"];
for (const [id, name, efforts, defaultEffort] of [
  ["gpt-6-sol", "GPT-6 Sol", ["off", "low", "medium", "high", "xhigh", "max"], "medium"],
  ["gpt-6-astra", "GPT-6 Astra", ["low", "medium", "high", "xhigh", "max"], "medium"],
  ["gpt-6-luna", "GPT-6 Luna", ["off", "low", "medium", "high", "xhigh", "max"], "medium"]
]) {
  add({ id, name, providerFamily: "openai", contextWindow: 105e4, maxTokens: 128e3, inputModalities: ["text", "image"], reasoningEfforts: [...efforts], defaultReasoningEffort: defaultEffort, supportsTools: true, nativeSearch: "openai-responses" }, ["https://developers.openai.com/api/docs/models/" + id, "https://developers.openai.com/api/docs/guides/latest-model", openaiSearch], "openai");
  entries.at(-1).documentation.toolsProtocols = ["responses"];
}
for (const [id, name, efforts, aliases] of [
  ["gpt-5.6-sol", "GPT-5.6 Sol", ["off", "low", "medium", "high", "xhigh", "max"], ["gpt-5.6"]],
  ["gpt-5.6-terra", "GPT-5.6 Terra", ["off", "low", "medium", "high", "xhigh", "max"], []],
  ["gpt-5.5", "GPT-5.5", ["off", "low", "medium", "high", "xhigh"], ["gpt-5.5-2026-04-23"]]
]) {
  add({ id, name, providerFamily: "openai", contextWindow: 105e4, maxTokens: 128e3, inputModalities: ["text", "image"], reasoningEfforts: [...efforts], defaultReasoningEffort: "medium", supportsTools: true, nativeSearch: "openai-responses" }, ["https://developers.openai.com/api/docs/models/" + id, "https://developers.openai.com/api/docs/guides/reasoning", openaiSearch], "openai", [...aliases]);
  entries.at(-1).documentation.toolsProtocols = ["responses"];
}
add({ id: "gpt-4o", name: "GPT-4o", providerFamily: "openai", contextWindow: 128e3, maxTokens: 16384, inputModalities: ["text", "image"], reasoningEfforts: ["off"], defaultReasoningEffort: "off", supportsTools: true, defaultTemperature: 1, nativeSearch: "none" }, ["https://developers.openai.com/api/docs/models/gpt-4o", openaiSearch], "none", ["gpt-4o-2024-05-13", "gpt-4o-2024-08-06", "gpt-4o-2024-11-20"]);
entries.at(-1).documentation.nativeSearch = "unverified";
add({ id: "claude-opus-5-5", name: "Claude Opus 5.5", providerFamily: "anthropic", contextWindow: 1e6, maxTokens: 128e3, inputModalities: ["text", "image"], reasoningEfforts: ["low", "medium", "high", "xhigh", "max"], defaultReasoningEffort: "medium", supportsTools: true, nativeSearch: "anthropic-messages" }, ["https://platform.claude.com/docs/en/models/overview", "https://platform.claude.com/docs/en/build-with-claude/thinking", "https://platform.claude.com/docs/en/build-with-claude/effort", "https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-search-tool"], "anthropic-adaptive");
add({ id: "grok-4.7", name: "Grok 4.7", providerFamily: "xai", contextWindow: 5e5, inputModalities: ["text", "image"], reasoningEfforts: ["low", "medium", "high", "xhigh"], defaultReasoningEffort: "high", supportsTools: true, nativeSearch: "openai-responses" }, ["https://docs.x.ai/developers/models/grok-4.7", "https://docs.x.ai/developers/tools/web-search", "https://docs.x.ai/developers/model-capabilities/text/reasoning"], "xai");
for (const [id, name, providerFamily, source] of [
  ["deepseek-chat", "DeepSeek Chat", "deepseek", deepseekSources[0]],
  ["deepseek-reasoner", "DeepSeek Reasoner", "deepseek", deepseekSources[0]],
  ["deepseek-v4.1-flash", "DeepSeek V4.1 Flash (\u7F51\u5173\u578B\u53F7)", "deepseek", deepseekSources[0]],
  ["claude-3-7-sonnet-20250219", "Claude 3.7 Sonnet", "anthropic", "https://platform.claude.com/docs/en/models/overview"],
  ["claude-sonnet-4-20250514", "Claude Sonnet 4", "anthropic", "https://platform.claude.com/docs/en/models/overview"],
  ["claude-opus-4-1-20250805", "Claude Opus 4.1", "anthropic", "https://platform.claude.com/docs/en/models/overview"],
  ["grok-3", "Grok 3", "xai", "https://docs.x.ai/developers/models"],
  ["grok-3-mini", "Grok 3 Mini", "xai", "https://docs.x.ai/developers/models"],
  ["grok-4", "Grok 4", "xai", "https://docs.x.ai/developers/models"]
]) {
  entries.push({ defaults: { id, name, providerFamily, inputModalities: ["text"], reasoningEfforts: ["off"], defaultReasoningEffort: "off", supportsTools: false, nativeSearch: "none" }, documentation: { sources: [source], checkedAt: "2026-10-11", image: "unverified", tools: "unverified", reasoning: "unverified", nativeSearch: "unverified", reasoningStyle: "none", temperature: false } });
}
var OFFICIAL_MODEL_CATALOG = entries.flatMap(({ defaults, documentation }) => [defaults, ...(documentation.aliases ?? []).map((id) => ({ ...defaults, id }))]);
var byId = new Map(entries.flatMap((entry) => [entry.defaults.id, ...entry.documentation.aliases ?? []].map((id) => [id, entry])));
function officialModelDefaults(id, protocol) {
  const entry = byId.get(id.trim());
  if (!entry) return void 0;
  const d = { ...entry.defaults, id: id.trim() };
  if (protocol) {
    const doc = entry.documentation;
    d.nativeSearch = nativeModeForProtocol(d.nativeSearch, protocol);
    if (doc.toolsProtocols && !doc.toolsProtocols.includes(protocol)) d.supportsTools = false;
    if (doc.reasoningProtocols && !doc.reasoningProtocols.includes(protocol)) {
      d.reasoningEfforts = ["off"];
      d.defaultReasoningEffort = "off";
    }
    if (doc.imageProtocols && !doc.imageProtocols.includes(protocol)) d.inputModalities = ["text"];
  }
  return d;
}
function modelDocumentation(id) {
  return byId.get(id.trim())?.documentation;
}
function nativeModeForProtocol(mode, protocol) {
  const expected = protocol === "responses" ? "openai-responses" : protocol === "anthropic-messages" ? "anthropic-messages" : "openai-chat";
  return mode === expected ? mode : "none";
}
function enrichModel(model, protocol) {
  const defaults = officialModelDefaults(model.id, protocol);
  const nativeSearch = model.nativeSearch ?? (protocol ? nativeModeForProtocol(defaults?.nativeSearch, protocol) : defaults?.nativeSearch) ?? "none";
  const efforts = model.reasoningEfforts?.length ? [...model.reasoningEfforts] : [...defaults?.reasoningEfforts ?? ["off"]];
  return {
    ...defaults,
    ...model,
    id: model.id,
    name: model.name ?? defaults?.name,
    contextWindow: model.contextWindow ?? defaults?.contextWindow,
    maxTokens: model.maxTokens ?? defaults?.maxTokens,
    inputModalities: model.inputModalities?.length ? [...model.inputModalities] : [...defaults?.inputModalities ?? ["text"]],
    reasoningEfforts: efforts,
    defaultReasoningEffort: model.defaultReasoningEffort ?? (efforts.includes(defaults?.defaultReasoningEffort ?? "off") ? defaults?.defaultReasoningEffort ?? "off" : efforts[0]),
    supportsTools: model.supportsTools ?? defaults?.supportsTools ?? false,
    defaultTemperature: model.defaultTemperature ?? defaults?.defaultTemperature,
    nativeSearch,
    supportsWebSearch: model.supportsWebSearch ?? ((model.supportsTools ?? defaults?.supportsTools ?? false) || nativeSearch !== "none")
  };
}
var CAPABILITY_FIELDS = ["inputModalities", "providerFamily", "reasoningEfforts", "defaultReasoningEffort", "supportsTools", "defaultTemperature", "nativeSearch", "nativeSearchConfig", "nativeSearchMaxUses", "supportsWebSearch", "contextWindow", "maxTokens", "imagePixelBudget", "imageMaxBytes"];
function restoreOfficialDefaults(model, protocol) {
  const identity = { ...model };
  for (const field of CAPABILITY_FIELDS) delete identity[field];
  if (!officialModelDefaults(model.id)) {
    identity.contextWindow = model.contextWindow;
    identity.maxTokens = model.maxTokens;
  }
  return enrichModel(identity, protocol);
}

// src/client/controller.ts
var SaveTransaction = class {
  committed = false;
  revision;
  constructor(revision) {
    this.revision = revision;
  }
  async save(route, profile, key, operations, creating) {
    if (!this.committed) {
      const fields = ["displayName", "baseURL", "protocol", "apiKeyEnv", "models", "reasoningEffort", "webSearch"];
      const ops = creating ? [{ op: "set", path: ["providers", route], value: JSON.parse(JSON.stringify(profile)) }] : fields.map((field) => profile[field] === void 0 ? { op: "unset", path: ["providers", route, field] } : { op: "set", path: ["providers", route, field], value: JSON.parse(JSON.stringify(profile[field])) });
      const view = await operations.write(ops, this.revision);
      this.revision = view.revision;
      this.committed = true;
    }
    if (key.trim()) await operations.storeKey(profile.apiKeyEnv ?? keyRefFor(route), key.trim());
  }
};
function validateDraft(route, p, key, taken, creating) {
  if (!ROUTE_PATTERN.test(route) || route === "deepseek-official") return "\u63D0\u4F9B\u65B9 ID \u987B\u4EE5\u5C0F\u5199\u5B57\u6BCD\u5F00\u5934\uFF0C\u4EC5\u4F7F\u7528\u5C0F\u5199\u5B57\u6BCD\u3001\u6570\u5B57\u548C\u8FDE\u5B57\u7B26";
  if (creating && taken.includes(route)) return "\u63D0\u4F9B\u65B9 ID \u5DF2\u5B58\u5728";
  try {
    const url = new URL(p.baseURL);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error();
  } catch {
    return "\u8BF7\u586B\u5199\u6709\u6548\u7684 HTTP(S) API \u6839\u5730\u5740";
  }
  if (!p.apiKeyEnv || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(p.apiKeyEnv)) return "\u51ED\u636E\u5F15\u7528\u987B\u662F\u6709\u6548\u7684\u73AF\u5883\u53D8\u91CF\u540D";
  if (key.trim() && (!/^[\x21-\x7e]+$/.test(key.trim()) || /^[A-Z][A-Z0-9_]*=[^=]/.test(key.trim()) || /^(["'`]).*\1$/.test(key.trim()))) return "API Key \u683C\u5F0F\u65E0\u6548\uFF0C\u8BF7\u53EA\u7C98\u8D34\u5BC6\u94A5";
  if (key.length && !key.trim()) return "API Key \u4E0D\u80FD\u53EA\u6709\u7A7A\u767D";
  if (!p.models.length) return "\u81F3\u5C11\u6DFB\u52A0\u4E00\u4E2A\u6A21\u578B";
  const ids = /* @__PURE__ */ new Set();
  for (const m of p.models) {
    if (!m.id.trim() || m.id !== m.id.trim() || ids.has(m.id)) return "\u6A21\u578B ID \u4E0D\u80FD\u4E3A\u7A7A\u3001\u5305\u542B\u9996\u5C3E\u7A7A\u683C\u6216\u91CD\u590D";
    ids.add(m.id);
    if (m.name !== void 0 && !m.name.trim()) return "\u6A21\u578B\u663E\u793A\u540D\u4E0D\u80FD\u4E3A\u7A7A";
    for (const value of [m.contextWindow, m.maxTokens]) if (value !== void 0 && (!Number.isSafeInteger(value) || value <= 0)) return "\u4E0A\u4E0B\u6587\u548C\u8F93\u51FA\u4E0A\u9650\u987B\u662F\u6B63\u6574\u6570";
    if (m.nativeSearchMaxUses !== void 0 && (!Number.isSafeInteger(m.nativeSearchMaxUses) || m.nativeSearchMaxUses <= 0)) return "\u539F\u751F\u641C\u7D22\u6B21\u6570\u987B\u662F\u6B63\u6574\u6570";
    if (m.defaultTemperature !== void 0 && (!Number.isFinite(m.defaultTemperature) || m.defaultTemperature < 0 || m.defaultTemperature > 2)) return "temperature \u5FC5\u987B\u5728 0 \u5230 2 \u4E4B\u95F4";
    if (m.reasoningEfforts !== void 0 && (!m.reasoningEfforts.length || m.reasoningEfforts.some((effort) => !EFFORTS.includes(effort)))) return "\u63A8\u7406\u6863\u4F4D\u914D\u7F6E\u65E0\u6548";
    if (m.defaultReasoningEffort !== void 0 && m.reasoningEfforts !== void 0 && !m.reasoningEfforts.includes(m.defaultReasoningEffort)) return "\u9ED8\u8BA4\u63A8\u7406\u6863\u4F4D\u5FC5\u987B\u5305\u542B\u5728\u652F\u6301\u5217\u8868\u4E2D";
  }
}

// src/client/controls.tsx
var import_react = require("react");
var import_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
var import_jsx_runtime = require("react/jsx-runtime");
function Selection({ label, value, options, disabled, onChange }) {
  const [open, setOpen] = (0, import_react.useState)(false);
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dsg-field", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: label }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      import_dsh_client_ui_primitives.Menu,
      {
        open: open && !disabled,
        portal: true,
        autoFocus: true,
        anchor: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.Button, { variant: "outline", "aria-label": label, "aria-haspopup": "menu", "aria-expanded": open && !disabled, disabled, onClick: () => setOpen((p) => !p), icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.IconChevronDownOutlineRegular, {}), children: options.find((o) => o.value === value)?.label ?? value }),
        items: options.map((o) => ({ id: o.value, label: o.label, disabled: o.disabled })),
        selectedId: value,
        onSelect: (id) => {
          onChange(id);
          setOpen(false);
        },
        onClose: () => setOpen(false)
      }
    )
  ] });
}

// src/client/Editor.tsx
var import_jsx_runtime2 = require("react/jsx-runtime");
var effortName = { off: "\u5173\u95ED", low: "\u4F4E", medium: "\u4E2D", high: "\u9AD8", xhigh: "\u66F4\u9AD8", max: "\u6700\u9AD8" };
var nativeName = { none: "\u5173\u95ED\u539F\u751F\u641C\u7D22", "openai-chat": "Chat Completions \u539F\u751F\u641C\u7D22", "openai-responses": "Responses \u539F\u751F\u641C\u7D22", "anthropic-messages": "Anthropic \u539F\u751F\u641C\u7D22" };
function GatewayEditor(props) {
  const creating = !props.route;
  const initial = props.initial ?? (props.preset ? { displayName: SENJIX_PRESET.displayName, baseURL: SENJIX_PRESET.baseURL, apiKeyEnv: SENJIX_PRESET.apiKeyEnv, models: SENJIX_PRESET.models } : { baseURL: "", models: [] });
  const [route, setRoute] = (0, import_react2.useState)(props.route ?? (props.preset ? "senjix" : ""));
  const [draft, setDraft] = (0, import_react2.useState)(() => ({ ...initial, protocol: initial.protocol ?? "chat-completions", models: initial.models.map((m) => enrichModel(m, initial.protocol ?? "chat-completions")) }));
  const [key, setKey] = (0, import_react2.useState)("");
  const [credential, setCredential] = (0, import_react2.useState)();
  const [busy, setBusy] = (0, import_react2.useState)(false);
  const [committed, setCommitted] = (0, import_react2.useState)(false);
  const [failure, setFailure] = (0, import_react2.useState)("");
  const [candidates, setCandidates] = (0, import_react2.useState)([]);
  const [selected, setSelected] = (0, import_react2.useState)(/* @__PURE__ */ new Set());
  const [query, setQuery] = (0, import_react2.useState)("");
  const [expanded, setExpanded] = (0, import_react2.useState)(/* @__PURE__ */ new Set());
  const [confirmKeyRemoval, setConfirmKeyRemoval] = (0, import_react2.useState)(false);
  const transaction = (0, import_react2.useRef)(new SaveTransaction(props.revision));
  const mounted = (0, import_react2.useRef)(true);
  const editedIds = (0, import_react2.useRef)(/* @__PURE__ */ new Set());
  (0, import_react2.useEffect)(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const keyRef = draft.apiKeyEnv ?? keyRefFor(route || "gateway");
  const profile = { ...draft, apiKeyEnv: keyRef };
  const protocol = draft.protocol ?? "chat-completions";
  const validation = validateDraft(route, profile, key, props.taken, creating && !committed);
  const locked = busy || committed || !props.writable;
  (0, import_react2.useEffect)(() => {
    let current = true;
    setCredential(void 0);
    props.operations.credential(keyRef).then((v) => {
      if (current) setCredential(v);
    }).catch(() => {
    });
    return () => {
      current = false;
    };
  }, [keyRef, props.operations]);
  const modelChange = (index, patch) => setDraft((p) => ({ ...p, models: p.models.map((m, i) => i === index ? { ...m, ...patch } : m) }));
  const modelReplace = (index, model) => setDraft((p) => ({ ...p, models: p.models.map((m, i) => i === index ? model : m) }));
  const run = async (fn) => {
    setBusy(true);
    setFailure("");
    try {
      await fn();
    } catch (e) {
      if (mounted.current) setFailure(e instanceof Error ? e.message : "\u64CD\u4F5C\u5931\u8D25");
    } finally {
      if (mounted.current) setBusy(false);
    }
  };
  const save = () => run(async () => {
    try {
      await transaction.current.save(route, profile, key, props.operations, creating);
      if (mounted.current) {
        setKey("");
        props.onClose();
      }
    } finally {
      if (mounted.current) setCommitted(transaction.current.committed);
    }
  });
  const discover = () => run(async () => {
    const result = await props.operations.discover({ provider: props.route, baseURL: draft.baseURL, ...key.trim() ? { apiKey: key.trim() } : {} });
    if (mounted.current) {
      setCandidates(result);
      setSelected(/* @__PURE__ */ new Set());
      if (!result.length) setFailure("\u7F51\u5173\u672A\u516C\u5E03\u6A21\u578B\uFF0C\u8BF7\u624B\u5DE5\u6DFB\u52A0");
    }
  });
  const visible = candidates.filter((m) => (m.id + " " + (m.name ?? "")).toLowerCase().includes(query.toLowerCase()));
  const toggleEffort = (index, effort, checked) => {
    const m = draft.models[index];
    const values = new Set(m.reasoningEfforts ?? ["off"]);
    checked ? values.add(effort) : values.delete(effort);
    const next = EFFORTS.filter((e) => values.has(e));
    modelChange(index, { reasoningEfforts: next.length ? next : ["off"], defaultReasoningEffort: next.includes(m.defaultReasoningEffort ?? "off") ? m.defaultReasoningEffort : next[0] ?? "off" });
  };
  const field = (label, value, onChange, type = "text", hint) => /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("label", { className: "dsg-field", children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: label }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_dsh_client_ui_primitives2.Input, { type, value: value ?? "", disabled: locked, onChange: (e) => onChange(e.target.value), placeholder: hint, autoComplete: type === "password" ? "off" : void 0 })
  ] });
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dsg-editor", children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("header", { className: "dsg-section-heading", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("h3", { children: creating ? "\u6DFB\u52A0\u6A21\u578B\u7F51\u5173" : "\u7F16\u8F91\u7F51\u5173" }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_dsh_client_ui_primitives2.Tag, { children: route || "\u65B0\u7F51\u5173" })
    ] }),
    !props.writable && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { role: "status", className: "dsg-hint", children: "\u5F53\u524D\u914D\u7F6E\u53EA\u8BFB\uFF1B\u5C1A\u672A\u5B8C\u6210\u7684\u80FD\u529B\u9ED8\u8BA4\u8FC1\u79FB\u9700\u7B49\u5F85\u914D\u7F6E\u53EF\u5199\uFF0C\u624B\u52A8\u4FEE\u6539\u4E5F\u9700\u5728\u53EF\u5199\u914D\u7F6E\u4E2D\u4FDD\u5B58\u3002" }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("section", { "aria-label": "\u8FDE\u63A5\u4E0E\u51ED\u636E", className: "dsg-group", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("h4", { children: "\u8FDE\u63A5\u4E0E\u51ED\u636E" }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dsg-fields", children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("label", { className: "dsg-field", children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: "\u63D0\u4F9B\u65B9 ID" }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_dsh_client_ui_primitives2.Input, { value: route, disabled: locked || !creating, onChange: (e) => setRoute(e.target.value), placeholder: "my-gateway" })
        ] }),
        field("\u663E\u793A\u540D\u79F0", draft.displayName, (s) => setDraft((p) => ({ ...p, displayName: s || void 0 }))),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Selection, { label: "API \u534F\u8BAE", value: protocol, disabled: locked, options: PROTOCOLS.map((value) => ({ value, label: value === "responses" ? "OpenAI Responses" : value === "anthropic-messages" ? "Anthropic Messages" : "OpenAI Chat Completions" })), onChange: (s) => setDraft((p) => ({ ...p, protocol: s })) }),
        field("Base URL", draft.baseURL, (s) => setDraft((p) => ({ ...p, baseURL: s })), "url", "https://gateway.example/v1"),
        field("\u51ED\u636E\u5F15\u7528", keyRef, (s) => setDraft((p) => ({ ...p, apiKeyEnv: s || void 0 }))),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("label", { className: "dsg-field", children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: "API Key" }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_dsh_client_ui_primitives2.Input, { type: "password", autoComplete: "off", value: key, disabled: busy || !props.writable || credential?.writable === false, onChange: (e) => setKey(e.target.value), placeholder: credential?.configured ? "\u5DF2\u914D\u7F6E\uFF1B\u7559\u7A7A\u4FDD\u7559\u5BC6\u94A5" : "\u586B\u5199 API Key" })
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "dsg-hint", children: "\u80FD\u529B\u4EE5\u5382\u5546 API \u6587\u6863\u4E3A\u51C6\uFF0C\u7F51\u5173\u5B9E\u9645\u652F\u6301\u53EF\u80FD\u4E0D\u540C\u3002\u51ED\u636E\u4FDD\u5B58\u5728 DSH \u51ED\u636E\u5B58\u50A8\u4E2D\u3002" }),
      credential?.configured && credential.writable && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_dsh_client_ui_primitives2.Button, { variant: "ghost", size: "sm", disabled: locked, icon: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_dsh_client_ui_primitives2.IconTrashOutlineRegular, {}), onClick: () => setConfirmKeyRemoval(true), children: "\u5220\u9664\u5DF2\u5B58\u5BC6\u94A5" })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("section", { "aria-label": "\u6A21\u578B", className: "dsg-group", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dsg-section-heading", children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("h4", { children: "\u6A21\u578B" }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "dsg-hint", children: "\u5B98\u65B9\u652F\u6301\u9ED8\u8BA4\u5F00\u542F\uFF0C\u4E0D\u652F\u6301\u6216\u672A\u6838\u5B9E\u9ED8\u8BA4\u5173\u95ED\u3002\u624B\u52A8\u8BBE\u7F6E\u53EF\u4EE5\u8986\u76D6\u9ED8\u8BA4\u503C\u3002" })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_dsh_client_ui_primitives2.Tag, { children: String(draft.models.length) + " \u4E2A\u6A21\u578B" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dsg-actions", children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_dsh_client_ui_primitives2.Button, { variant: "outline", disabled: locked, icon: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_dsh_client_ui_primitives2.IconPlusOutlineRegular, {}), onClick: () => setDraft((p) => ({ ...p, models: [...p.models, enrichModel({ id: "" }, protocol)] })), children: "\u624B\u5DE5\u6DFB\u52A0\u6A21\u578B" }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_dsh_client_ui_primitives2.Button, { variant: "outline", disabled: locked, onClick: () => {
          setCandidates(OFFICIAL_MODEL_CATALOG.filter((m) => !draft.models.some((old) => old.id === m.id)).map((m) => restoreOfficialDefaults(m, protocol)));
          setSelected(/* @__PURE__ */ new Set());
          setQuery("");
        }, children: "\u6DFB\u52A0\u5B98\u65B9\u9884\u8BBE" }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_dsh_client_ui_primitives2.Button, { variant: "outline", disabled: locked || !draft.baseURL.trim(), onClick: discover, children: "\u83B7\u53D6\u7F51\u5173\u6A21\u578B" }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_dsh_client_ui_primitives2.Button, { variant: "ghost", size: "sm", disabled: locked, onClick: () => setDraft((p) => ({ ...p, models: p.models.map((m) => restoreOfficialDefaults(m, protocol)) })), children: "\u5168\u90E8\u6062\u590D\u5B98\u65B9\u9ED8\u8BA4" })
      ] }),
      candidates.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dsg-discovery", children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dsg-actions", children: [
          field("\u641C\u7D22\u6A21\u578B", query, setQuery),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_dsh_client_ui_primitives2.Button, { size: "sm", disabled: locked, onClick: () => setSelected((p) => /* @__PURE__ */ new Set([...p, ...visible.map((m) => m.id)])), children: "\u5168\u9009\u53EF\u89C1" }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_dsh_client_ui_primitives2.Button, { size: "sm", disabled: locked, onClick: () => setSelected(/* @__PURE__ */ new Set()), children: "\u53D6\u6D88\u5168\u9009" })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "dsg-candidates", children: visible.map((m) => /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dsg-candidate", children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_dsh_client_ui_primitives2.Checkbox, { label: m.id, checked: selected.has(m.id), disabled: locked, onChange: (checked) => setSelected((p) => {
            const next = new Set(p);
            checked ? next.add(m.id) : next.delete(m.id);
            return next;
          }) }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "dsg-hint", children: m.name ?? "\u672A\u6838\u5B9E\u6A21\u578B" })
        ] }, m.id)) }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_dsh_client_ui_primitives2.Button, { variant: "primary", disabled: locked || !selected.size, onClick: () => {
          setDraft((p) => ({ ...p, models: [...p.models, ...candidates.filter((m) => selected.has(m.id) && !p.models.some((old) => old.id === m.id)).map((m) => restoreOfficialDefaults(m, protocol))] }));
          setCandidates([]);
          setSelected(/* @__PURE__ */ new Set());
        }, children: "\u6DFB\u52A0\u6240\u9009" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "dsg-models", children: draft.models.map((m, i) => {
        const doc = modelDocumentation(m.id);
        const official = officialModelDefaults(m.id, protocol);
        const status = (key2) => !doc || doc[key2] === "unverified" ? "\u672A\u6838\u5B9E" : doc[key2] === "unsupported" ? "\u4E0D\u652F\u6301" : key2 === "tools" && official?.supportsTools === false || key2 === "nativeSearch" && official?.nativeSearch === "none" ? "\u5F53\u524D\u534F\u8BAE\u4E0D\u652F\u6301" : "\u5B98\u65B9\u652F\u6301";
        return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dsg-model-card", children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dsg-section-heading", children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { children: [
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("strong", { children: m.name || m.id || "\u65B0\u6A21\u578B" }),
              /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dsg-actions", children: [
                /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_dsh_client_ui_primitives2.Tag, { children: m.inputModalities?.includes("image") ? "\u56FE\u7247" : "\u6587\u672C" }),
                /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_dsh_client_ui_primitives2.Tag, { children: m.supportsTools ? "\u5DE5\u5177\u8C03\u7528" : "\u5DE5\u5177\u5173\u95ED" }),
                /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_dsh_client_ui_primitives2.Tag, { children: m.nativeSearch && m.nativeSearch !== "none" ? "\u539F\u751F\u641C\u7D22" : "\u539F\u751F\u641C\u7D22\u5173\u95ED" })
              ] })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_dsh_client_ui_primitives2.Button, { size: "sm", icon: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_dsh_client_ui_primitives2.IconChevronDownOutlineRegular, {}), "aria-expanded": expanded.has(i), "aria-controls": "dsg-model-" + i, onClick: () => setExpanded((p) => {
              const next = new Set(p);
              next.has(i) ? next.delete(i) : next.add(i);
              return next;
            }), children: expanded.has(i) ? "\u6536\u8D77\u80FD\u529B\u8BBE\u7F6E" : "\u5C55\u5F00\u80FD\u529B\u8BBE\u7F6E" })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dsg-fields", children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("label", { className: "dsg-field", children: [
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: "\u6A21\u578B ID" }),
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_dsh_client_ui_primitives2.Input, { value: m.id, disabled: locked, onChange: (e) => {
                editedIds.current.add(i);
                modelChange(i, { id: e.target.value });
              }, onBlur: () => {
                if (editedIds.current.delete(i)) modelReplace(i, restoreOfficialDefaults(m, protocol));
              } })
            ] }),
            field("\u6A21\u578B\u663E\u793A\u540D", m.name, (s) => modelChange(i, { name: s || void 0 }))
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { id: "dsg-model-" + i, hidden: !expanded.has(i), className: "dsg-model-detail", children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dsg-fields", children: [
              field("\u4E0A\u4E0B\u6587\u5BB9\u91CF", m.contextWindow, (s) => modelChange(i, { contextWindow: s ? Number(s) : void 0 }), "number", "\u672A\u6838\u5B9E\uFF0C\u4F7F\u7528\u7F51\u5173\u56DE\u9000\u5BB9\u91CF"),
              field("\u8F93\u51FA\u4E0A\u9650", m.maxTokens, (s) => modelChange(i, { maxTokens: s ? Number(s) : void 0 }), "number", "\u672A\u6838\u5B9E\uFF0C\u4F7F\u7528\u7F51\u5173\u56DE\u9000\u5BB9\u91CF")
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dsg-capability", children: [
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_dsh_client_ui_primitives2.Checkbox, { label: "\u652F\u6301\u56FE\u7247\u8F93\u5165", checked: m.inputModalities?.includes("image") ?? false, disabled: locked, onChange: (checked) => modelChange(i, { inputModalities: checked ? ["text", "image"] : ["text"] }) }),
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_dsh_client_ui_primitives2.Tag, { children: status("image") })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dsg-capability", children: [
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_dsh_client_ui_primitives2.Checkbox, { label: "\u652F\u6301\u5DE5\u5177\u8C03\u7528", checked: m.supportsTools === true, disabled: locked, onChange: (checked) => modelChange(i, { supportsTools: checked }) }),
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_dsh_client_ui_primitives2.Tag, { children: status("tools") })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_dsh_client_ui_primitives2.Checkbox, { label: "\u5141\u8BB8\u7F51\u9875\u641C\u7D22\u5DE5\u5177", checked: m.supportsWebSearch === true, disabled: locked, onChange: (checked) => modelChange(i, { supportsWebSearch: checked }) }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dsg-fields", children: [
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Selection, { label: "\u6A21\u578B\u539F\u751F\u641C\u7D22", value: m.nativeSearch ?? "none", disabled: locked, options: NATIVE_SEARCH_MODES.map((value) => ({ value, label: nativeName[value], disabled: value !== "none" && nativeModeForProtocol(value, protocol) === "none" })), onChange: (s) => modelChange(i, { nativeSearch: s }) }),
              field("\u539F\u751F\u641C\u7D22\u6700\u5927\u6B21\u6570", m.nativeSearchMaxUses, (s) => modelChange(i, { nativeSearchMaxUses: s ? Number(s) : void 0 }), "number", "5")
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_dsh_client_ui_primitives2.Tag, { children: status("nativeSearch") }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dsg-efforts", children: [
              /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { children: [
                "\u652F\u6301\u7684\u63A8\u7406\u6863\u4F4D \xB7 ",
                status("reasoning")
              ] }),
              EFFORTS.map((e) => /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_dsh_client_ui_primitives2.Checkbox, { label: effortName[e] + " (" + e + ")", checked: (m.reasoningEfforts ?? ["off"]).includes(e), disabled: locked, onChange: (checked) => toggleEffort(i, e, checked) }, e))
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dsg-fields", children: [
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Selection, { label: "\u9ED8\u8BA4\u63A8\u7406\u6863\u4F4D", value: m.defaultReasoningEffort ?? "off", disabled: locked, options: (m.reasoningEfforts ?? ["off"]).map((value) => ({ value, label: effortName[value] })), onChange: (s) => modelChange(i, { defaultReasoningEffort: s }) }),
              field("\u9ED8\u8BA4 temperature", m.defaultTemperature, (s) => modelChange(i, { defaultTemperature: s ? Number(s) : void 0 }), "number", "\u6309\u5B98\u65B9\u53C2\u6570\u9650\u5236\u53D1\u9001")
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("p", { className: "dsg-hint", children: [
              doc ? "\u6838\u5BF9\u65E5\u671F\uFF1A" + doc.checkedAt : "\u8BE5\u578B\u53F7\u5C1A\u672A\u5339\u914D\u5B98\u65B9\u6587\u6863\uFF1B\u53EF\u9009\u80FD\u529B\u9ED8\u8BA4\u5173\u95ED\u3002",
              " ",
              doc?.sources.map((url, n) => /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_react2.default.Fragment, { children: [
                /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("a", { href: url, target: "_blank", rel: "noreferrer", children: "\u5B98\u65B9\u6765\u6E90 " + (n + 1) }),
                " "
              ] }, url))
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_dsh_client_ui_primitives2.Button, { variant: "ghost", size: "sm", disabled: locked, onClick: () => modelReplace(i, restoreOfficialDefaults(m, protocol)), children: "\u6062\u590D\u5B98\u65B9\u9ED8\u8BA4" })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_dsh_client_ui_primitives2.Button, { variant: "ghost", size: "sm", disabled: locked, icon: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_dsh_client_ui_primitives2.IconTrashOutlineRegular, {}), onClick: () => {
            setDraft((p) => ({ ...p, models: p.models.filter((_, index) => index !== i) }));
            setExpanded(/* @__PURE__ */ new Set());
          }, children: "\u79FB\u9664\u6A21\u578B" })
        ] }, i);
      }) }),
      !draft.models.length && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "dsg-hint", children: "\u8FD8\u6CA1\u6709\u6A21\u578B\uFF0C\u8BF7\u624B\u5DE5\u6DFB\u52A0\u6216\u83B7\u53D6\u6A21\u578B\u5217\u8868\u3002" })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("section", { "aria-label": "\u641C\u7D22\u6865\u63A5", className: "dsg-group", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("h4", { children: "DSH \u901A\u7528\u641C\u7D22\u7F51\u5173\u6865\u63A5" }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dsg-capability", children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_dsh_client_ui_primitives2.Switch, { label: "\u542F\u7528\u7F51\u5173\u641C\u7D22\u6865\u63A5", checked: draft.webSearch?.enabled !== false, disabled: locked, onChange: (checked) => setDraft((p) => ({ ...p, webSearch: { ...p.webSearch, enabled: checked } })) }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: "\u4F5C\u4E3A DSH \u901A\u7528\u641C\u7D22\u63D0\u4F9B\u65B9" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "dsg-hint", children: "\u6865\u63A5\u5173\u95ED\u4E0D\u5F71\u54CD\u6A21\u578B\u539F\u751F\u641C\u7D22\u3002\u6865\u63A5\u53EA\u80FD\u4F7F\u7528\u5DF2\u542F\u7528\u539F\u751F\u641C\u7D22\u7684\u6A21\u578B\uFF1BDSH \u5B98\u65B9\u901A\u7528\u641C\u7D22\u914D\u7F6E\u72EC\u7ACB\u4FDD\u7559\u3002" }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dsg-fields", children: [
        field("\u6865\u63A5\u641C\u7D22\u6A21\u578B", draft.webSearch?.model, (s) => setDraft((p) => ({ ...p, webSearch: { ...p.webSearch, model: s || void 0 } })), "text", "\u9996\u4E2A\u542F\u7528\u539F\u751F\u641C\u7D22\u7684\u6A21\u578B"),
        field("\u6865\u63A5\u6700\u5927\u641C\u7D22\u6B21\u6570", draft.webSearch?.maxUses, (s) => setDraft((p) => ({ ...p, webSearch: { ...p.webSearch, maxUses: s ? Number(s) : void 0 } })), "number", "5")
      ] })
    ] }),
    committed && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "dsg-success", role: "status", children: "\u914D\u7F6E\u5DF2\u4FDD\u5B58\uFF0C\u53EA\u91CD\u8BD5\u51ED\u636E\u4FDD\u5B58\u3002" }),
    (failure || validation) && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "dsg-error", role: "alert", children: failure || validation }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dsg-actions dsg-editor-actions", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_dsh_client_ui_primitives2.Button, { variant: "primary", disabled: busy || !props.writable || !!validation, onClick: save, children: busy ? "\u5904\u7406\u4E2D\u2026" : committed ? "\u91CD\u8BD5\u5BC6\u94A5\u4FDD\u5B58" : "\u4FDD\u5B58" }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_dsh_client_ui_primitives2.Button, { variant: "outline", disabled: busy, onClick: props.onClose, children: "\u5173\u95ED" })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_dsh_client_ui_primitives2.Modal, { open: confirmKeyRemoval, title: "\u5220\u9664\u5DF2\u5B58\u5BC6\u94A5", description: "\u5220\u9664\u51ED\u636E " + keyRef + " \u4F1A\u5F71\u54CD\u5176\u4ED6\u4F7F\u7528\u8BE5\u5F15\u7528\u7684\u7F51\u5173\u3002", closeLabel: "\u5173\u95ED\u786E\u8BA4", onClose: () => {
      if (!busy) setConfirmKeyRemoval(false);
    }, footer: /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_jsx_runtime2.Fragment, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_dsh_client_ui_primitives2.Button, { variant: "outline", disabled: busy, onClick: () => setConfirmKeyRemoval(false), children: "\u53D6\u6D88" }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_dsh_client_ui_primitives2.Button, { variant: "primary", disabled: locked, onClick: () => run(async () => {
        await props.operations.removeKey(keyRef);
        if (mounted.current) {
          setCredential(await props.operations.credential(keyRef));
          setKey("");
          setConfirmKeyRemoval(false);
        }
      }), children: "\u786E\u8BA4\u5220\u9664\u5BC6\u94A5" })
    ] }) })
  ] });
}

// src/client/updates.ts
var PLUGIN_VERSION = "0.5.0";
var RELEASES_URL = "https://github.com/Charon0221/dsh-model-gateway/releases";
var LATEST_RELEASE_URL = "https://api.github.com/repos/Charon0221/dsh-model-gateway/releases/latest";
var INSTALL_SPEC_PREFIX = "github:Charon0221/dsh-model-gateway#";
var CACHE_TTL_MS = 6 * 60 * 60 * 1e3;
var cache;
function versionParts(value) {
  const match = /^v?(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/.exec(value.trim());
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : void 0;
}
function isNewerVersion(current, latest) {
  const a = versionParts(current);
  const b = versionParts(latest);
  if (!a || !b) return false;
  for (let i = 0; i < 3; i++) {
    if (b[i] !== a[i]) return b[i] > a[i];
  }
  return false;
}
async function checkForUpdate(fetchImpl = fetch, now = Date.now()) {
  if (cache && now - cache.checkedAt < CACHE_TTL_MS) return cache.result;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5e3);
  try {
    const response = await fetchImpl(LATEST_RELEASE_URL, {
      headers: { Accept: "application/vnd.github+json" },
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`GitHub release request failed: ${response.status}`);
    const release = await response.json();
    const tag = typeof release.tag_name === "string" ? release.tag_name : "";
    const latestVersion = tag.replace(/^v/, "");
    const releaseUrl = typeof release.html_url === "string" ? release.html_url : RELEASES_URL;
    const result = isNewerVersion(PLUGIN_VERSION, latestVersion) && !release.draft && !release.prerelease ? { currentVersion: PLUGIN_VERSION, latestVersion, releaseUrl, installSpec: `${INSTALL_SPEC_PREFIX}${tag}` } : null;
    cache = { checkedAt: now, result };
    return result;
  } catch {
    cache = { checkedAt: now, result: null };
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

// src/client/index.tsx
var import_jsx_runtime3 = require("react/jsx-runtime");
function useSnapshot(scope) {
  return (0, import_react3.useSyncExternalStore)(scope.subscribe.bind(scope), scope.getSnapshot.bind(scope), scope.getSnapshot.bind(scope));
}
function GatewayFooter({ scope, operations, taken, ctx }) {
  const state = useSnapshot(scope);
  const [open, setOpen] = (0, import_react3.useState)();
  const [update, setUpdate] = (0, import_react3.useState)();
  const [copied, setCopied] = (0, import_react3.useState)(false);
  const [updating, setUpdating] = (0, import_react3.useState)(false);
  const [updateMessage, setUpdateMessage] = (0, import_react3.useState)("");
  (0, import_react3.useEffect)(() => {
    let active = true;
    void checkForUpdate().then((value) => {
      if (active) setUpdate(value);
    });
    return () => {
      active = false;
    };
  }, []);
  const copyInstallSpec = async () => {
    if (!update || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(update.installSpec);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
    }
  };
  const installUpdate = async () => {
    if (!update || updating) return;
    const manager = ctx.remote.pluginManager;
    if (!manager?.installBundle) {
      setUpdateMessage("\u5F53\u524D DSH \u672A\u63D0\u4F9B\u81EA\u52A8\u66F4\u65B0\u63A5\u53E3\uFF0C\u8BF7\u590D\u5236\u5B89\u88C5\u5730\u5740\u540E\u5230\u63D2\u4EF6\u8BBE\u7F6E\u4E2D\u66F4\u65B0\u3002");
      return;
    }
    setUpdating(true);
    setUpdateMessage("");
    try {
      const result = await manager.installBundle(update.installSpec, { enabled: true });
      if (!result?.ok) throw new Error(result?.error?.message ?? "\u63D2\u4EF6\u66F4\u65B0\u8BF7\u6C42\u5931\u8D25");
      const value = result.value;
      if (value?.application === "failed" || value?.error) throw new Error(value.error?.diagnostic ?? "\u63D2\u4EF6\u66F4\u65B0\u5931\u8D25");
      setUpdateMessage(value?.application === "restart-required" || value?.application === "applied" ? "\u66F4\u65B0\u5DF2\u5B89\u88C5\uFF0C\u91CD\u542F DSH \u540E\u751F\u6548\u3002" : "\u66F4\u65B0\u8BF7\u6C42\u5DF2\u63D0\u4EA4\uFF0C\u8BF7\u5230\u63D2\u4EF6\u8BBE\u7F6E\u67E5\u770B\u72B6\u6001\u3002");
    } catch (error) {
      setUpdateMessage(error instanceof Error ? error.message : "\u63D2\u4EF6\u66F4\u65B0\u5931\u8D25\uFF0C\u8BF7\u590D\u5236\u5B89\u88C5\u5730\u5740\u624B\u52A8\u66F4\u65B0\u3002");
    } finally {
      setUpdating(false);
    }
  };
  if (state.status !== "ready") return null;
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("section", { className: "dsg-section", "aria-label": "\u7B2C\u4E09\u65B9\u6A21\u578B\u7F51\u5173", children: [
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "dsg-section-heading", children: /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("h3", { children: "\u7B2C\u4E09\u65B9\u6A21\u578B\u7F51\u5173" }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { children: "\u8FDE\u63A5\u6DF1\u6781\u4E91\u7B97\u63D0\u4F9B\u7684\u6A21\u578B\uFF0C\u53EF\u9009\u62E9 OpenAI Chat Completions\u3001OpenAI Responses \u6216 Anthropic Messages \u534F\u8BAE\u3002" })
    ] }) }),
    update && /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "dsg-update", role: "status", children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { children: [
        "\u53D1\u73B0\u65B0\u7248\u672C v",
        update.latestVersion,
        "\uFF08\u5F53\u524D v",
        PLUGIN_VERSION,
        "\uFF09\u3002"
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_dsh_client_ui_primitives3.Button, { variant: "primary", type: "button", disabled: updating, onClick: installUpdate, children: updating ? "\u66F4\u65B0\u4E2D\u2026" : "\u66F4\u65B0\u63D2\u4EF6" }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("a", { href: update.releaseUrl, target: "_blank", rel: "noreferrer", children: "\u67E5\u770B\u53D1\u5E03\u8BF4\u660E" }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_dsh_client_ui_primitives3.Button, { variant: "ghost", type: "button", onClick: copyInstallSpec, children: copied ? "\u5DF2\u590D\u5236\u5B89\u88C5\u5730\u5740" : "\u590D\u5236\u5B89\u88C5\u5730\u5740" }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { children: updateMessage || "\u66F4\u65B0\u540E\u6309\u684C\u9762\u7AEF\u63D0\u793A\u91CD\u542F DSH\uFF1B\u5982\u679C\u5F53\u524D\u7248\u672C\u6CA1\u6709\u81EA\u52A8\u66F4\u65B0\u63A5\u53E3\uFF0C\u53EF\u590D\u5236\u5B89\u88C5\u5730\u5740\u624B\u52A8\u66F4\u65B0\u3002" })
    ] }),
    open ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(GatewayEditor, { revision: state.revision, taken: taken(), writable: state.writable, preset: open === "senjix", operations, onClose: () => setOpen(void 0) }) : /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "dsg-add-actions", children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_dsh_client_ui_primitives3.Button, { variant: "ghost", type: "button", disabled: !state.writable, onClick: () => setOpen("custom"), children: "\u6DFB\u52A0\u6A21\u578B\u7F51\u5173" }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_dsh_client_ui_primitives3.Button, { variant: "ghost", type: "button", disabled: !state.writable, onClick: () => setOpen("senjix"), children: "\u4F7F\u7528\u6DF1\u6781\u4E91\u7B97\u9884\u586B" })
    ] })
  ] });
}
function GatewayCard({ provider, scope, operations, taken }) {
  const state = useSnapshot(scope);
  const [open, setOpen] = (0, import_react3.useState)(false);
  const [confirmDelete, setConfirmDelete] = (0, import_react3.useState)(false);
  const [busy, setBusy] = (0, import_react3.useState)(false);
  const [failure, setFailure] = (0, import_react3.useState)("");
  const [credential, setCredential] = (0, import_react3.useState)();
  const route = provider.provider;
  const profile = state.value?.providers?.[route];
  import_react3.default.useEffect(() => {
    let active = true;
    if (profile) operations.credential(profile.apiKeyEnv ?? "").then((value) => {
      if (active) setCredential(value);
    }).catch(() => {
    });
    return () => {
      active = false;
    };
  }, [operations, profile?.apiKeyEnv]);
  if (!profile) return null;
  const fromBase = !!state.base?.providers?.[route];
  const remove = async () => {
    setBusy(true);
    setFailure("");
    try {
      await operations.write([{ op: "unset", path: ["providers", route] }], state.revision);
    } catch (error) {
      setFailure(error instanceof Error ? error.message : "\u5220\u9664\u5931\u8D25");
    } finally {
      setBusy(false);
      setConfirmDelete(false);
    }
  };
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "dsg-card", children: [
    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "dsg-card-header", children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "dsg-card-identity", children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_dsh_client_ui_primitives3.StateDot, { state: credential?.configured ? "done" : "error" }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("strong", { children: profile.displayName ?? route }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_dsh_client_ui_primitives3.Tag, { children: route })
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { className: "dsg-card-meta", children: [
        profile.models.length,
        " \u4E2A\u6A21\u578B"
      ] })
    ] }),
    open ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(GatewayEditor, { route, initial: profile, revision: state.revision, taken: taken(), writable: state.writable, operations, onClose: () => setOpen(false) }, route) : /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "dsg-actions dsg-card-actions", children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_dsh_client_ui_primitives3.Button, { variant: "outline", type: "button", onClick: () => setOpen(true), children: "\u7F16\u8F91\u7F51\u5173\u4E0E\u6A21\u578B\u80FD\u529B" }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_dsh_client_ui_primitives3.Button, { variant: "ghost", type: "button", disabled: !state.writable || busy || fromBase, onClick: () => setConfirmDelete(true), children: "\u5220\u9664\u672C\u7F51\u5173" })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_dsh_client_ui_primitives3.Modal, { open: confirmDelete, title: `\u5220\u9664 ${route}`, description: "\u786E\u8BA4\u5220\u9664\u672C\u7F51\u5173\uFF1F\u51ED\u636E\u4F1A\u4FDD\u7559\u5728 DSH \u4E2D\u3002", closeLabel: "\u5173\u95ED\u786E\u8BA4", onClose: () => {
      if (!busy) setConfirmDelete(false);
    }, footer: /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(import_jsx_runtime3.Fragment, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_dsh_client_ui_primitives3.Button, { variant: "outline", disabled: busy, onClick: () => setConfirmDelete(false), children: "\u53D6\u6D88" }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_dsh_client_ui_primitives3.Button, { variant: "primary", disabled: busy, onClick: remove, children: "\u786E\u8BA4\u5220\u9664" })
    ] }) }),
    fromBase && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { className: "dsg-hint dsg-card-hint", children: "\u8BE5\u7F51\u5173\u6765\u81EA\u7EC4\u5408\u914D\u7F6E\uFF1B\u8BF7\u5728\u5BF9\u5E94 patch \u4E2D\u79FB\u9664\u3002" }),
    failure && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { role: "alert", className: "dsg-error", children: failure })
  ] });
}
var inject = ["slots", "configForms", "remote", "remote.settings", "remote.credentials", "remote.llm", "remote.pluginManager"];
function apply(ctx) {
  const scope = ctx.configForms.get(NS);
  let routes = [];
  let active = true;
  const refresh = async () => {
    const response = await ctx.remote.llm.listProviders();
    if (active && response.ok) routes = response.value.map((p) => p.id);
  };
  void refresh().catch(() => {
  });
  ctx.effect(() => {
    const dispose = ctx.remote.$on("llm/adapters-updated", () => {
      void refresh().catch(() => {
      });
    });
    const reconnect = ctx.on("connection/reset", () => {
      void refresh().catch(() => {
      });
    });
    return () => {
      active = false;
      dispose();
      reconnect();
    };
  });
  const operations = {
    write: async (ops, revision) => {
      const response = await ctx.remote.settings.mutate(NS, ops, revision);
      if (!response.ok) throw new Error(response.error.code === "settings/conflict" ? "\u914D\u7F6E\u5DF2\u88AB\u5176\u4ED6\u9875\u9762\u4FEE\u6539\uFF0C\u8BF7\u5173\u95ED\u7F16\u8F91\u5668\u5E76\u91CD\u65B0\u6253\u5F00" : response.error.message);
      return response.value;
    },
    credential: async (ref) => {
      const r = await ctx.remote.credentials.describe([ref]);
      return r.ok ? r.value[ref] : void 0;
    },
    storeKey: async (ref, key) => {
      const r = await ctx.remote.credentials.set(ref, key);
      if (!r.ok) throw new Error(r.error.message);
    },
    removeKey: async (ref) => {
      const r = await ctx.remote.credentials.unset(ref);
      if (!r.ok) throw new Error(r.error.message);
    },
    discover: async (request) => {
      const r = await ctx.remote.llm.discoverModels(NS, request);
      if (!r.ok) throw new Error(r.error.message);
      return r.value;
    }
  };
  const injected = () => ({ scope, operations, taken: () => [.../* @__PURE__ */ new Set([...routes, ...Object.keys(scope.getSnapshot().value?.providers ?? {})])], ctx });
  ctx.slots.inject("settings.models.footer", () => ctx.slots.register({ name: "settings.models.footer", id: NS, order: 20, inject: injected }, GatewayFooter));
  ctx.slots.inject("settings.models.provider-card", () => ctx.slots.register({ name: "settings.models.provider-card", key: NS, inject: injected }, GatewayCard));
  ctx.effect(() => {
    const style = document.createElement("style");
    style.dataset.plugin = "dsh-model-gateway";
    style.textContent = `
      .dsg-section,.dsg-editor,.dsg-card,.dsg-group,.dsg-model-detail{display:flex;flex-direction:column;gap:12px;min-width:0;color:var(--dsw-alias-label-primary)}
      .dsg-section{max-width:720px}.dsg-card,.dsg-editor{padding:12px 0}.dsg-group{padding:12px 0;border-top:.5px solid var(--dsw-alias-settings-card-stroke)}
      .dsg-section h3,.dsg-editor h3,.dsg-group h4{margin:0;font-weight:500}.dsg-section h3{font-size:16px}.dsg-group h4{font-size:14px}
      .dsg-section-heading,.dsg-card-header,.dsg-card-identity,.dsg-card-identity>div,.dsg-actions,.dsg-capability{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.dsg-section-heading,.dsg-card-header{justify-content:space-between}
      .dsg-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.dsg-field{display:flex;flex-direction:column;gap:6px;min-width:0}.dsg-field>span,.dsg-card-meta{font-size:12px;color:var(--dsw-alias-label-secondary)}
      .dsg-models{display:flex;flex-direction:column;gap:8px}.dsg-model-card{display:flex;flex-direction:column;gap:10px;border:.5px solid var(--dsw-alias-settings-card-stroke);border-radius:var(--dsw-radius-lg);padding:12px;background:var(--dsw-alias-settings-card-fill)}
      .dsg-model-detail[hidden]{display:none}.dsg-efforts{display:flex;flex-wrap:wrap;gap:12px}.dsg-efforts>span{flex-basis:100%;font-size:12px}
      .dsg-hint,.dsg-error,.dsg-success{margin:0;font-size:12px;line-height:18px}.dsg-hint{color:var(--dsw-alias-label-tertiary)}.dsg-error{color:var(--dsw-alias-state-error-primary)}.dsg-success{color:var(--dsw-alias-state-success-primary)}
      .dsg-editor-actions{justify-content:flex-end}.dsg-add-actions{display:flex;gap:8px;flex-wrap:wrap}.dsg-discovery{display:flex;flex-direction:column;gap:10px}.dsg-candidates{display:flex;flex-direction:column;gap:8px;max-height:280px;overflow:auto}.dsg-candidate{display:flex;gap:8px;flex-wrap:wrap}
      .dsg-update{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.dsg-update p{margin:0;flex-basis:100%}.dsg-editor a{overflow-wrap:anywhere;color:var(--dsw-alias-label-secondary)}
      @media(width<=560px){.dsg-fields{grid-template-columns:1fr}.dsg-section-heading{align-items:flex-start}.dsg-actions{gap:6px}}
    `;
    document.head.append(style);
    return () => style.remove();
  });
}

return module.exports;}});
