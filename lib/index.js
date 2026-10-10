// src/index.ts
import {
  LlmError as LlmError7,
  assertUsableApiKey as assertUsableApiKey2,
  resolveImageAttachmentAccess
} from "@deepseek-ai/dsh-llm";
import { launchEnvironmentOf } from "@deepseek-ai/dsh-launch-environment";

// src/adapter.ts
import {
  LlmAdapter,
  LlmError as LlmError4,
  ReasoningEffortId
} from "@deepseek-ai/dsh-llm";

// src/shared.ts
var NS = "llm-deepseek-gateway";
var EFFORTS = ["off", "low", "high", "max"];
var ROUTE_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
function keyRefFor(route) {
  return `${route.toUpperCase().replace(/-/g, "_")}_API_KEY`;
}

// src/serialize.ts
import {
  LlmError,
  contentHasImage,
  offloadRequestImagesWithPolicy,
  offloadedImageText,
  requestImageHandleText,
  fileHandleText
} from "@deepseek-ai/dsh-llm";
async function serializeRequest(options, profile, services = {}) {
  const model = profile.models.find((m) => m.id === options.model);
  const effort = options.purpose === "session-title" ? "off" : options.reasoningEffort ?? profile.reasoningEffort;
  if (!EFFORTS.includes(effort)) throw new LlmError("\u4E0D\u652F\u6301\u7684 DeepSeek \u63A8\u7406\u5F3A\u5EA6", "UNSUPPORTED_REASONING_EFFORT");
  const imageCapable = model?.inputModalities?.includes("image") === true;
  const hasImages = options.messages.some((m) => contentHasImage(m.content));
  for (const message of options.messages) {
    if (message.role !== "user" && contentHasImage(message.content)) throw new LlmError(`\u65E0\u6CD5\u53D1\u9001 ${message.role} \u6D88\u606F\u4E2D\u7684\u56FE\u7247`, "UNSUPPORTED_CONTENT");
  }
  const versions = /* @__PURE__ */ new Map();
  if (imageCapable && hasImages) {
    if (!services.attachments) throw new LlmError("\u56FE\u7247\u8F93\u5165\u9700\u8981 dsh \u9644\u4EF6\u670D\u52A1", "UNSUPPORTED_CONTENT");
    const refs = [];
    const collect = (blocks) => {
      for (const block of blocks) {
        if (block.type === "image") refs.push(block.attachment);
        if (block.type === "tool-result") collect(block.content);
      }
    };
    options.messages.forEach((m) => collect(m.content));
    const policy = imagePolicy(model);
    for (const ref of refs) {
      options.signal?.throwIfAborted();
      if (!versions.has(ref.attachmentId)) versions.set(ref.attachmentId, await services.attachments.readImageRequest(ref, policy, options.signal));
    }
  }
  const messages = hasImages ? offloadRequestImagesWithPolicy(options.messages, {
    representation: "base64",
    maxBytes: imageCapable ? profile.maxInlineRequestImageBytes : 0,
    maxImages: imageCapable ? profile.maxImagesPerRequest : 0,
    byteQuantum: Math.min(profile.maxInlineRequestImageBytes, 10 * 1024 * 1024),
    countQuantum: 20,
    byteLength: (ref) => versions.get(ref.attachmentId)?.bytes ?? ref.bytes,
    placeholder: (ref) => offloadedImageText(ref, services.resolveImageAccess?.(ref))
  }) : options.messages;
  const partsFor = (blocks) => {
    const parts = [];
    for (const block of blocks) {
      switch (block.type) {
        case "text":
          if (block.text) parts.push({ type: "text", text: block.text });
          break;
        case "image": {
          const version = versions.get(block.attachment.attachmentId);
          if (!version) throw new LlmError("\u672A\u51C6\u5907\u8BF7\u6C42\u56FE\u7247", "INVALID_REQUEST");
          parts.push({ type: "text", text: requestImageHandleText(block.attachment, version, services.resolveImageAccess?.(block.attachment)) });
          parts.push({ type: "image_url", image_url: { url: `data:${version.mediaType};base64,${Buffer.from(version.data).toString("base64")}` } });
          break;
        }
        case "file": {
          const host = services.attachments?.fileHostPath(block.attachment);
          parts.push({ type: "text", text: fileHandleText(block.attachment, host ? services.resolveFilePath?.(host) : void 0) });
          break;
        }
        case "tool-result":
          parts.push(...partsFor(block.content));
          break;
        case "reasoning":
          break;
        case "tool-call":
          throw new LlmError("\u7528\u6237\u6216\u5DE5\u5177\u7ED3\u679C\u4E2D\u4E0D\u80FD\u5305\u542B\u5DE5\u5177\u8BF7\u6C42", "UNSUPPORTED_CONTENT");
        default:
          throw new LlmError("\u7B2C\u4E09\u65B9 DeepSeek \u4E0D\u652F\u6301\u8BE5\u5185\u5BB9\u5757", "UNSUPPORTED_CONTENT");
      }
    }
    return parts;
  };
  const textOf = (parts) => parts.filter((p) => p.type === "text").map((p) => p.text).join("");
  const contentOf = (parts) => parts.some((p) => p.type === "image_url") ? parts : textOf(parts);
  const wire = [];
  if (options.system) wire.push({ role: "system", content: options.system });
  let pendingImages = [];
  const flush = () => {
    if (!pendingImages.length) return;
    wire.push({ role: "user", content: [{ type: "text", text: "Attached image(s) from tool result:" }, ...pendingImages] });
    pendingImages = [];
  };
  for (const message of messages) {
    if (message.role === "assistant") {
      flush();
      const calls = message.content.filter((b) => b.type === "tool-call");
      const reasoning = message.content.filter((b) => b.type === "reasoning").map((b) => b.text).join("");
      if (message.content.some((b) => !["text", "reasoning", "tool-call"].includes(b.type))) throw new LlmError("\u65E0\u6CD5\u8868\u793A assistant \u5386\u53F2\u5185\u5BB9", "UNSUPPORTED_CONTENT");
      wire.push({
        role: "assistant",
        content: message.content.filter((b) => b.type === "text").map((b) => b.text).join(""),
        ...reasoning ? { reasoning_content: reasoning } : {},
        ...calls.length ? { tool_calls: calls.map((b) => ({ id: b.id, type: "function", function: { name: b.name, arguments: b.arguments } })) } : {}
      });
    } else if (message.role === "system") {
      flush();
      if (message.content.some((b) => b.type !== "text")) throw new LlmError("\u7CFB\u7EDF\u6D88\u606F\u4EC5\u652F\u6301\u6587\u672C", "UNSUPPORTED_CONTENT");
      const text = message.content.map((b) => b.type === "text" ? b.text : "").join("");
      if (text) wire.push({ role: "system", content: text });
    } else {
      const results = message.content.filter((b) => b.type === "tool-result");
      const parts = partsFor(message.content.filter((b) => b.type !== "tool-result"));
      if (parts.length || !results.length) {
        flush();
        wire.push({ role: "user", content: contentOf(parts) });
      }
      for (const result of results) {
        const output = partsFor(result.content);
        wire.push({ role: "tool", tool_call_id: result.toolCallId, content: textOf(output) || "(no output)" });
        pendingImages.push(...output.filter((p) => p.type === "image_url"));
      }
    }
  }
  flush();
  return {
    model: options.model,
    messages: wire,
    stream: true,
    stream_options: { include_usage: true },
    thinking: { type: effort === "off" ? "disabled" : "enabled" },
    ...effort === "off" ? {} : { reasoning_effort: effort },
    max_tokens: options.maxTokens ?? model?.maxTokens ?? profile.maxTokens,
    ...options.temperature === void 0 ? {} : { temperature: options.temperature },
    ...options.stop === void 0 ? {} : { stop: options.stop },
    ...options.tools?.length ? { tools: options.tools.map((tool) => ({ type: "function", function: { name: tool.name, description: tool.description, parameters: tool.parameters } })) } : {}
  };
}
function imagePolicy(model) {
  return { maxPixels: model.imagePixelBudget === "low" ? 512 * 512 : model.imagePixelBudget ?? 64e4, maxBytes: model.imageMaxBytes ?? 1024 * 1024 };
}

// src/http.ts
import { LlmError as LlmError2, ProviderRequestId, attributionHeaders, isContextWindowExceededError, isQuotaExceededError } from "@deepseek-ai/dsh-llm";
function errorCode(status, detail) {
  return status === 401 || status === 403 ? "AUTH" : isQuotaExceededError(detail) || status === 402 ? "QUOTA" : isContextWindowExceededError(detail) ? "CONTEXT_WINDOW_EXCEEDED" : status === 429 ? "RATE_LIMIT" : status === 408 || status === 504 ? "TIMEOUT" : status >= 500 ? "SERVER" : status === 400 || status === 422 ? "INVALID_REQUEST" : `HTTP_${status}`;
}
function requestHeaders(key, extra, sessionId) {
  return { ...extra, authorization: `Bearer ${key}`, "content-type": "application/json", accept: "text/event-stream", ...attributionHeaders(), ...sessionId ? { "x-deepseek-harness-session-id": sessionId } : {} };
}
function redactDiagnostic(message, secrets) {
  let safe = message;
  for (const secret of secrets) if (secret) safe = safe.split(secret).join("[redacted]");
  return safe.replace(/sk-[a-zA-Z0-9_-]+/g, "[redacted]").slice(0, 1e3);
}
async function httpFailure(response, secrets = []) {
  const reader = response.body?.getReader();
  const decoder = new TextDecoder();
  let body = "";
  try {
    if (reader) while (body.length < 16384) {
      const { value, done } = await reader.read();
      if (done) break;
      body += decoder.decode(value, { stream: true });
    }
  } finally {
    await reader?.cancel().catch(() => {
    });
    reader?.releaseLock();
  }
  let detail = "";
  try {
    const error = JSON.parse(body)?.error;
    if (typeof error?.message === "string") detail = error.message;
    else if (typeof error === "string") detail = error;
  } catch {
  }
  const status = response.status;
  const code = errorCode(status, detail);
  const after = response.headers.get("retry-after");
  const delay = after === null ? NaN : /^\d+(\.\d+)?$/.test(after) ? Number(after) * 1e3 : Date.parse(after) - Date.now();
  const id = response.headers.get("x-request-id") ?? response.headers.get("request-id");
  return new LlmError2(`\u7F51\u5173 HTTP ${status}${detail ? ": " + redactDiagnostic(detail, secrets) : ""}`, code, {
    status,
    ...Number.isFinite(delay) && delay > 0 ? { providerRetryAfterMs: delay } : {},
    ...id && !secrets.some((s) => s && id.includes(s)) ? { requestId: ProviderRequestId(id) } : {}
  });
}
async function cancellable(promise, signal) {
  signal.throwIfAborted();
  let abort = () => {
  };
  try {
    return await Promise.race([promise, new Promise((_, reject) => {
      abort = () => reject(signal.reason);
      signal.addEventListener("abort", abort, { once: true });
    })]);
  } finally {
    signal.removeEventListener("abort", abort);
  }
}
function idleControl(caller, ms) {
  const controller = new AbortController();
  let timedOut = false;
  let timer;
  const pulse = () => {
    clearTimeout(timer);
    if (!controller.signal.aborted) timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, ms);
  };
  const abort = () => controller.abort();
  if (caller?.aborted) abort();
  else caller?.addEventListener("abort", abort, { once: true });
  pulse();
  return {
    signal: controller.signal,
    pulse,
    classify(error) {
      if (caller?.aborted) return new LlmError2("\u8C03\u7528\u5DF2\u53D6\u6D88", "ABORTED");
      if (timedOut) return new LlmError2(`\u7F51\u5173\u7A7A\u95F2\u8D85\u65F6\uFF08${ms}ms\uFF09`, "TIMEOUT");
      if (error instanceof LlmError2) return error;
      return new LlmError2("\u7F51\u5173\u8FDE\u63A5\u6216\u6D41\u8BFB\u53D6\u5931\u8D25", "TRANSPORT");
    },
    dispose() {
      clearTimeout(timer);
      caller?.removeEventListener("abort", abort);
      controller.abort();
    }
  };
}

// src/stream.ts
import { createParser } from "eventsource-parser";
import { LlmError as LlmError3, ToolCallId } from "@deepseek-ai/dsh-llm";
async function* ssePayloads(body, activity) {
  const queue = [];
  let failure;
  const parser = createParser({
    maxBufferSize: 8 * 1024 * 1024,
    onEvent: (e) => queue.push(e.data),
    onError: (e) => {
      if (e.type === "max-buffer-size-exceeded") failure = new LlmError3("SSE \u4E8B\u4EF6\u8D85\u8FC7 8 MiB", "MALFORMED_RESPONSE");
    }
  });
  const reader = body.getReader();
  const decoder = new TextDecoder();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      activity();
      parser.feed(decoder.decode(value, { stream: true }));
      if (failure) throw failure;
      while (queue.length) yield queue.shift();
    }
    parser.feed(decoder.decode());
    if (failure) throw failure;
    while (queue.length) yield queue.shift();
  } finally {
    await reader.cancel().catch(() => {
    });
    reader.releaseLock();
  }
}
function object(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
var malformed = () => new LlmError3("\u7F51\u5173\u8FD4\u56DE\u4E86\u4E0D\u7B26\u5408 Chat Completions \u7684\u6D41\u6570\u636E", "MALFORMED_RESPONSE");
function count(value) {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}
function mapUsage(raw) {
  if (!count(raw.prompt_tokens) || !count(raw.completion_tokens)) return void 0;
  const details = object(raw.prompt_tokens_details) ? raw.prompt_tokens_details : {};
  const output = object(raw.completion_tokens_details) ? raw.completion_tokens_details : {};
  const hit = raw.prompt_cache_hit_tokens ?? details.cached_tokens;
  const cache = count(hit) && hit <= raw.prompt_tokens ? hit : 0;
  const total = raw.prompt_tokens + raw.completion_tokens;
  return {
    inputTokens: raw.prompt_tokens - cache,
    outputTokens: raw.completion_tokens,
    ...raw.total_tokens === void 0 || raw.total_tokens === total ? { totalTokens: total } : {},
    ...cache ? { cacheReadTokens: cache } : {},
    ...count(output.reasoning_tokens) ? { reasoningTokens: output.reasoning_tokens } : {}
  };
}
function finishReason(value) {
  if (value === "stop") return { kind: "stop" };
  if (value === "tool_calls") return { kind: "tool-calls" };
  if (value === "length") return { kind: "max-tokens" };
  return { kind: "error", failure: { code: value === "content_filter" ? "CONTENT_FILTER" : "MALFORMED_RESPONSE", message: "\u7F51\u5173\u4EE5\u4E0D\u652F\u6301\u7684\u539F\u56E0\u7EC8\u6B62\u54CD\u5E94" } };
}
async function* translate(payloads, secrets = []) {
  const blocks = [];
  let text;
  let reasoning;
  const tools = /* @__PURE__ */ new Map();
  let finish;
  let usage;
  const open = (kind) => {
    const b = { index: blocks.length, kind, text: "" };
    blocks.push(b);
    return b;
  };
  const identity = (current, next) => {
    if (next === void 0 || next === null || next === "") return current;
    if (typeof next !== "string" || current !== void 0 && current !== next) throw malformed();
    return next;
  };
  for await (const data of payloads) {
    if (data === "[DONE]") {
      if (!finish) throw new LlmError3("SSE \u7ED3\u675F\u524D\u7F3A\u5C11 finish_reason", "MALFORMED_RESPONSE");
      const ids = /* @__PURE__ */ new Set();
      for (const b of tools.values()) {
        if (!b.id || !b.name || ids.has(b.id)) throw malformed();
        ids.add(b.id);
      }
      if (tools.size && finish.kind === "stop") finish = { kind: "tool-calls" };
      if (finish.kind === "tool-calls" && !tools.size) throw malformed();
      for (const b of blocks) {
        const block = b.kind === "tool-call" ? { type: "tool-call", id: ToolCallId(b.id), name: b.name, arguments: b.text } : { type: b.kind, text: b.text };
        yield { type: "block-end", index: b.index, block };
      }
      if (usage) yield { type: "usage", usage };
      yield { type: "finish", reason: finish.kind === "stop" && !blocks.length ? { kind: "error", failure: { code: "EMPTY_RESPONSE", message: "\u6A21\u578B\u8FD4\u56DE\u4E86\u7A7A\u54CD\u5E94" } } : finish };
      return;
    }
    let chunk;
    try {
      chunk = JSON.parse(data);
    } catch {
      throw malformed();
    }
    if (!object(chunk)) throw malformed();
    if (chunk.error) {
      const e = object(chunk.error) ? chunk.error : {};
      const detail = [e.message, e.type, e.code].filter((v) => typeof v === "string").join(" ");
      const code = /rate.?limit/i.test(detail) ? "RATE_LIMIT" : errorCode(typeof e.status === "number" ? e.status : 500, detail);
      throw new LlmError3(`\u7F51\u5173 SSE \u9519\u8BEF${detail ? ": " + redactDiagnostic(detail, secrets) : ""}`, code);
    }
    if (!Array.isArray(chunk.choices)) throw malformed();
    for (const raw of chunk.choices) {
      if (!object(raw) || raw.index !== void 0 && raw.index !== 0) throw malformed();
      const delta = raw.delta;
      if (delta !== void 0 && !object(delta)) throw malformed();
      if (object(delta)) {
        for (const key of ["reasoning_content", "content"]) {
          const part = delta[key];
          if (part === void 0 || part === null || part === "") continue;
          if (typeof part !== "string" || finish) throw malformed();
          let b = key === "content" ? text : reasoning;
          if (!b) {
            b = open(key === "content" ? "text" : "reasoning");
            if (key === "content") text = b;
            else reasoning = b;
            yield { type: "block-start", index: b.index, blockType: b.kind };
          }
          b.text += part;
          yield { type: key === "content" ? "text-delta" : "reasoning-delta", index: b.index, text: part };
        }
        if (delta.tool_calls !== void 0 && delta.tool_calls !== null) {
          if (!Array.isArray(delta.tool_calls) || finish) throw malformed();
          for (const call of delta.tool_calls) {
            if (!object(call) || !count(call.index) || call.type !== void 0 && call.type !== "function") throw malformed();
            if (call.function !== void 0 && call.function !== null && !object(call.function)) throw malformed();
            const fn = object(call.function) ? call.function : {};
            const args = fn.arguments ?? "";
            if (typeof args !== "string") throw malformed();
            let b = tools.get(call.index);
            if (!b) {
              b = open("tool-call");
              tools.set(call.index, b);
              yield { type: "block-start", index: b.index, blockType: "tool-call" };
            }
            b.id = identity(b.id, call.id);
            b.name = identity(b.name, fn.name);
            b.text += args;
            yield { type: "tool-call-delta", index: b.index, id: ToolCallId(b.id ?? ""), ...b.name ? { name: b.name } : {}, argumentsDelta: args };
          }
        }
      }
      if (raw.finish_reason !== void 0 && raw.finish_reason !== null) {
        if (typeof raw.finish_reason !== "string" || finish) throw malformed();
        finish = finishReason(raw.finish_reason);
      }
    }
    if (object(chunk.usage)) usage = mapUsage(chunk.usage) ?? usage;
  }
  throw new LlmError3("\u7F51\u5173\u6D41\u5728 [DONE] \u524D\u5173\u95ED", "STREAM_CLOSED");
}

// src/adapter.ts
var GatewayAdapter = class extends LlmAdapter {
  constructor(services) {
    super();
    this.services = services;
  }
  profile(route) {
    const p = this.services.profiles().get(route);
    if (!p) throw new LlmError4("\u8BE5\u7F51\u5173\u672A\u914D\u7F6E", "NO_ADAPTER");
    return p;
  }
  providerInfo(provider) {
    return { id: provider, name: this.profile(provider).displayName };
  }
  providerRetryPolicy(provider) {
    return this.profile(provider).retryPolicy;
  }
  async listModels(provider) {
    return this.profile(provider).models.map((m) => ({ provider, id: m.id, name: m.name ?? m.id, description: m.description, inputModalities: m.inputModalities ?? ["text"] }));
  }
  modelInfo(p, model) {
    const m = p.models.find((entry) => entry.id === model);
    return {
      provider: p.route,
      id: model,
      name: m?.name ?? model,
      description: m?.description,
      inputModalities: m?.inputModalities ?? ["text"],
      context: { contextWindow: m?.contextWindow ?? p.defaultContextWindow },
      defaultMaxTokens: m?.maxTokens ?? p.maxTokens,
      reasoning: {
        efforts: EFFORTS.map((id) => ({ id: ReasoningEffortId(id), name: { off: "\u5173\u95ED", low: "\u4F4E", high: "\u9AD8", max: "\u6700\u9AD8" }[id], description: "\u53D1\u9001 DeepSeek \u5B98\u65B9\u63A8\u7406\u53C2\u6570\uFF0C\u5B9E\u9645\u6548\u679C\u7531\u7F51\u5173\u51B3\u5B9A" })),
        defaultEffort: ReasoningEffortId(p.reasoningEffort)
      }
    };
  }
  async resolveModel(provider, model, signal) {
    signal?.throwIfAborted();
    return this.modelInfo(this.profile(provider), model);
  }
  async prepareCall(provider, model, signal) {
    signal?.throwIfAborted();
    const profile = this.profile(provider);
    return { model: this.modelInfo(profile, model), stream: (options) => this.streamWithProfile(options, profile) };
  }
  stream(options) {
    return this.streamWithProfile(options, this.profile(options.provider));
  }
  async *streamWithProfile(options, profile) {
    const idle = idleControl(options.signal, profile.streamIdleTimeoutMs);
    try {
      idle.signal.throwIfAborted();
      const key = await cancellable(this.services.resolveApiKey(profile), idle.signal);
      idle.signal.throwIfAborted();
      const services = this.services.serializationServices?.() ?? this.services;
      const body = await cancellable(serializeRequest({ ...options, signal: idle.signal }, profile, services), idle.signal);
      idle.pulse();
      const response = await (this.services.fetch ?? fetch)(`${profile.baseURL}/chat/completions`, {
        method: "POST",
        headers: requestHeaders(key, profile.headers, options.sessionId),
        body: JSON.stringify(body),
        signal: idle.signal,
        redirect: "error"
      });
      idle.pulse();
      if (!response.ok) throw await httpFailure(response, [key, ...Object.values(profile.headers ?? {})]);
      if (!response.body || !response.headers.get("content-type")?.includes("text/event-stream")) {
        await response.body?.cancel();
        throw new LlmError4("\u7F51\u5173\u672A\u8FD4\u56DE SSE \u54CD\u5E94", "MALFORMED_RESPONSE");
      }
      yield* translate(ssePayloads(response.body, idle.pulse), [key, ...Object.values(profile.headers ?? {})]);
    } catch (error) {
      throw idle.classify(error);
    } finally {
      idle.dispose();
    }
  }
};

// src/config.ts
import z from "@deepseek-ai/schemastery";
import { credentialRef } from "@deepseek-ai/dsh-credentials";
import { LlmError as LlmError5, RetryPolicySchema, resolveRetryPolicy } from "@deepseek-ai/dsh-llm";
var positiveInteger = () => z.number().min(1).step(1);
var ModelSchema = z.object({
  id: z.string().required(),
  name: z.string(),
  description: z.string(),
  contextWindow: positiveInteger(),
  maxTokens: positiveInteger(),
  inputModalities: z.array(z.union(["text", "image"])).default(["text"]),
  imagePixelBudget: z.union([positiveInteger(), z.const("low")]),
  imageMaxBytes: positiveInteger()
});
var ProfileSchema = z.object({
  displayName: z.string(),
  baseURL: z.string().required(),
  apiKeyEnv: z.string(),
  headers: z.dict(z.string()).role("secret"),
  models: z.array(ModelSchema).required(),
  reasoningEffort: z.union([...EFFORTS]),
  defaultContextWindow: positiveInteger(),
  maxTokens: positiveInteger(),
  streamIdleTimeoutMs: positiveInteger().max(2147483647),
  maxInlineRequestImageBytes: positiveInteger(),
  maxImagesPerRequest: positiveInteger(),
  retryPolicy: RetryPolicySchema
});
var Config = z.object({ providers: z.dict(ProfileSchema).default({}) });
function apiBaseURL(input) {
  try {
    const url = new URL(input.trim());
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error();
    return url.toString().replace(/\/+$/, "");
  } catch {
    throw new LlmError5("Base URL \u5FC5\u987B\u662F\u65E0\u7528\u6237\u540D\u3001\u5BC6\u7801\u3001\u67E5\u8BE2\u53C2\u6570\u548C\u7247\u6BB5\u7684 HTTP(S) API \u6839\u5730\u5740", "INVALID_CONFIG");
  }
}
function resolveProfiles(config) {
  const result = /* @__PURE__ */ new Map();
  const number = (value, fallback, path) => {
    const n = value ?? fallback;
    if (!Number.isSafeInteger(n) || n <= 0) throw new LlmError5(`${path} \u5FC5\u987B\u662F\u6B63\u6574\u6570`, "INVALID_CONFIG");
    return n;
  };
  for (const [route, raw] of Object.entries(config.providers ?? {})) {
    if (!ROUTE_PATTERN.test(route) || route === "deepseek-official") throw new LlmError5("\u63D0\u4F9B\u65B9 ID \u5FC5\u987B\u662F\u5C0F\u5199\u8FDE\u5B57\u7B26\u6807\u8BC6\u7B26\uFF0C\u4E14\u4E0D\u80FD\u5360\u7528 deepseek-official", "INVALID_CONFIG");
    if (!raw || typeof raw !== "object" || !Array.isArray(raw.models) || !raw.models.length) throw new LlmError5(`${route}: \u81F3\u5C11\u914D\u7F6E\u4E00\u4E2A\u6A21\u578B`, "INVALID_CONFIG");
    const seen = /* @__PURE__ */ new Set();
    const models = raw.models.map((m) => {
      if (typeof m.id !== "string" || !m.id.trim() || m.id !== m.id.trim() || seen.has(m.id)) throw new LlmError5(`${route}: \u6A21\u578B ID \u4E0D\u80FD\u4E3A\u7A7A\u6216\u91CD\u590D`, "INVALID_CONFIG");
      seen.add(m.id);
      if (m.name !== void 0 && !m.name.trim()) throw new LlmError5(`${route}/${m.id}: \u663E\u793A\u540D\u4E0D\u80FD\u4E3A\u7A7A`, "INVALID_CONFIG");
      for (const key of ["contextWindow", "maxTokens", "imageMaxBytes"]) if (m[key] !== void 0) number(m[key], 1, `${route}/${m.id}.${key}`);
      if (m.imagePixelBudget !== void 0 && m.imagePixelBudget !== "low") number(m.imagePixelBudget, 1, `${route}/${m.id}.imagePixelBudget`);
      const input = m.inputModalities ?? ["text"];
      if (!input.includes("text") || input.some((v) => v !== "text" && v !== "image")) throw new LlmError5(`${route}/${m.id}: \u8F93\u5165\u7C7B\u578B\u987B\u5305\u542B text\uFF0C\u56FE\u7247\u80FD\u529B\u4F7F\u7528 image`, "INVALID_CONFIG");
      return Object.freeze({ ...m, inputModalities: Object.freeze([...input]) });
    });
    const effort = raw.reasoningEffort ?? "high";
    if (!EFFORTS.includes(effort)) throw new LlmError5(`${route}: \u4E0D\u652F\u6301\u7684\u63A8\u7406\u5F3A\u5EA6`, "INVALID_CONFIG");
    if (raw.apiKeyEnv !== void 0 && !/^[A-Za-z_][A-Za-z0-9_]*$/.test(raw.apiKeyEnv)) throw new LlmError5(`${route}: \u51ED\u636E\u5F15\u7528\u987B\u662F\u6709\u6548\u73AF\u5883\u53D8\u91CF\u540D`, "INVALID_CONFIG");
    const headers = {};
    for (const [name2, value] of Object.entries(raw.headers ?? {})) {
      if (/^(authorization|proxy-authorization|content-type|accept|host|cookie|set-cookie|x-deepseek-harness-.*)$/i.test(name2)) throw new LlmError5(`${route}: \u4E0D\u5141\u8BB8\u8986\u76D6\u9274\u6743\u3001\u534F\u8BAE\u6216 harness \u5F52\u56E0\u6807\u5934`, "INVALID_CONFIG");
      try {
        new Headers({ [name2]: value });
      } catch {
        throw new LlmError5(`${route}: \u8BF7\u6C42\u5934\u683C\u5F0F\u65E0\u6548`, "INVALID_CONFIG");
      }
      headers[name2] = value;
    }
    const profile = {
      ...raw,
      route,
      displayName: raw.displayName?.trim() || route,
      baseURL: apiBaseURL(raw.baseURL),
      apiKeyEnv: credentialRef(raw.apiKeyEnv ?? keyRefFor(route)),
      headers: Object.freeze(headers),
      models: Object.freeze(models),
      reasoningEffort: effort,
      defaultContextWindow: number(raw.defaultContextWindow, 262144, `${route}.defaultContextWindow`),
      maxTokens: number(raw.maxTokens, 32768, `${route}.maxTokens`),
      streamIdleTimeoutMs: number(raw.streamIdleTimeoutMs, 3e5, `${route}.streamIdleTimeoutMs`),
      maxInlineRequestImageBytes: number(raw.maxInlineRequestImageBytes, 20 * 1024 * 1024, `${route}.maxInlineRequestImageBytes`),
      maxImagesPerRequest: number(raw.maxImagesPerRequest, 600, `${route}.maxImagesPerRequest`),
      retryPolicy: resolveRetryPolicy(raw.retryPolicy, route)
    };
    if (profile.streamIdleTimeoutMs > 2147483647) throw new LlmError5(`${route}: \u7A7A\u95F2\u8D85\u65F6\u8D85\u51FA\u8BA1\u65F6\u5668\u8303\u56F4`, "INVALID_CONFIG");
    result.set(route, Object.freeze(profile));
  }
  return result;
}

// src/discovery.ts
import { LlmError as LlmError6, assertUsableApiKey } from "@deepseek-ai/dsh-llm";
async function discoverModels(request, profiles, resolveKey, signal) {
  const p = request.provider ? profiles.get(request.provider) : void 0;
  const base = request.baseURL ?? p?.baseURL;
  if (!base) throw new LlmError6("\u8BF7\u586B\u5199 Base URL", "INVALID_REQUEST");
  const idle = idleControl(signal, Math.min(p?.streamIdleTimeoutMs ?? 3e4, 3e4));
  try {
    const key = request.apiKey !== void 0 ? assertUsableApiKey(request.apiKey, "llm-deepseek-gateway", "draft") : p ? await cancellable(resolveKey(p), idle.signal) : void 0;
    if (!key) throw new LlmError6("\u83B7\u53D6\u6A21\u578B\u9700\u8981 API Key\uFF1B\u4E5F\u53EF\u4EE5\u624B\u5DE5\u586B\u5199\u6A21\u578B", "MISSING_CREDENTIAL");
    const response = await fetch(`${apiBaseURL(base)}/models`, { headers: { ...requestHeaders(key, p?.headers), accept: "application/json" }, signal: idle.signal, redirect: "error" });
    if (!response.ok) throw await httpFailure(response, [key, ...Object.values(p?.headers ?? {})]);
    const value = await response.json();
    const list = Array.isArray(value.data) ? value.data : Array.isArray(value.models) ? value.models : void 0;
    if (!list) throw new LlmError6("\u6A21\u578B\u5217\u8868\u7F3A\u5C11 data/models \u6570\u7EC4\uFF1B\u8BF7\u624B\u5DE5\u586B\u5199\u6A21\u578B", "MALFORMED_RESPONSE");
    const seen = /* @__PURE__ */ new Set();
    const positive = (v) => typeof v === "number" && Number.isSafeInteger(v) && v > 0 ? v : void 0;
    return list.flatMap((entry) => {
      if (!entry || typeof entry.id !== "string" || !entry.id.trim() || seen.has(entry.id)) return [];
      seen.add(entry.id);
      return [{
        id: entry.id,
        name: typeof entry.name === "string" ? entry.name : void 0,
        contextWindow: positive(entry.context_window ?? entry.contextWindow),
        maxTokens: positive(entry.max_tokens ?? entry.maxTokens)
      }];
    });
  } catch (error) {
    throw idle.classify(error);
  } finally {
    idle.dispose();
  }
}

// src/index.ts
var name = NS;
var inject = ["llm"];
function apply(ctx, config) {
  let source = () => config;
  let raw = source();
  let profiles = resolveProfiles(raw);
  let registration;
  let directory;
  let synchronizing = false;
  let rejected;
  const key = async (p) => {
    const credentials = ctx.get("credentials");
    const value = (credentials ? (await credentials.resolve(p.apiKeyEnv))?.value : void 0) ?? launchEnvironmentOf(ctx).get(p.apiKeyEnv)?.value;
    if (!value) throw new LlmError7(`${p.route}: \u672A\u914D\u7F6E\u51ED\u636E ${p.apiKeyEnv}`, "MISSING_CREDENTIAL");
    return assertUsableApiKey2(value, NS, p.apiKeyEnv);
  };
  const synchronize = () => {
    const nextRaw = source();
    if (raw === nextRaw && registration) return;
    const next = resolveProfiles(nextRaw);
    const previous = profiles;
    profiles = next;
    synchronizing = true;
    try {
      const routes = [...next.keys()];
      const entries = routes.map((provider) => ({ provider, displayName: next.get(provider).displayName, settingsNs: NS, settingsPath: ["providers", provider], declared: true }));
      if (registration) registration.replace(routes);
      else if (routes.length) registration = ctx.llm.registerAdapter(routes, adapter);
      if (directory) directory.replace(entries);
      else if (entries.length) directory = ctx.llm.registerConfigurableProviders(entries);
      raw = nextRaw;
    } catch (error) {
      profiles = previous;
      registration?.replace([...previous.keys()]);
      directory?.replace([...previous.values()].map((p) => ({ provider: p.route, displayName: p.displayName, settingsNs: NS, settingsPath: ["providers", p.route], declared: true })));
      throw error;
    } finally {
      synchronizing = false;
    }
  };
  const current = () => {
    if (!synchronizing && raw !== source() && rejected !== source()) {
      try {
        synchronize();
      } catch {
        rejected = source();
        ctx.logger.warn("\u7B2C\u4E09\u65B9 DeepSeek \u914D\u7F6E\u672A\u751F\u6548\uFF0C\u4FDD\u7559\u6700\u540E\u6709\u6548\u7F51\u5173\u914D\u7F6E");
      }
    }
    return profiles;
  };
  const adapter = new GatewayAdapter({
    profiles: current,
    resolveApiKey: key,
    serializationServices: () => {
      const attachments = ctx.get("attachments");
      const fs = ctx.get("fs");
      return {
        attachments,
        resolveImageAccess: attachments ? (ref) => resolveImageAttachmentAccess(attachments, (path) => fs?.processPathFromHostPath(path), ref) : void 0,
        resolveFilePath: (path) => fs?.processPathFromHostPath(path)
      };
    }
  });
  synchronize();
  ctx.llm.registerModelDiscovery(NS, (request, signal) => discoverModels(request, current(), key, signal));
  ctx.inject(["settings"], (settingsCtx) => {
    settingsCtx.settings.installSection(ctx, NS, Config, config, {
      setSource: (next) => {
        source = next;
      },
      validate: (value) => {
        const proposed = resolveProfiles(value);
        const owned = new Set(profiles.keys());
        const taken = ctx.llm.listProviders().filter((p) => !owned.has(p.id));
        const declared = ctx.llm.listConfigurableProviders().filter((p) => p.settingsNs !== NS);
        if ([...proposed.keys()].some((id) => taken.some((p) => p.id === id) || declared.some((p) => p.provider === id))) throw new LlmError7("\u63D0\u4F9B\u65B9 ID \u5DF2\u88AB\u5176\u4ED6\u9002\u914D\u5668\u5360\u7528", "DUPLICATE_ADAPTER");
      },
      onChange: synchronize
    });
  });
}
export {
  Config,
  GatewayAdapter,
  apply,
  discoverModels,
  inject,
  name,
  resolveProfiles
};
//# sourceMappingURL=index.js.map
