// src/index.ts
import {
  LlmError as LlmError8,
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
var PROTOCOLS = ["chat-completions", "responses", "anthropic-messages"];
var NATIVE_SEARCH_MODES = ["none", "openai-chat", "openai-responses", "anthropic-messages"];
var ROUTE_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
function keyRefFor(route) {
  return `${route.toUpperCase().replace(/-/g, "_")}_API_KEY`;
}

// src/serialize.ts
import * as DshLlm from "@deepseek-ai/dsh-llm";
var { LlmError, contentHasImage, projectImagesForTextModel, offloadedImageText, requestImageHandleText, fileHandleText } = DshLlm;
var projectOffloadedImages2 = DshLlm.projectOffloadedImages ?? ((messages, placeholder) => messages.map((message) => ({ ...message, content: message.content.map((block) => block.type === "image" && block.offloaded ? { type: "text", text: placeholder(block.attachment) } : block) })));
var requiredImageOffload2 = DshLlm.requiredImageOffload ?? ((messages, budget, bytes) => {
  let total = 0;
  let count2 = 0;
  for (const message of messages) for (const block of message.content) if (block.type === "image" && !block.offloaded) {
    total += bytes(block);
    count2++;
  }
  return total > budget.maxBytes || count2 > budget.maxImages ? Math.max(1, count2 - budget.maxImages + 1) : 0;
});
var projectToolUpdates2 = DshLlm.projectToolUpdates ?? ((messages, tools) => ({ messages: messages.filter((message) => message.role !== "developer"), tools }));
function nativeSearchFor(model, protocol, tools) {
  if (!model?.nativeSearch || model.nativeSearch === "none" || !tools?.some((tool) => tool.name === "web_search")) return void 0;
  const expected = protocol === "responses" ? "openai-responses" : protocol === "anthropic-messages" ? "anthropic-messages" : "openai-chat";
  if (model.nativeSearch !== expected) throw new LlmError(`${model.id} \u7684\u539F\u751F\u641C\u7D22\u534F\u8BAE\u4E0E\u7F51\u5173\u534F\u8BAE\u4E0D\u5339\u914D`, "NATIVE_SEARCH_PROTOCOL_MISMATCH");
  return model.nativeSearch;
}
function splitSearchTool(tools, native) {
  return native ? { tools: tools?.filter((tool) => tool.name !== "web_search"), hasNative: true } : { tools, hasNative: false };
}
function responseParts(parts, role) {
  return parts.map((part) => part.type === "text" ? { type: role === "assistant" ? "output_text" : "input_text", text: part.text } : { type: "input_image", image_url: part.image_url.url });
}
function toolArguments(value) {
  try {
    const parsed = JSON.parse(value || "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
    return parsed;
  } catch {
    throw new LlmError("Anthropic Messages \u5DE5\u5177\u53C2\u6570\u4E0D\u662F\u6709\u6548 JSON \u5BF9\u8C61", "INVALID_REQUEST");
  }
}
function responseBody(wire, tools, options, model, effort) {
  const native = nativeSearchFor(model, "responses", tools);
  const selected = splitSearchTool(tools, native);
  const instructions = wire.filter((message) => message.role === "system").map((message) => typeof message.content === "string" ? message.content : textParts(message.content)).join("\n");
  const input = [];
  for (const message of wire) {
    if (message.role === "system") continue;
    if (message.role === "tool") {
      input.push({ type: "function_call_output", call_id: message.tool_call_id, output: typeof message.content === "string" ? message.content : textParts(message.content) });
      continue;
    }
    if (message.role === "assistant" && message.tool_calls?.length) {
      const visible = typeof message.content === "string" ? message.content : textParts(message.content);
      if (visible) input.push({ role: "assistant", content: [{ type: "output_text", text: visible }] });
      for (const call of message.tool_calls) input.push({ type: "function_call", call_id: call.id, name: call.function.name, arguments: call.function.arguments });
      continue;
    }
    const role = message.role === "assistant" ? "assistant" : message.role;
    input.push({ role, content: responseParts(typeof message.content === "string" ? [{ type: "text", text: message.content }] : message.content, role === "assistant" ? "assistant" : "user") });
  }
  return {
    model: options.model,
    input,
    stream: true,
    ...instructions ? { instructions } : {},
    ...effort === "off" ? {} : { reasoning: { effort } },
    max_output_tokens: options.maxTokens ?? model?.maxTokens,
    ...options.temperature === void 0 && model?.defaultTemperature === void 0 ? {} : { temperature: options.temperature ?? model?.defaultTemperature },
    ...options.stop === void 0 ? {} : { stop: options.stop },
    ...selected.tools?.length && model?.supportsTools !== false && model?.supportsWebSearch !== false ? { tools: selected.tools.map((tool) => ({ type: "function", name: tool.name, description: tool.description, parameters: tool.parameters })) } : {},
    ...native ? { tools: [...(selected.tools ?? []).map((tool) => ({ type: "function", name: tool.name, description: tool.description, parameters: tool.parameters })), { type: String(model?.nativeSearchConfig?.type ?? "web_search_preview"), ...model?.nativeSearchConfig ?? {} }] } : {}
  };
}
function anthropicContent(content, role) {
  const parts = typeof content === "string" ? [{ type: "text", text: content }] : content;
  return parts.map((part) => part.type === "text" ? { type: "text", text: part.text } : { type: "image", source: { type: "base64", media_type: part.image_url.url.slice(5, part.image_url.url.indexOf(";base64,")), data: part.image_url.url.slice(part.image_url.url.indexOf(";base64,") + 8) } });
}
function anthropicBody(wire, tools, options, model, effort) {
  const native = nativeSearchFor(model, "anthropic-messages", tools);
  const selected = splitSearchTool(tools, native);
  const system = wire.filter((message) => message.role === "system").map((message) => typeof message.content === "string" ? message.content : textParts(message.content)).join("\n");
  const messages = [];
  for (const message of wire) {
    if (message.role === "system") continue;
    if (message.role === "tool") {
      messages.push({ role: "user", content: [{ type: "tool_result", tool_use_id: message.tool_call_id, content: typeof message.content === "string" ? message.content : anthropicContent(message.content, "user") }] });
      continue;
    }
    if (message.role === "assistant" && message.tool_calls?.length) {
      const content = [];
      const visible = typeof message.content === "string" ? message.content : textParts(message.content);
      if (visible) content.push({ type: "text", text: visible });
      content.push(...message.tool_calls.map((call) => ({ type: "tool_use", id: call.id, name: call.function.name, input: toolArguments(call.function.arguments) })));
      messages.push({ role: "assistant", content });
      continue;
    }
    messages.push({ role: message.role === "assistant" ? "assistant" : "user", content: anthropicContent(message.content, message.role === "assistant" ? "assistant" : "user") });
  }
  return {
    model: options.model,
    messages,
    max_tokens: options.maxTokens ?? model?.maxTokens ?? 32768,
    stream: true,
    ...system ? { system } : {},
    ...effort === "off" ? {} : { thinking: { type: "enabled", budget_tokens: Math.max(1024, Math.min((options.maxTokens ?? model?.maxTokens ?? 32768) - 1, effort === "low" ? 1024 : effort === "high" ? 4096 : 8192)) } },
    ...options.temperature === void 0 && model?.defaultTemperature === void 0 ? {} : { temperature: options.temperature ?? model?.defaultTemperature },
    ...options.stop === void 0 ? {} : { stop_sequences: Array.isArray(options.stop) ? options.stop : [options.stop] },
    ...selected.tools?.length && model?.supportsTools !== false && model?.supportsWebSearch !== false ? { tools: selected.tools.map((tool) => ({ name: tool.name, description: tool.description, input_schema: tool.parameters })) } : {},
    ...native ? { tools: [...(selected.tools ?? []).map((tool) => ({ name: tool.name, description: tool.description, input_schema: tool.parameters })), { type: "web_search_20250305", name: "web_search", max_uses: model?.nativeSearchMaxUses ?? 5, ...model?.nativeSearchConfig ?? {} }] } : {}
  };
}
function textParts(content) {
  return content.filter((part) => part.type === "text").map((part) => part.text).join("");
}
async function serializeRequest(options, profile, services = {}) {
  const model = profile.models.find((m) => m.id === options.model);
  const effort = options.purpose === "session-title" ? "off" : options.reasoningEffort ?? model?.defaultReasoningEffort ?? profile.reasoningEffort;
  if (!EFFORTS.includes(effort)) throw new LlmError("\u4E0D\u652F\u6301\u7684 DeepSeek \u63A8\u7406\u5F3A\u5EA6", "UNSUPPORTED_REASONING_EFFORT");
  if (options.purpose !== "session-title" && model?.reasoningEfforts && !model.reasoningEfforts.includes(effort)) throw new LlmError(`${options.model} \u4E0D\u652F\u6301\u63A8\u7406\u6863\u4F4D ${effort}`, "UNSUPPORTED_REASONING_EFFORT");
  const imageCapable = model?.inputModalities?.includes("image") === true;
  const projected = projectToolUpdates2(options.messages, options.tools, void 0, options.toolHistory);
  const hasImages = projected.messages.some((m) => contentHasImage(m.content));
  for (const message of projected.messages) {
    if (message.role !== "user" && message.role !== "tool" && contentHasImage(message.content)) throw new LlmError(`\u65E0\u6CD5\u53D1\u9001 ${message.role} \u6D88\u606F\u4E2D\u7684\u56FE\u7247`, "UNSUPPORTED_CONTENT");
  }
  const versions = /* @__PURE__ */ new Map();
  if (imageCapable && hasImages) {
    if (!services.attachments) throw new LlmError("\u56FE\u7247\u8F93\u5165\u9700\u8981 dsh \u9644\u4EF6\u670D\u52A1", "UNSUPPORTED_CONTENT");
    const refs = [];
    const collect = (blocks) => {
      for (const block of blocks) {
        if (block.type === "image" && !block.offloaded) refs.push(block.attachment);
      }
    };
    projected.messages.forEach((m) => collect(m.content));
    for (const ref of refs) {
      options.signal?.throwIfAborted();
      if (!versions.has(ref.attachmentId)) versions.set(ref.attachmentId, await services.attachments.readImageRequest(ref, imagePolicy(model, ref), options.signal));
    }
  }
  if (imageCapable && hasImages) {
    const offloadImages = requiredImageOffload2(projected.messages, {
      representation: "base64",
      maxBytes: profile.maxInlineRequestImageBytes,
      maxImages: profile.maxImagesPerRequest,
      byteQuantum: Math.min(profile.maxInlineRequestImageBytes, 10 * 1024 * 1024),
      countQuantum: 20
    }, (block) => versions.get(block.attachment.attachmentId)?.bytes ?? block.attachment.bytes);
    if (offloadImages) throw new LlmError("\u5185\u8054\u56FE\u7247\u8D85\u8FC7\u8BF7\u6C42\u4E0A\u9650\uFF0C\u9700\u7531 dsh \u5378\u8F7D\u6700\u65E7\u56FE\u7247\u540E\u91CD\u8BD5", "IMAGE_OFFLOAD_REQUIRED", { offloadImages });
  }
  const messages = hasImages ? imageCapable ? projectOffloadedImages2(projected.messages, (ref) => offloadedImageText(ref, services.resolveImageAccess?.(ref))) : projectImagesForTextModel(projected.messages) : projected.messages;
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
    } else if (message.role === "tool") {
      const output = partsFor(message.content);
      wire.push({ role: "tool", tool_call_id: message.toolCallId, content: textOf(output) || "(no output)" });
      pendingImages.push(...output.filter((p) => p.type === "image_url"));
    } else if (message.role === "user") {
      flush();
      wire.push({ role: "user", content: contentOf(partsFor(message.content)) });
    } else {
      throw new LlmError("\u65E0\u6CD5\u8868\u793A\u6B64\u5F00\u53D1\u8005\u6D88\u606F", "UNSUPPORTED_CONTENT");
    }
  }
  flush();
  const tools = projected.tools?.map((tool) => ({ name: tool.name, description: tool.description, parameters: tool.parameters }));
  const protocol = profile.protocol ?? "chat-completions";
  if (protocol === "responses") return responseBody(wire, tools, options, model, effort);
  if (protocol === "anthropic-messages") return anthropicBody(wire, tools, options, model, effort);
  const native = nativeSearchFor(model, "chat-completions", tools);
  const selected = splitSearchTool(tools, native);
  return {
    model: options.model,
    messages: wire,
    stream: true,
    stream_options: { include_usage: true },
    thinking: { type: effort === "off" ? "disabled" : "enabled" },
    ...effort === "off" ? {} : { reasoning_effort: effort },
    max_tokens: options.maxTokens ?? model?.maxTokens ?? profile.maxTokens,
    ...options.temperature === void 0 && model?.defaultTemperature === void 0 ? {} : { temperature: options.temperature ?? model?.defaultTemperature },
    ...options.stop === void 0 ? {} : { stop: options.stop },
    ...selected.tools?.length && model?.supportsTools !== false && model?.supportsWebSearch !== false ? { tools: selected.tools.map((tool) => ({ type: "function", function: tool })) } : {},
    ...native ? { web_search_options: { ...model?.nativeSearchConfig ?? {}, ...model?.nativeSearchMaxUses ? { max_uses: model.nativeSearchMaxUses } : {} } } : {}
  };
}
function imagePolicy(model, ref) {
  const pixels = model.imagePixelBudget === "low" ? 512 * 512 : model.imagePixelBudget ?? 64e4;
  const scale = Math.min(1, Math.sqrt(pixels / (ref.width * ref.height)), 4096 / Math.max(ref.width, ref.height));
  return { width: Math.max(1, Math.floor(ref.width * scale)), height: Math.max(1, Math.floor(ref.height * scale)), maxBytes: model.imageMaxBytes ?? 1024 * 1024 };
}

// src/http.ts
import { LlmError as LlmError2, ProviderRequestId, attributionHeaders, isContextWindowExceededError, isQuotaExceededError } from "@deepseek-ai/dsh-llm";
function errorCode(status, detail) {
  return status === 401 || status === 403 ? "AUTH" : isQuotaExceededError(detail) || status === 402 ? "QUOTA" : isContextWindowExceededError(detail) ? "CONTEXT_WINDOW_EXCEEDED" : status === 429 ? "RATE_LIMIT" : status === 408 || status === 504 ? "TIMEOUT" : status >= 500 ? "SERVER" : status === 400 || status === 422 ? "INVALID_REQUEST" : `HTTP_${status}`;
}
function requestHeaders(key, extra, sessionId, protocol = "chat-completions") {
  const auth = protocol === "anthropic-messages" ? { "x-api-key": key, "anthropic-version": "2023-06-01" } : { authorization: `Bearer ${key}` };
  const headers = { ...extra ?? {}, "content-type": "application/json", accept: "text/event-stream", ...attributionHeaders(), ...sessionId ? { "x-deepseek-harness-session-id": sessionId } : {} };
  Object.assign(headers, auth);
  return headers;
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
var malformed = () => new LlmError3("\u7F51\u5173\u8FD4\u56DE\u4E86\u4E0D\u7B26\u5408\u6240\u9009\u534F\u8BAE\u7684\u6D41\u6570\u636E", "MALFORMED_RESPONSE");
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
function usageFromResponses(raw) {
  if (!raw || !count(raw.input_tokens) || !count(raw.output_tokens)) return void 0;
  const total = raw.total_tokens;
  return { inputTokens: raw.input_tokens, outputTokens: raw.output_tokens, ...count(total) ? { totalTokens: total } : {} };
}
function usageFromAnthropic(raw, prior) {
  if (!raw || typeof raw !== "object") return prior;
  const input = count(raw.input_tokens) ? raw.input_tokens : prior?.inputTokens;
  const output = count(raw.output_tokens) ? raw.output_tokens : prior?.outputTokens;
  if (input === void 0 || output === void 0) return prior;
  return { inputTokens: input, outputTokens: output, totalTokens: input + output };
}
async function* translateResponses(payloads, secrets = []) {
  const blocks = [];
  const tools = /* @__PURE__ */ new Map();
  let text;
  let reasoning;
  let finish;
  let usage;
  const open = (kind, key) => {
    const b = { index: blocks.length, kind, text: "" };
    blocks.push(b);
    if (key) tools.set(key, b);
    return b;
  };
  const complete = async function* () {
    if (!finish) finish = tools.size ? { kind: "tool-calls" } : { kind: "stop" };
    for (const b of blocks) yield { type: "block-end", index: b.index, block: b.kind === "tool-call" ? { type: "tool-call", id: ToolCallId(b.id), name: b.name, arguments: b.text } : { type: b.kind, text: b.text } };
    if (usage) yield { type: "usage", usage };
    yield { type: "finish", reason: finish.kind === "stop" && !blocks.length ? { kind: "error", failure: { code: "EMPTY_RESPONSE", message: "\u6A21\u578B\u8FD4\u56DE\u4E86\u7A7A\u54CD\u5E94" } } : finish };
  };
  for await (const data of payloads) {
    if (data === "[DONE]") {
      yield* complete();
      return;
    }
    let raw;
    try {
      raw = JSON.parse(data);
    } catch {
      throw malformed();
    }
    if (!object(raw)) throw malformed();
    const event = raw;
    if (event.error) throw new LlmError3(`Responses \u7F51\u5173\u9519\u8BEF${event.error.message ? ": " + redactDiagnostic(String(event.error.message), secrets) : ""}`, errorCode(Number(event.error.status) || 500, String(event.error.message ?? "")));
    const type = event.type;
    if (typeof type !== "string") throw malformed();
    if (type === "response.output_item.added") {
      const item = event.item;
      if (object(item) && item.type === "function_call") {
        const key = String(item.call_id ?? item.id ?? "");
        if (!key) throw malformed();
        const b = open("tool-call", key);
        b.id = String(item.call_id ?? key);
        b.name = typeof item.name === "string" ? item.name : void 0;
        if (item.id && String(item.id) !== key) tools.set(String(item.id), b);
        yield { type: "block-start", index: b.index, blockType: "tool-call" };
        if (typeof item.arguments === "string" && item.arguments) {
          b.text += item.arguments;
          yield { type: "tool-call-delta", index: b.index, id: ToolCallId(key), ...b.name ? { name: b.name } : {}, argumentsDelta: item.arguments };
        }
      }
    } else if (type === "response.output_text.delta") {
      if (typeof event.delta !== "string") throw malformed();
      if (!text) {
        text = open("text");
        yield { type: "block-start", index: text.index, blockType: "text" };
      }
      text.text += event.delta;
      yield { type: "text-delta", index: text.index, text: event.delta };
    } else if (type === "response.reasoning_summary_text.delta" || type === "response.reasoning_text.delta") {
      if (typeof event.delta !== "string") throw malformed();
      if (!reasoning) {
        reasoning = open("reasoning");
        yield { type: "block-start", index: reasoning.index, blockType: "reasoning" };
      }
      reasoning.text += event.delta;
      yield { type: "reasoning-delta", index: reasoning.index, text: event.delta };
    } else if (type === "response.function_call_arguments.delta") {
      if (typeof event.delta !== "string") throw malformed();
      const key = String(event.item_id ?? event.call_id ?? "");
      const b = tools.get(key);
      if (!b) throw malformed();
      b.text += event.delta;
      yield { type: "tool-call-delta", index: b.index, id: ToolCallId(b.id), ...b.name ? { name: b.name } : {}, argumentsDelta: event.delta };
    } else if (type === "response.completed") {
      usage = usageFromResponses(event.response?.usage) ?? usage;
      const status = event.response?.status;
      finish = tools.size ? { kind: "tool-calls" } : status === "incomplete" ? { kind: "max-tokens" } : { kind: "stop" };
      yield* complete();
      return;
    } else if (type === "response.incomplete") {
      finish = { kind: "max-tokens" };
    } else if (type === "response.failed") throw new LlmError3(`Responses \u7F51\u5173\u5931\u8D25${event.response?.error?.message ? ": " + redactDiagnostic(String(event.response.error.message), secrets) : ""}`, "SERVER");
    if (event.response?.usage) usage = usageFromResponses(event.response.usage) ?? usage;
  }
  throw new LlmError3("Responses \u7F51\u5173\u6D41\u5728\u7ED3\u675F\u524D\u5173\u95ED", "STREAM_CLOSED");
}
async function* translateAnthropic(payloads, secrets = []) {
  const blocks = [];
  const byIndex = /* @__PURE__ */ new Map();
  let finish;
  let usage;
  const complete = async function* () {
    if (!finish) finish = blocks.some((b) => b.kind === "tool-call") ? { kind: "tool-calls" } : { kind: "stop" };
    for (const b of blocks) yield { type: "block-end", index: b.index, block: b.kind === "tool-call" ? { type: "tool-call", id: ToolCallId(b.id), name: b.name, arguments: b.text } : { type: b.kind, text: b.text } };
    if (usage) yield { type: "usage", usage };
    yield { type: "finish", reason: finish.kind === "stop" && !blocks.length ? { kind: "error", failure: { code: "EMPTY_RESPONSE", message: "\u6A21\u578B\u8FD4\u56DE\u4E86\u7A7A\u54CD\u5E94" } } : finish };
  };
  for await (const data of payloads) {
    if (data === "[DONE]") {
      yield* complete();
      return;
    }
    let raw;
    try {
      raw = JSON.parse(data);
    } catch {
      throw malformed();
    }
    if (!object(raw)) throw malformed();
    const event = raw;
    if (event.type === "error") throw new LlmError3(`Anthropic \u7F51\u5173\u9519\u8BEF${event.error?.message ? ": " + redactDiagnostic(String(event.error.message), secrets) : ""}`, "SERVER");
    if (event.type === "message_start") usage = usageFromAnthropic(event.message?.usage, usage);
    else if (event.type === "content_block_start") {
      const block = event.content_block;
      if (!object(block) || typeof event.index !== "number") throw malformed();
      const kind = block.type === "tool_use" ? "tool-call" : block.type === "thinking" ? "reasoning" : block.type === "text" ? "text" : void 0;
      if (!kind) continue;
      const b = { index: blocks.length, kind, text: "", ...kind === "tool-call" ? { id: typeof block.id === "string" ? block.id : void 0, name: typeof block.name === "string" ? block.name : void 0 } : {} };
      blocks.push(b);
      byIndex.set(event.index, b);
      yield { type: "block-start", index: b.index, blockType: b.kind };
    } else if (event.type === "content_block_delta") {
      const b = byIndex.get(event.index);
      const delta = event.delta;
      if (!b || !object(delta)) throw malformed();
      if (delta.type === "text_delta" || delta.type === "thinking_delta") {
        const text = delta.type === "thinking_delta" ? delta.thinking : delta.text;
        if (typeof text !== "string") throw malformed();
        b.text += text;
        yield { type: delta.type === "text_delta" ? "text-delta" : "reasoning-delta", index: b.index, text };
      } else if (delta.type === "input_json_delta") {
        if (typeof delta.partial_json !== "string" || b.kind !== "tool-call") throw malformed();
        b.text += delta.partial_json;
        yield { type: "tool-call-delta", index: b.index, id: ToolCallId(b.id), ...b.name ? { name: b.name } : {}, argumentsDelta: delta.partial_json };
      }
    } else if (event.type === "message_delta") {
      usage = usageFromAnthropic(event.usage, usage);
      const reason = event.delta?.stop_reason;
      if (reason === "tool_use") finish = { kind: "tool-calls" };
      else if (reason === "max_tokens") finish = { kind: "max-tokens" };
      else if (reason === "end_turn" || reason === "stop_sequence") finish = { kind: "stop" };
    } else if (event.type === "message_stop") {
      yield* complete();
      return;
    }
  }
  throw new LlmError3("Anthropic \u7F51\u5173\u6D41\u5728 message_stop \u524D\u5173\u95ED", "STREAM_CLOSED");
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
        efforts: (m?.reasoningEfforts ?? EFFORTS).map((id) => ({ id: ReasoningEffortId(id), name: { off: "\u5173\u95ED", low: "\u4F4E", high: "\u9AD8", max: "\u6700\u9AD8" }[id], description: "\u53D1\u9001\u517C\u5BB9\u7F51\u5173\u63A8\u7406\u53C2\u6570\uFF0C\u5B9E\u9645\u6548\u679C\u7531\u4E0A\u6E38\u51B3\u5B9A" })),
        defaultEffort: ReasoningEffortId(m?.defaultReasoningEffort ?? p.reasoningEffort)
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
      const protocol = profile.protocol ?? "chat-completions";
      const endpoint2 = protocol === "responses" ? "/responses" : protocol === "anthropic-messages" ? "/messages" : "/chat/completions";
      const response = await (this.services.fetch ?? fetch)(`${profile.baseURL}${endpoint2}`, {
        method: "POST",
        headers: requestHeaders(key, profile.headers, options.sessionId, protocol),
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
      const payloads = ssePayloads(response.body, idle.pulse);
      yield* protocol === "responses" ? translateResponses(payloads, [key, ...Object.values(profile.headers ?? {})]) : protocol === "anthropic-messages" ? translateAnthropic(payloads, [key, ...Object.values(profile.headers ?? {})]) : translate(payloads, [key, ...Object.values(profile.headers ?? {})]);
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

// src/catalog.ts
var OFFICIAL_MODEL_CATALOG = [
  { id: "deepseek-chat", name: "DeepSeek Chat", providerFamily: "deepseek", contextWindow: 131072, maxTokens: 8192, inputModalities: ["text"], reasoningEfforts: [...EFFORTS], defaultReasoningEffort: "high", supportsTools: true, defaultTemperature: 1 },
  { id: "deepseek-reasoner", name: "DeepSeek Reasoner", providerFamily: "deepseek", contextWindow: 131072, maxTokens: 65536, inputModalities: ["text"], reasoningEfforts: ["low", "high", "max"], defaultReasoningEffort: "high", supportsTools: true },
  { id: "deepseek-v4.1-flash", name: "DeepSeek V4.1 Flash", providerFamily: "deepseek", contextWindow: 262144, maxTokens: 32768, inputModalities: ["text"], reasoningEfforts: [...EFFORTS], defaultReasoningEffort: "high", supportsTools: true },
  { id: "gpt-4.1", name: "GPT-4.1", providerFamily: "openai", contextWindow: 1047576, maxTokens: 32768, inputModalities: ["text", "image"], reasoningEfforts: ["off"], defaultReasoningEffort: "off", supportsTools: true, defaultTemperature: 1, nativeSearch: "openai-responses" },
  { id: "gpt-4o", name: "GPT-4o", providerFamily: "openai", contextWindow: 128e3, maxTokens: 16384, inputModalities: ["text", "image"], reasoningEfforts: ["off"], defaultReasoningEffort: "off", supportsTools: true, defaultTemperature: 1, nativeSearch: "openai-responses" },
  { id: "o3", name: "o3", providerFamily: "openai", contextWindow: 2e5, maxTokens: 1e5, inputModalities: ["text", "image"], reasoningEfforts: ["low", "high", "max"], defaultReasoningEffort: "high", supportsTools: true, nativeSearch: "openai-responses" },
  { id: "o4-mini", name: "o4-mini", providerFamily: "openai", contextWindow: 2e5, maxTokens: 1e5, inputModalities: ["text", "image"], reasoningEfforts: ["low", "high", "max"], defaultReasoningEffort: "high", supportsTools: true, nativeSearch: "openai-responses" },
  { id: "claude-3-7-sonnet-20250219", name: "Claude 3.7 Sonnet", providerFamily: "anthropic", contextWindow: 2e5, maxTokens: 64e3, inputModalities: ["text", "image"], reasoningEfforts: ["off", "low", "high", "max"], defaultReasoningEffort: "high", supportsTools: true, nativeSearch: "anthropic-messages" },
  { id: "claude-sonnet-4-20250514", name: "Claude Sonnet 4", providerFamily: "anthropic", contextWindow: 2e5, maxTokens: 64e3, inputModalities: ["text", "image"], reasoningEfforts: ["off", "low", "high", "max"], defaultReasoningEffort: "high", supportsTools: true, nativeSearch: "anthropic-messages" },
  { id: "claude-opus-4-1-20250805", name: "Claude Opus 4.1", providerFamily: "anthropic", contextWindow: 2e5, maxTokens: 32e3, inputModalities: ["text", "image"], reasoningEfforts: ["off", "low", "high", "max"], defaultReasoningEffort: "high", supportsTools: true, nativeSearch: "anthropic-messages" },
  { id: "grok-3", name: "Grok 3", providerFamily: "xai", contextWindow: 131072, maxTokens: 32768, inputModalities: ["text"], reasoningEfforts: ["off"], defaultReasoningEffort: "off", supportsTools: true, defaultTemperature: 1, nativeSearch: "openai-chat" },
  { id: "grok-3-mini", name: "Grok 3 Mini", providerFamily: "xai", contextWindow: 131072, maxTokens: 32768, inputModalities: ["text"], reasoningEfforts: ["low", "high", "max"], defaultReasoningEffort: "high", supportsTools: true },
  { id: "grok-4", name: "Grok 4", providerFamily: "xai", contextWindow: 256e3, maxTokens: 32768, inputModalities: ["text", "image"], reasoningEfforts: ["low", "high", "max"], defaultReasoningEffort: "high", supportsTools: true, nativeSearch: "openai-chat" }
];
var byId = new Map(OFFICIAL_MODEL_CATALOG.map((model) => [model.id, model]));
function officialModelDefaults(id) {
  return byId.get(id.trim());
}
function enrichModel(model) {
  const defaults = officialModelDefaults(model.id);
  const explicitInput = model.inputModalities?.length ? model.inputModalities : void 0;
  const explicitEfforts = model.reasoningEfforts?.length ? model.reasoningEfforts : void 0;
  return {
    ...defaults ?? {},
    ...model,
    id: model.id,
    name: model.name ?? defaults?.name,
    contextWindow: model.contextWindow ?? defaults?.contextWindow,
    maxTokens: model.maxTokens ?? defaults?.maxTokens,
    inputModalities: explicitInput ?? defaults?.inputModalities ?? ["text"],
    reasoningEfforts: explicitEfforts ?? defaults?.reasoningEfforts ?? [...EFFORTS],
    defaultReasoningEffort: model.defaultReasoningEffort ?? defaults?.defaultReasoningEffort ?? "high",
    supportsTools: model.supportsTools ?? defaults?.supportsTools ?? true,
    defaultTemperature: model.defaultTemperature ?? defaults?.defaultTemperature,
    nativeSearch: model.nativeSearch ?? defaults?.nativeSearch ?? "none",
    supportsWebSearch: model.supportsWebSearch ?? true
  };
}

// src/config.ts
var positiveInteger = () => z.number().min(1).step(1);
var ModelSchema = z.object({
  id: z.string().required(),
  name: z.string(),
  description: z.string(),
  contextWindow: positiveInteger(),
  maxTokens: positiveInteger(),
  inputModalities: z.array(z.union(["text", "image"])),
  providerFamily: z.union(["deepseek", "openai", "anthropic", "xai"]),
  reasoningEfforts: z.array(z.union([...EFFORTS])),
  defaultReasoningEffort: z.union([...EFFORTS]),
  supportsTools: z.boolean(),
  defaultTemperature: z.number().min(0).max(2),
  nativeSearch: z.union([...NATIVE_SEARCH_MODES]),
  nativeSearchMaxUses: positiveInteger(),
  nativeSearchConfig: z.dict(z.union([z.string(), z.number(), z.boolean()])),
  supportsWebSearch: z.boolean(),
  imagePixelBudget: z.union([positiveInteger(), z.const("low")]),
  imageMaxBytes: positiveInteger()
});
var ProfileSchema = z.object({
  displayName: z.string(),
  baseURL: z.string().required(),
  protocol: z.union([...PROTOCOLS]),
  apiKeyEnv: z.string(),
  headers: z.dict(z.string()).role("secret"),
  models: z.array(ModelSchema).required(),
  reasoningEffort: z.union([...EFFORTS]),
  defaultContextWindow: positiveInteger(),
  maxTokens: positiveInteger(),
  streamIdleTimeoutMs: positiveInteger().max(2147483647),
  maxInlineRequestImageBytes: positiveInteger(),
  maxImagesPerRequest: positiveInteger(),
  retryPolicy: RetryPolicySchema,
  webSearch: z.object({ enabled: z.boolean(), allowGenericFallback: z.boolean(), maxUses: positiveInteger(), timeoutMs: positiveInteger(), model: z.string() })
});
var Config = z.object({ providers: z.dict(ProfileSchema).default({}).volatile() }).default({});
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
      const input = m.inputModalities?.length ? m.inputModalities : void 0;
      if (input && (!input.includes("text") || input.some((v) => v !== "text" && v !== "image"))) throw new LlmError5(`${route}/${m.id}: \u8F93\u5165\u7C7B\u578B\u987B\u5305\u542B text\uFF0C\u56FE\u7247\u80FD\u529B\u4F7F\u7528 image`, "INVALID_CONFIG");
      const enriched = enrichModel({ ...m, ...input ? { inputModalities: [...input] } : {} });
      const efforts = enriched.reasoningEfforts ?? [...EFFORTS];
      if (!efforts.length || efforts.some((e) => !EFFORTS.includes(e))) throw new LlmError5(`${route}/${m.id}: \u63A8\u7406\u6863\u4F4D\u65E0\u6548`, "INVALID_CONFIG");
      if (!efforts.includes(enriched.defaultReasoningEffort ?? "high")) throw new LlmError5(`${route}/${m.id}: \u9ED8\u8BA4\u63A8\u7406\u6863\u4F4D\u4E0D\u5728\u652F\u6301\u5217\u8868\u4E2D`, "INVALID_CONFIG");
      if (enriched.defaultTemperature !== void 0 && (!Number.isFinite(enriched.defaultTemperature) || enriched.defaultTemperature < 0 || enriched.defaultTemperature > 2)) throw new LlmError5(`${route}/${m.id}: \u9ED8\u8BA4 temperature \u5FC5\u987B\u5728 0 \u5230 2 \u4E4B\u95F4`, "INVALID_CONFIG");
      if (enriched.nativeSearch !== void 0 && !NATIVE_SEARCH_MODES.includes(enriched.nativeSearch)) throw new LlmError5(`${route}/${m.id}: \u539F\u751F\u641C\u7D22\u534F\u8BAE\u65E0\u6548`, "INVALID_CONFIG");
      if (enriched.nativeSearchMaxUses !== void 0) number(enriched.nativeSearchMaxUses, 1, `${route}/${m.id}.nativeSearchMaxUses`);
      return Object.freeze({ ...enriched, inputModalities: Object.freeze([...enriched.inputModalities ?? ["text"]]), reasoningEfforts: Object.freeze([...efforts]) });
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
      protocol: raw.protocol ?? "chat-completions",
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
      webSearch: {
        enabled: raw.webSearch?.enabled ?? true,
        allowGenericFallback: raw.webSearch?.allowGenericFallback ?? true,
        maxUses: number(raw.webSearch?.maxUses, 5, `${route}.webSearch.maxUses`),
        timeoutMs: number(raw.webSearch?.timeoutMs, 3e4, `${route}.webSearch.timeoutMs`),
        ...raw.webSearch?.model ? { model: raw.webSearch.model } : {}
      },
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
    const response = await fetch(`${apiBaseURL(base)}/models`, { headers: { ...requestHeaders(key, p?.headers, void 0, p?.protocol ?? "chat-completions"), accept: "application/json" }, signal: idle.signal, redirect: "error" });
    if (!response.ok) throw await httpFailure(response, [key, ...Object.values(p?.headers ?? {})]);
    const value = await response.json();
    const list = Array.isArray(value.data) ? value.data : Array.isArray(value.models) ? value.models : void 0;
    if (!list) throw new LlmError6("\u6A21\u578B\u5217\u8868\u7F3A\u5C11 data/models \u6570\u7EC4\uFF1B\u8BF7\u624B\u5DE5\u586B\u5199\u6A21\u578B", "MALFORMED_RESPONSE");
    const seen = /* @__PURE__ */ new Set();
    const positive = (v) => typeof v === "number" && Number.isSafeInteger(v) && v > 0 ? v : void 0;
    return list.flatMap((entry) => {
      if (!entry || typeof entry.id !== "string" || !entry.id.trim() || seen.has(entry.id)) return [];
      seen.add(entry.id);
      const official = officialModelDefaults(entry.id);
      const enriched = enrichModel({
        id: entry.id,
        ...official ? {} : { name: typeof entry.name === "string" ? entry.name : void 0, contextWindow: positive(entry.context_window ?? entry.contextWindow), maxTokens: positive(entry.max_tokens ?? entry.maxTokens) }
      });
      if (!official) delete enriched.inputModalities;
      return [enriched];
    });
  } catch (error) {
    throw idle.classify(error);
  } finally {
    idle.dispose();
  }
}

// src/web.ts
import { LlmError as LlmError7 } from "@deepseek-ai/dsh-llm";
var MODEL_GATEWAY_WEB_PROVIDER = "model-gateway-web";
function endpoint(profile, protocol) {
  return `${profile.baseURL}${protocol === "responses" ? "/responses" : protocol === "anthropic-messages" ? "/messages" : "/chat/completions"}`;
}
function sourcesFrom(value) {
  const output = Array.isArray(value?.output) ? value.output : [];
  const annotations = output.flatMap((item) => Array.isArray(item?.content) ? item.content.flatMap((part) => part?.annotations ?? []) : item?.annotations ?? []);
  const blocks = Array.isArray(value?.content) ? value.content : [];
  const resultItems = blocks.flatMap((block) => block?.type === "web_search_tool_result" && Array.isArray(block.content) ? block.content : []).filter((item) => item?.type === "web_search_result");
  const chatAnnotations = value?.choices?.flatMap((choice) => choice?.message?.annotations ?? []) ?? [];
  const all = [...resultItems, ...annotations, ...chatAnnotations];
  const seen = /* @__PURE__ */ new Set();
  return all.flatMap((item) => {
    const url = String(item?.url ?? item?.url_citation?.url ?? "");
    if (!url || seen.has(url)) return [];
    seen.add(url);
    const title = item?.title ?? item?.url_citation?.title;
    return [{ url, ...typeof title === "string" && title ? { title } : {}, ...typeof item?.snippet === "string" && item.snippet ? { snippet: item.snippet } : {} }];
  });
}
function nativeBody(profile, model, query) {
  const configured = profile.models.find((entry) => entry.id === model);
  const mode = configured?.nativeSearch && configured.nativeSearch !== "none" ? configured.nativeSearch : profile.protocol === "responses" ? "openai-responses" : profile.protocol === "anthropic-messages" ? "anthropic-messages" : "openai-chat";
  const maxUses = configured?.nativeSearchMaxUses ?? profile.webSearch.maxUses;
  if (mode === "openai-responses") return {
    model,
    input: [{ role: "user", content: [{ type: "input_text", text: `Perform a web search for the query: ${query}` }] }],
    stream: false,
    tools: [{ type: String(configured?.nativeSearchConfig?.type ?? "web_search_preview"), ...configured?.nativeSearchConfig ?? {}, ...maxUses ? { max_uses: maxUses } : {} }]
  };
  if (mode === "anthropic-messages") return {
    model,
    max_tokens: configured?.maxTokens ?? profile.maxTokens,
    messages: [{ role: "user", content: [{ type: "text", text: `Perform a web search for the query: ${query}` }] }],
    tools: [{ type: "web_search_20250305", name: "web_search", max_uses: maxUses, ...configured?.nativeSearchConfig ?? {} }]
  };
  return { model, messages: [{ role: "user", content: `Perform a web search for the query: ${query}` }], web_search_options: { ...configured?.nativeSearchConfig ?? {}, ...maxUses ? { max_uses: maxUses } : {} } };
}
var GatewayWebSearchProvider = class {
  constructor(profiles, resolveApiKey, currentProvider, fetchImpl = fetch) {
    this.profiles = profiles;
    this.resolveApiKey = resolveApiKey;
    this.currentProvider = currentProvider;
    this.fetchImpl = fetchImpl;
  }
  id = MODEL_GATEWAY_WEB_PROVIDER;
  available() {
    for (const profile of this.profiles().values()) if (profile.webSearch.enabled && profile.models.length) return true;
    return false;
  }
  async search(request, signal) {
    const profiles = this.profiles();
    const route = this.currentProvider();
    const profile = (route ? profiles.get(route) : void 0) ?? profiles.values().next().value;
    if (!profile || !profile.webSearch.enabled) throw new LlmError7("\u6CA1\u6709\u53EF\u7528\u7684\u6A21\u578B\u7F51\u5173\u7F51\u9875\u641C\u7D22\u914D\u7F6E", "WEB_PROVIDER_UNAVAILABLE");
    const model = profile.webSearch.model ?? profile.models.find((entry) => entry.nativeSearch && entry.nativeSearch !== "none")?.id ?? profile.models[0].id;
    const key = await this.resolveApiKey(profile);
    const native = profile.models.find((entry) => entry.id === model)?.nativeSearch;
    if ((!native || native === "none") && !profile.webSearch.allowGenericFallback) throw new LlmError7("\u5F53\u524D\u6A21\u578B\u672A\u914D\u7F6E\u539F\u751F\u641C\u7D22\uFF0C\u4E14\u7F51\u5173\u5DF2\u5173\u95ED\u901A\u7528\u641C\u7D22\u56DE\u9000", "WEB_PROVIDER_UNAVAILABLE");
    const protocol = native === "anthropic-messages" ? "anthropic-messages" : native === "openai-responses" ? "responses" : native === "openai-chat" ? "chat-completions" : profile.protocol ?? "chat-completions";
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), profile.webSearch.timeoutMs);
    const abort = () => controller.abort();
    signal?.addEventListener("abort", abort, { once: true });
    try {
      const response = await this.fetchImpl(endpoint(profile, protocol), { method: "POST", redirect: "error", headers: requestHeaders(key, profile.headers, void 0, protocol), body: JSON.stringify(nativeBody(profile, model, request.query)), signal: controller.signal });
      if (!response.ok) {
        const text = await response.text().catch(() => "");
        let detail = "";
        try {
          detail = JSON.parse(text)?.error?.message ?? JSON.parse(text)?.message ?? "";
        } catch {
        }
        throw new LlmError7(`\u6A21\u578B\u7F51\u5173\u641C\u7D22 HTTP ${response.status}${detail ? `: ${redactDiagnostic(String(detail), [key])}` : ""}`, errorCode(response.status, String(detail)));
      }
      const sources = sourcesFrom(await response.json());
      if (!sources.length) throw new LlmError7("\u539F\u751F\u641C\u7D22\u54CD\u5E94\u4E0D\u5305\u542B\u53EF\u7528\u6765\u6E90", "NATIVE_SEARCH_RESPONSE_INVALID");
      return { sources, truncated: false };
    } catch (error) {
      if (signal?.aborted) throw new LlmError7("\u7F51\u9875\u641C\u7D22\u5DF2\u53D6\u6D88", "WEB_ABORTED");
      if (controller.signal.aborted) throw new LlmError7(`\u7F51\u9875\u641C\u7D22\u8D85\u65F6\uFF08${profile.webSearch.timeoutMs}ms\uFF09`, "TIMEOUT");
      throw error;
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
    }
  }
};

// src/index.ts
var name = NS;
var inject = ["llm", "web"];
function apply(ctx, config) {
  const source = () => ({ providers: config.providers.get() });
  let raw = source();
  let profiles = resolveProfiles(raw);
  let registration;
  let directory;
  let synchronizing = false;
  let rejected;
  const key = async (p) => {
    const credentials = ctx.get("credentials");
    const value = (credentials ? (await credentials.resolve(p.apiKeyEnv))?.value : void 0) ?? launchEnvironmentOf(ctx).get(p.apiKeyEnv)?.value;
    if (!value) throw new LlmError8(`${p.route}: \u672A\u914D\u7F6E\u51ED\u636E ${p.apiKeyEnv}`, "MISSING_CREDENTIAL");
    return assertUsableApiKey2(value, NS, p.apiKeyEnv);
  };
  const synchronize = () => {
    const nextRaw = source();
    if (raw.providers === nextRaw.providers && registration) return;
    const next = resolveProfiles(nextRaw);
    const owned = new Set(profiles.keys());
    const taken = ctx.llm.listProviders().filter((p) => !owned.has(p.id));
    const declared = ctx.llm.listConfigurableProviders().filter((p) => p.settingsNs !== NS);
    if ([...next.keys()].some((id) => taken.some((p) => p.id === id) || declared.some((p) => p.provider === id))) throw new LlmError8("\u63D0\u4F9B\u65B9 ID \u5DF2\u88AB\u5176\u4ED6\u9002\u914D\u5668\u5360\u7528", "DUPLICATE_ADAPTER");
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
    if (!synchronizing && raw.providers !== source().providers && rejected?.providers !== source().providers) {
      try {
        synchronize();
      } catch {
        rejected = source();
        ctx.logger.warn("\u7B2C\u4E09\u65B9 DeepSeek \u914D\u7F6E\u672A\u751F\u6548\uFF0C\u4FDD\u7559\u6700\u540E\u6709\u6548\u7F51\u5173\u914D\u7F6E");
      }
    }
    return profiles;
  };
  ctx.on("internal/config", function(_candidate, next) {
    const candidate = next();
    if (this !== ctx.fiber) return candidate;
    const validated = Config(candidate);
    const parsed = resolveProfiles({ providers: validated.providers.get() });
    const owned = new Set(profiles.keys());
    const taken = ctx.llm.listProviders().filter((p) => !owned.has(p.id));
    const declared = ctx.llm.listConfigurableProviders().filter((p) => p.settingsNs !== NS);
    if ([...parsed.keys()].some((id) => taken.some((p) => p.id === id) || declared.some((p) => p.provider === id))) throw new LlmError8("\u63D0\u4F9B\u65B9 ID \u5DF2\u88AB\u5176\u4ED6\u9002\u914D\u5668\u5360\u7528", "DUPLICATE_ADAPTER");
    return candidate;
  });
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
  ctx.get?.("web")?.registerSearchProvider(new GatewayWebSearchProvider(current, key, () => {
    const agents = ctx.get?.("agents");
    return agents?.currentInitiator?.()?.session?.requestContext?.()?.provider;
  }));
  synchronize();
  ctx.llm.registerModelDiscovery(NS, (request, signal) => discoverModels(request, current(), key, signal));
  ctx.on("loader/volatile-update", () => {
    current();
  });
  ctx.inject(["settings"], (settingsCtx) => {
    settingsCtx.effect(() => settingsCtx.settings.configure({ auto: false }, ctx.fiber));
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
