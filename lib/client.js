window.__ModuleLoader__.load({id:"dsh-deepseek-gateway",factory:(require)=>{var module={exports:{}};var exports=module.exports;
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
var import_react2 = __toESM(require("react"), 1);

// src/shared.ts
var NS = "llm-deepseek-gateway";
var EFFORTS = ["off", "low", "high", "max"];
var ROUTE_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
var SENJIX_PRESET = {
  route: "senjix",
  displayName: "\u6DF1\u6781\u4E91\u7B97",
  baseURL: "https://senjix.cloud/v1",
  apiKeyEnv: "SENJIX_API_KEY",
  models: [{ id: "deepseek-v4.1-flash", name: "DeepSeek V4.1 Flash", inputModalities: ["text"] }]
};
function keyRefFor(route) {
  return `${route.toUpperCase().replace(/-/g, "_")}_API_KEY`;
}

// src/client/Editor.tsx
var import_react = require("react");

// src/client/controller.ts
var SaveTransaction = class {
  committed = false;
  revision;
  constructor(revision) {
    this.revision = revision;
  }
  async save(route, profile, key, operations, creating) {
    if (!this.committed) {
      const fields = ["displayName", "baseURL", "apiKeyEnv", "models", "reasoningEffort"];
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
  }
}

// src/client/Editor.tsx
var import_jsx_runtime = require("react/jsx-runtime");
function GatewayEditor(props) {
  const creating = !props.route;
  const initial = props.initial ?? (props.preset ? { displayName: SENJIX_PRESET.displayName, baseURL: SENJIX_PRESET.baseURL, apiKeyEnv: SENJIX_PRESET.apiKeyEnv, models: SENJIX_PRESET.models } : { baseURL: "", models: [] });
  const [route, setRoute] = (0, import_react.useState)(props.route ?? (props.preset ? "senjix" : ""));
  const [draft, setDraft] = (0, import_react.useState)({ ...initial, models: initial.models.map((m) => ({ ...m })), reasoningEffort: initial.reasoningEffort ?? "high" });
  const [key, setKey] = (0, import_react.useState)("");
  const [credential, setCredential] = (0, import_react.useState)();
  const [busy, setBusy] = (0, import_react.useState)(false);
  const [committed, setCommitted] = (0, import_react.useState)(false);
  const [failure, setFailure] = (0, import_react.useState)("");
  const [candidates, setCandidates] = (0, import_react.useState)([]);
  const [selected, setSelected] = (0, import_react.useState)(/* @__PURE__ */ new Set());
  const [query, setQuery] = (0, import_react.useState)("");
  const [confirmKeyRemoval, setConfirmKeyRemoval] = (0, import_react.useState)(false);
  const transaction = (0, import_react.useRef)(new SaveTransaction(props.revision));
  const mounted = (0, import_react.useRef)(true);
  (0, import_react.useEffect)(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const keyRef = draft.apiKeyEnv ?? keyRefFor(route || "gateway");
  const profile = { ...draft, apiKeyEnv: keyRef };
  const validation = validateDraft(route, profile, key, props.taken, creating && !committed);
  const locked = busy || committed || !props.writable;
  (0, import_react.useEffect)(() => {
    let current = true;
    setCredential(void 0);
    props.operations.credential(keyRef).then((value) => {
      if (current) setCredential(value);
    }).catch(() => {
    });
    return () => {
      current = false;
    };
  }, [keyRef, props.operations]);
  const modelChange = (index, patch) => setDraft((p) => ({ ...p, models: p.models.map((m, i) => i === index ? { ...m, ...patch } : m) }));
  const run = async (fn) => {
    setBusy(true);
    setFailure("");
    try {
      await fn();
    } catch (error) {
      if (mounted.current) setFailure(error instanceof Error ? error.message : "\u64CD\u4F5C\u5931\u8D25");
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
  const visible = candidates.filter((m) => `${m.id} ${m.name ?? ""}`.toLowerCase().includes(query.toLowerCase()));
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dsg-editor", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("header", { className: "dsg-editor-header", children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", { className: "dsg-editor-title", children: creating ? "\u6DFB\u52A0\u7B2C\u4E09\u65B9 DeepSeek" : "\u7F16\u8F91\u7F51\u5173" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "dsg-editor-route", children: route || "\u65B0\u7F51\u5173" })
    ] }) }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dsg-fields dsg-fields-primary", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { className: "dsg-field", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "\u63D0\u4F9B\u65B9 ID" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { value: route, disabled: locked || !creating, onChange: (e) => setRoute(e.target.value), placeholder: "my-deepseek" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { className: "dsg-field", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "\u663E\u793A\u540D\u79F0" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { value: draft.displayName ?? "", disabled: locked, onChange: (e) => setDraft((p) => ({ ...p, displayName: e.target.value || void 0 })) })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { className: "dsg-field dsg-field-wide", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Base URL" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { value: draft.baseURL, disabled: locked, onChange: (e) => setDraft((p) => ({ ...p, baseURL: e.target.value })), placeholder: "https://gateway.example/v1" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { className: "dsg-field", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "\u51ED\u636E\u5F15\u7528" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { value: keyRef, disabled: locked, onChange: (e) => setDraft((p) => ({ ...p, apiKeyEnv: e.target.value || void 0 })) })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { className: "dsg-field", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "API Key" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { type: "password", autoComplete: "off", value: key, disabled: busy || !props.writable || credential?.writable === false, onChange: (e) => setKey(e.target.value), placeholder: credential?.configured ? "\u5DF2\u914D\u7F6E\uFF1B\u7559\u7A7A\u4FDD\u6301\u5F53\u524D\u5BC6\u94A5" : "\u586B\u5199\u5BC6\u94A5\u6216\u901A\u8FC7\u73AF\u5883\u53D8\u91CF\u914D\u7F6E" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { className: "dsg-field", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "\u9ED8\u8BA4\u63A8\u7406\u5F3A\u5EA6" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", { value: draft.reasoningEffort ?? "high", disabled: locked, onChange: (e) => setDraft((p) => ({ ...p, reasoningEffort: e.target.value })), children: EFFORTS.map((e) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: e }, e)) })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "dsg-hint", children: "\u63A8\u7406\u53C2\u6570\u4F7F\u7528 DeepSeek \u5B98\u65B9\u534F\u8BAE\uFF1B\u56FE\u7247\u8F93\u5165\u987B\u7531\u6A21\u578B\u548C\u7F51\u5173\u5B9E\u9645\u652F\u6301\u3002\u51ED\u636E\u53EA\u5199\u5165 dsh \u51ED\u636E\u5B58\u50A8\u3002" }),
    credential?.configured && credential.writable && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "dsg-inline-warning", children: confirmKeyRemoval ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
        "\u5220\u9664\u51ED\u636E ",
        keyRef,
        "\uFF1F\u5176\u4ED6\u4F7F\u7528\u6B64\u5F15\u7528\u7684\u7F51\u5173\u4E5F\u4F1A\u53D7\u5230\u5F71\u54CD\u3002"
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { className: "dsg-button dsg-button-danger", type: "button", disabled: busy || committed || !props.writable, onClick: () => run(async () => {
        await props.operations.removeKey(keyRef);
        if (mounted.current) {
          setCredential(await props.operations.credential(keyRef));
          setKey("");
          setConfirmKeyRemoval(false);
        }
      }), children: "\u786E\u8BA4\u5220\u9664\u5BC6\u94A5" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { className: "dsg-button dsg-button-quiet", type: "button", onClick: () => setConfirmKeyRemoval(false), children: "\u53D6\u6D88" })
    ] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { className: "dsg-button dsg-button-danger", type: "button", disabled: locked, onClick: () => setConfirmKeyRemoval(true), children: "\u5220\u9664\u5DF2\u5B58\u5BC6\u94A5" }) }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dsg-section-heading", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h4", { children: "\u6A21\u578B\u80FD\u529B" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "\u663E\u5F0F\u58F0\u660E\u6A21\u578B\u652F\u6301\u7684\u8F93\u5165\u7C7B\u578B\u548C\u5BB9\u91CF\u3002" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dsg-actions dsg-actions-compact", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { className: "dsg-button dsg-button-secondary", type: "button", disabled: locked, onClick: () => setDraft((p) => ({ ...p, models: [...p.models, { id: "", inputModalities: ["text"] }] })), children: "\u624B\u5DE5\u6DFB\u52A0\u6A21\u578B" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { className: "dsg-button dsg-button-secondary", type: "button", disabled: locked || !draft.baseURL.trim(), onClick: discover, children: "\u83B7\u53D6\u53EF\u7528\u6A21\u578B" })
      ] })
    ] }),
    candidates.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("fieldset", { disabled: locked, className: "dsg-discovery", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("legend", { children: "\u9009\u62E9\u6A21\u578B" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dsg-discovery-toolbar", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { className: "dsg-field", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "\u641C\u7D22\u6A21\u578B" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { value: query, onChange: (e) => setQuery(e.target.value) })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dsg-actions dsg-actions-compact", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { className: "dsg-button dsg-button-quiet", type: "button", onClick: () => setSelected((p) => /* @__PURE__ */ new Set([...p, ...visible.map((m) => m.id)])), children: "\u5168\u9009\u53EF\u89C1" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { className: "dsg-button dsg-button-quiet", type: "button", onClick: () => setSelected(/* @__PURE__ */ new Set()), children: "\u53D6\u6D88\u5168\u9009" })
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "dsg-candidates", children: visible.length ? visible.map((m) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { type: "checkbox", checked: selected.has(m.id), onChange: (e) => setSelected((p) => {
          const next = new Set(p);
          e.target.checked ? next.add(m.id) : next.delete(m.id);
          return next;
        }) }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", { children: m.id })
      ] }, m.id)) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "dsg-empty", children: "\u6CA1\u6709\u5339\u914D\u7684\u6A21\u578B" }) }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { className: "dsg-button dsg-button-primary", type: "button", disabled: !selected.size, onClick: () => {
        setDraft((p) => ({ ...p, models: [...p.models, ...candidates.filter((m) => selected.has(m.id) && !p.models.some((old) => old.id === m.id)).map((m) => ({ ...m, inputModalities: ["text"] }))] }));
        setCandidates([]);
        setSelected(/* @__PURE__ */ new Set());
      }, children: "\u6DFB\u52A0\u6240\u9009" })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "dsg-models", children: draft.models.length ? draft.models.map((m, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("fieldset", { disabled: locked, className: "dsg-model-card", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("legend", { children: [
        "\u6A21\u578B ",
        i + 1
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dsg-fields dsg-model-fields", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { className: "dsg-field", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "\u6A21\u578B ID" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { value: m.id, onChange: (e) => modelChange(i, { id: e.target.value }) })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { className: "dsg-field", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "\u6A21\u578B\u663E\u793A\u540D" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { value: m.name ?? "", onChange: (e) => modelChange(i, { name: e.target.value || void 0 }) })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { className: "dsg-field", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "\u4E0A\u4E0B\u6587\u5BB9\u91CF" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { type: "number", min: "1", step: "1", value: m.contextWindow ?? "", placeholder: "262144\uFF08\u56DE\u9000\u503C\uFF09", onChange: (e) => modelChange(i, { contextWindow: e.target.value ? Number(e.target.value) : void 0 }) })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { className: "dsg-field", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "\u8F93\u51FA\u4E0A\u9650" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { type: "number", min: "1", step: "1", value: m.maxTokens ?? "", placeholder: "32768\uFF08\u56DE\u9000\u503C\uFF09", onChange: (e) => modelChange(i, { maxTokens: e.target.value ? Number(e.target.value) : void 0 }) })
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { className: "dsg-checkbox", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { type: "checkbox", checked: m.inputModalities?.includes("image") ?? false, onChange: (e) => modelChange(i, { inputModalities: e.target.checked ? ["text", "image"] : ["text"] }) }),
        "\u652F\u6301\u56FE\u7247\u8F93\u5165"
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { className: "dsg-button dsg-button-danger dsg-button-small", type: "button", onClick: () => setDraft((p) => ({ ...p, models: p.models.filter((_, index) => index !== i) })), children: "\u79FB\u9664\u6A21\u578B" })
    ] }, i)) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "dsg-empty dsg-empty-models", children: "\u8FD8\u6CA1\u6709\u6A21\u578B\uFF0C\u8BF7\u624B\u5DE5\u6DFB\u52A0\u6216\u83B7\u53D6\u7F51\u5173\u6A21\u578B\u5217\u8868\u3002" }) }),
    committed && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "dsg-success", role: "status", children: "\u7F51\u5173\u914D\u7F6E\u5DF2\u4FDD\u5B58\uFF0C\u8BF7\u91CD\u8BD5\u5BC6\u94A5\u4FDD\u5B58\uFF1B\u914D\u7F6E\u5B57\u6BB5\u5DF2\u9501\u5B9A\u3002" }),
    (failure || validation) && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "dsg-error", role: "alert", children: failure || validation }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dsg-actions dsg-editor-actions", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { className: "dsg-button dsg-button-primary", type: "button", disabled: busy || !props.writable || !!validation, onClick: save, children: busy ? "\u5904\u7406\u4E2D\u2026" : committed ? "\u91CD\u8BD5\u5BC6\u94A5\u4FDD\u5B58" : "\u4FDD\u5B58" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { className: "dsg-button dsg-button-secondary", type: "button", disabled: busy, onClick: props.onClose, children: "\u5173\u95ED" })
    ] })
  ] });
}

// src/client/index.tsx
var import_jsx_runtime2 = require("react/jsx-runtime");
function useSnapshot(scope) {
  return (0, import_react2.useSyncExternalStore)(scope.subscribe.bind(scope), scope.getSnapshot.bind(scope), scope.getSnapshot.bind(scope));
}
function GatewayFooter({ scope, operations, taken }) {
  const state = useSnapshot(scope);
  const [open, setOpen] = (0, import_react2.useState)();
  if (state.status !== "ready") return null;
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("section", { className: "dsg-section", "aria-label": "\u7B2C\u4E09\u65B9 DeepSeek \u7F51\u5173", children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "dsg-section-heading", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("h3", { children: "\u7B2C\u4E09\u65B9 DeepSeek" }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { children: "\u8FDE\u63A5\u517C\u5BB9 DeepSeek Chat Completions \u7684\u7B2C\u4E09\u65B9\u7F51\u5173\u3002" })
    ] }) }),
    open ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(GatewayEditor, { revision: state.revision, taken: taken(), writable: state.writable, preset: open === "senjix", operations, onClose: () => setOpen(void 0) }) : /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dsg-add-actions", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { className: "dsg-button dsg-button-add", type: "button", disabled: !state.writable, onClick: () => setOpen("custom"), children: "\u6DFB\u52A0\u7B2C\u4E09\u65B9 DeepSeek" }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { className: "dsg-button dsg-button-link", type: "button", disabled: !state.writable, onClick: () => setOpen("senjix"), children: "\u4F7F\u7528\u6DF1\u6781\u4E91\u7B97\u9884\u586B" })
    ] })
  ] });
}
function GatewayCard({ provider, scope, operations, taken }) {
  const state = useSnapshot(scope);
  const [open, setOpen] = (0, import_react2.useState)(false);
  const [confirmDelete, setConfirmDelete] = (0, import_react2.useState)(false);
  const [busy, setBusy] = (0, import_react2.useState)(false);
  const [failure, setFailure] = (0, import_react2.useState)("");
  const [credential, setCredential] = (0, import_react2.useState)();
  const route = provider.provider;
  const profile = state.value?.providers?.[route];
  import_react2.default.useEffect(() => {
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
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dsg-card", children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dsg-card-header", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dsg-card-identity", children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: `dsg-status-dot ${credential?.configured ? "dsg-status-dot-ok" : "dsg-status-dot-missing"}`, "aria-label": credential?.configured ? "API \u5BC6\u94A5\u5DF2\u914D\u7F6E" : "API \u5BC6\u94A5\u7F3A\u5931" }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("strong", { children: profile.displayName ?? route }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "dsg-route-tag", children: route })
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { className: "dsg-card-meta", children: [
        profile.models.length,
        " \u4E2A\u6A21\u578B"
      ] })
    ] }),
    open ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(GatewayEditor, { route, initial: profile, revision: state.revision, taken: taken(), writable: state.writable, operations, onClose: () => setOpen(false) }, route) : /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dsg-actions dsg-card-actions", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { className: "dsg-button dsg-button-secondary", type: "button", onClick: () => setOpen(true), children: "\u7F16\u8F91\u7F51\u5173\u4E0E\u6A21\u578B\u80FD\u529B" }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { className: "dsg-button dsg-button-danger", type: "button", disabled: !state.writable || busy || fromBase, onClick: () => setConfirmDelete(true), children: "\u5220\u9664\u672C\u7F51\u5173" })
    ] }),
    confirmDelete && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dsg-confirm", role: "alertdialog", "aria-label": `\u5220\u9664 ${route}`, children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("p", { children: [
        "\u786E\u8BA4\u5220\u9664\u7F51\u5173 ",
        route,
        "\uFF1F\u51ED\u636E\u4FDD\u7559\u5728 dsh \u4E2D\uFF1B\u5982\u9700\u5220\u9664\u5BC6\u94A5\uFF0C\u8BF7\u5148\u5728\u7F51\u5173\u7F16\u8F91\u5668\u4E2D\u64CD\u4F5C\u3002"
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dsg-actions", children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { className: "dsg-button dsg-button-danger", type: "button", disabled: busy, onClick: remove, children: "\u786E\u8BA4\u5220\u9664" }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { className: "dsg-button dsg-button-quiet", type: "button", disabled: busy, onClick: () => setConfirmDelete(false), children: "\u53D6\u6D88" })
      ] })
    ] }),
    fromBase && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "dsg-hint dsg-card-hint", children: "\u8BE5\u7F51\u5173\u6765\u81EA\u7EC4\u5408\u914D\u7F6E\uFF1B\u8BF7\u5728\u5BF9\u5E94 patch \u4E2D\u79FB\u9664\u3002" }),
    failure && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { role: "alert", className: "dsg-error", children: failure })
  ] });
}
var inject = ["slots", "configForms", "remote", "remote.settings", "remote.credentials", "remote.llm"];
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
  const injected = () => ({ scope, operations, taken: () => [.../* @__PURE__ */ new Set([...routes, ...Object.keys(scope.getSnapshot().value?.providers ?? {})])] });
  ctx.slots.inject("settings.models.footer", () => ctx.slots.register({ name: "settings.models.footer", id: NS, order: 20, inject: injected }, GatewayFooter));
  ctx.slots.inject("settings.models.provider-card", () => ctx.slots.register({ name: "settings.models.provider-card", key: NS, inject: injected }, GatewayCard));
  ctx.effect(() => {
    const style = document.createElement("style");
    style.dataset.plugin = "dsh-deepseek-gateway";
    style.textContent = `
      .dsg-section{max-width:720px;color:var(--dsw-alias-label-primary);display:flex;flex-direction:column;gap:12px}
      .dsg-section h3,.dsg-editor h3{margin:0;font-size:16px;font-weight:500;line-height:24px}
      .dsg-section-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
      .dsg-section-heading p,.dsg-section-heading h4{margin:2px 0 0;color:var(--dsw-alias-label-tertiary);font-size:12px;font-weight:400;line-height:18px}
      .dsg-section-heading h4{color:var(--dsw-alias-label-secondary);font-weight:500}
      .dsg-add-actions{display:flex;flex-direction:column;align-items:stretch;gap:8px}
      .dsg-card,.dsg-editor{border:.5px solid var(--dsw-alias-settings-card-stroke);border-radius:var(--dsw-radius-lg);background:var(--dsw-alias-settings-card-fill);padding:14px 16px;display:flex;flex-direction:column;gap:12px}
      .dsg-editor{background:var(--dsw-alias-bg-module-platform);border:0;padding:14px 16px;gap:14px}
      .dsg-card-header{display:flex;align-items:center;justify-content:space-between;gap:12px;min-width:0}
      .dsg-card-identity{display:flex;align-items:center;gap:8px;min-width:0}.dsg-card-identity>div{display:flex;align-items:center;gap:7px;min-width:0}
      .dsg-card-identity strong{font-size:14px;font-weight:500;line-height:22px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.dsg-card-meta,.dsg-editor-route{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px;white-space:nowrap}
      .dsg-route-tag{border:.5px solid var(--dsw-alias-border-l3);border-radius:var(--dsw-radius-xs);color:var(--dsw-alias-label-secondary);padding:1px 6px;font-size:11px;line-height:16px;white-space:nowrap}.dsg-status-dot{width:8px;height:8px;border-radius:50%;flex:none}.dsg-status-dot-ok{background:var(--dsw-alias-state-success-primary)}.dsg-status-dot-missing{background:var(--dsw-alias-state-error-primary)}
      .dsg-editor-header{display:flex;align-items:baseline;gap:8px}.dsg-editor-title{color:var(--dsw-alias-label-primary)}
      .dsg-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.dsg-field{display:flex;flex-direction:column;gap:6px;min-width:0}.dsg-field>span{color:var(--dsw-alias-label-secondary);font-size:12px;font-weight:500;line-height:18px}.dsg-field-wide{grid-column:1/-1}
      .dsg-editor input:not([type=checkbox]),.dsg-editor select{box-sizing:border-box;border:.5px solid var(--dsw-alias-border-l4);border-radius:var(--dsw-radius-md);width:100%;height:32px;font:inherit;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);padding:0 10px;font-size:14px;line-height:22px}.dsg-editor select{cursor:pointer}.dsg-editor input:focus,.dsg-editor select:focus{border-color:var(--dsw-alias-state-business-primary);outline:none}.dsg-editor input:focus-visible,.dsg-editor select:focus-visible,.dsg-button:focus-visible{box-shadow:0 0 0 2px var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline:none}.dsg-editor input::placeholder{color:var(--dsw-alias-label-dimmed)}.dsg-editor input:disabled,.dsg-editor select:disabled{opacity:.6;cursor:default}
      .dsg-button{box-sizing:border-box;border-radius:var(--dsw-radius-md);height:36px;font:inherit;font-size:14px;line-height:22px;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:5px;padding:0 14px}.dsg-button:disabled{opacity:.4;cursor:default}.dsg-button-primary{border:0;background:var(--dsw-alias-button-primary-fill);color:var(--dsw-alias-label-primary-foreground)}.dsg-button-primary:hover:not(:disabled){background:var(--dsw-alias-button-primary-hover)}.dsg-button-secondary,.dsg-button-add{border:.5px solid var(--dsw-alias-border-l3);color:var(--dsw-alias-label-primary);background:transparent}.dsg-button-secondary:hover:not(:disabled),.dsg-button-add:hover:not(:disabled),.dsg-button-quiet:hover:not(:disabled),.dsg-button-link:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}.dsg-button-danger{border:0;color:var(--dsw-alias-state-error-primary);background:transparent}.dsg-button-danger:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover-danger)}.dsg-button-quiet,.dsg-button-link{border:0;color:var(--dsw-alias-label-tertiary);background:transparent}.dsg-button-add{border-style:dashed;border-radius:var(--dsw-radius-lg);height:44px}.dsg-button-small{height:28px;border-radius:var(--dsw-radius-sm);padding:0 10px;font-size:12px;line-height:18px;align-self:flex-start}
      .dsg-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:0}.dsg-actions-compact{gap:4px}.dsg-card-actions{padding-top:2px}.dsg-editor-actions{justify-content:flex-end;padding-top:4px}.dsg-inline-warning,.dsg-confirm{border-top:.5px solid var(--dsw-alias-border-l2);padding-top:10px;color:var(--dsw-alias-label-secondary);display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:12px;line-height:18px}.dsg-confirm{border:0;border-radius:var(--dsw-radius-md);background:var(--dsw-alias-bg-layer-1);padding:10px 12px}.dsg-confirm p{margin:0;flex:1 1 100%}.dsg-hint,.dsg-error,.dsg-success{margin:0;font-size:12px;line-height:18px}.dsg-hint{color:var(--dsw-alias-label-tertiary)}.dsg-card-hint{padding-top:2px}.dsg-error{color:var(--dsw-alias-state-error-primary)}.dsg-success{color:var(--dsw-alias-state-success-primary)}
      .dsg-models{display:flex;flex-direction:column;gap:8px}.dsg-model-card,.dsg-discovery{border:.5px solid var(--dsw-alias-border-l4);border-radius:var(--dsw-radius-lg);margin:0;padding:10px 12px;background:transparent}.dsg-model-card legend,.dsg-discovery legend{color:var(--dsw-alias-label-secondary);padding:0 4px;font-size:12px;font-weight:500;line-height:18px}.dsg-model-fields{gap:8px}.dsg-checkbox{display:flex;align-items:center;gap:8px;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px}.dsg-empty{border:1px dashed var(--dsw-alias-border-l3);border-radius:var(--dsw-radius-lg);color:var(--dsw-alias-label-tertiary);text-align:center;margin:0;padding:12px;font-size:12px;line-height:18px}.dsg-empty-models{margin-top:2px}
      .dsg-discovery{display:flex;flex-direction:column;gap:10px}.dsg-discovery-toolbar{display:flex;align-items:flex-end;gap:8px}.dsg-discovery-toolbar .dsg-field{flex:1}.dsg-candidates{display:flex;flex-direction:column;gap:2px;max-height:240px;overflow-y:auto}.dsg-candidates label{display:flex;align-items:center;gap:8px;border-radius:var(--dsw-radius-sm);padding:6px 8px;cursor:pointer;font-size:13px}.dsg-candidates label:hover{background:var(--dsw-alias-interactive-bg-hover)}.dsg-candidates code{font-family:var(--ds-font-family-code);font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      @media (width<=560px){.dsg-fields{grid-template-columns:1fr}.dsg-field-wide{grid-column:auto}.dsg-card-header,.dsg-section-heading,.dsg-discovery-toolbar{align-items:stretch;flex-direction:column}.dsg-card-meta{white-space:normal}.dsg-editor-actions .dsg-button{flex:1}.dsg-discovery-toolbar .dsg-actions{justify-content:flex-start}}
      @media (prefers-reduced-motion:reduce){.dsg-button{transition:none}}
    `;
    document.head.append(style);
    return () => style.remove();
  });
}

return module.exports;}});
