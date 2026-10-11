import type { AttachmentStore, ImageAttachmentRef, RequestImageAttachment } from '@deepseek-ai/dsh-attachment';
import * as DshLlm from '@deepseek-ai/dsh-llm';
import type { ContentBlock, GenerateOptions, ImageAttachmentAccessResolver } from '@deepseek-ai/dsh-llm';
import { EFFORTS, type GatewayModel, type GatewayProtocol } from './shared.js';
import type { ResolvedProfile } from './config.js';

const { LlmError, contentHasImage, projectImagesForTextModel, offloadedImageText, requestImageHandleText, fileHandleText } = DshLlm;
const projectOffloadedImages = DshLlm.projectOffloadedImages ?? ((messages: any[], placeholder: (ref: any) => string) => messages.map(message => ({ ...message, content: message.content.map((block: any) => block.type === 'image' && block.offloaded ? { type: 'text', text: placeholder(block.attachment) } : block) })));
const requiredImageOffload = DshLlm.requiredImageOffload ?? ((messages: any[], budget: { maxBytes: number; maxImages: number }, bytes: (block: any) => number) => {
  let total = 0; let count = 0;
  for (const message of messages) for (const block of message.content) if (block.type === 'image' && !block.offloaded) { total += bytes(block); count++; }
  return total > budget.maxBytes || count > budget.maxImages ? Math.max(1, count - budget.maxImages + 1) : 0;
});
const projectToolUpdates = DshLlm.projectToolUpdates ?? ((messages: any[], tools: any[]) => ({ messages: messages.filter(message => message.role !== 'developer'), tools }));

export type WirePart = { type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } };
export interface WireMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | WirePart[];
  reasoning_content?: string;
  tool_call_id?: string;
  tool_calls?: { id: string; type: 'function'; function: { name: string; arguments: string } }[];
}

type ToolSchemaWire = { name: string; description?: string; parameters: unknown };

function responseParts(parts: WirePart[], role: 'user' | 'assistant') {
  return parts.map(part => part.type === 'text'
    ? { type: role === 'assistant' ? 'output_text' : 'input_text', text: part.text }
    : { type: 'input_image', image_url: part.image_url.url });
}

function toolArguments(value: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(value || '{}');
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
    return parsed as Record<string, unknown>;
  } catch { throw new LlmError('Anthropic Messages 工具参数不是有效 JSON 对象', 'INVALID_REQUEST'); }
}

function responseBody(wire: WireMessage[], tools: ToolSchemaWire[] | undefined, options: GenerateOptions, model: GatewayModel | undefined, effort: string): Record<string, unknown> {
  const instructions = wire.filter(message => message.role === 'system').map(message => typeof message.content === 'string' ? message.content : textParts(message.content)).join('\n');
  const input: unknown[] = [];
  for (const message of wire) {
    if (message.role === 'system') continue;
    if (message.role === 'tool') {
      input.push({ type: 'function_call_output', call_id: message.tool_call_id, output: typeof message.content === 'string' ? message.content : textParts(message.content) });
      continue;
    }
    if (message.role === 'assistant' && message.tool_calls?.length) {
      const visible = typeof message.content === 'string' ? message.content : textParts(message.content);
      if (visible) input.push({ role: 'assistant', content: [{ type: 'output_text', text: visible }] });
      for (const call of message.tool_calls) input.push({ type: 'function_call', call_id: call.id, name: call.function.name, arguments: call.function.arguments });
      continue;
    }
    const role = message.role === 'assistant' ? 'assistant' : message.role;
    input.push({ role, content: responseParts(typeof message.content === 'string' ? [{ type: 'text', text: message.content }] : message.content, role === 'assistant' ? 'assistant' : 'user') });
  }
  return {
    model: options.model, input, stream: true,
    ...(instructions ? { instructions } : {}),
    ...(effort === 'off' ? {} : { reasoning: { effort } }),
    max_output_tokens: options.maxTokens ?? model?.maxTokens,
    ...(options.temperature === undefined && model?.defaultTemperature === undefined ? {} : { temperature: options.temperature ?? model?.defaultTemperature }),
    ...(options.stop === undefined ? {} : { stop: options.stop }),
    ...(tools?.length && model?.supportsTools !== false ? { tools: tools.map(tool => ({ type: 'function', name: tool.name, description: tool.description, parameters: tool.parameters })) } : {}),
  };
}

function anthropicContent(content: string | WirePart[], role: 'user' | 'assistant') {
  const parts = typeof content === 'string' ? [{ type: 'text', text: content } as WirePart] : content;
  return parts.map(part => part.type === 'text'
    ? { type: 'text', text: part.text }
    : { type: 'image', source: { type: 'base64', media_type: part.image_url.url.slice(5, part.image_url.url.indexOf(';base64,')), data: part.image_url.url.slice(part.image_url.url.indexOf(';base64,') + 8) } });
}

function anthropicBody(wire: WireMessage[], tools: ToolSchemaWire[] | undefined, options: GenerateOptions, model: GatewayModel | undefined, effort: string): Record<string, unknown> {
  const system = wire.filter(message => message.role === 'system').map(message => typeof message.content === 'string' ? message.content : textParts(message.content)).join('\n');
  const messages: unknown[] = [];
  for (const message of wire) {
    if (message.role === 'system') continue;
    if (message.role === 'tool') {
      messages.push({ role: 'user', content: [{ type: 'tool_result', tool_use_id: message.tool_call_id, content: typeof message.content === 'string' ? message.content : anthropicContent(message.content, 'user') }] });
      continue;
    }
    if (message.role === 'assistant' && message.tool_calls?.length) {
      const content: unknown[] = [];
      const visible = typeof message.content === 'string' ? message.content : textParts(message.content);
      if (visible) content.push({ type: 'text', text: visible });
      content.push(...message.tool_calls.map(call => ({ type: 'tool_use', id: call.id, name: call.function.name, input: toolArguments(call.function.arguments) })));
      messages.push({ role: 'assistant', content });
      continue;
    }
    messages.push({ role: message.role === 'assistant' ? 'assistant' : 'user', content: anthropicContent(message.content, message.role === 'assistant' ? 'assistant' : 'user') });
  }
  return {
    model: options.model, messages, max_tokens: options.maxTokens ?? model?.maxTokens ?? 32768, stream: true,
    ...(system ? { system } : {}),
    ...(effort === 'off' ? {} : { thinking: { type: 'enabled', budget_tokens: Math.max(1024, Math.min((options.maxTokens ?? model?.maxTokens ?? 32768) - 1, effort === 'low' ? 1024 : effort === 'high' ? 4096 : 8192)) } }),
    ...(options.temperature === undefined && model?.defaultTemperature === undefined ? {} : { temperature: options.temperature ?? model?.defaultTemperature }),
    ...(options.stop === undefined ? {} : { stop_sequences: Array.isArray(options.stop) ? options.stop : [options.stop] }),
    ...(tools?.length && model?.supportsTools !== false ? { tools: tools.map(tool => ({ name: tool.name, description: tool.description, input_schema: tool.parameters })) } : {}),
  };
}

function textParts(content: WirePart[]): string { return content.filter((part): part is Extract<WirePart, { type: 'text' }> => part.type === 'text').map(part => part.text).join(''); }
export interface SerializationServices {
  attachments?: AttachmentStore;
  resolveImageAccess?: ImageAttachmentAccessResolver;
  resolveFilePath?: (hostPath: string) => string | undefined;
}

export async function serializeRequest(options: GenerateOptions, profile: ResolvedProfile, services: SerializationServices = {}): Promise<Record<string, unknown>> {
  const model = profile.models.find(m => m.id === options.model);
  const effort = options.purpose === 'session-title' ? 'off' : options.reasoningEffort ?? model?.defaultReasoningEffort ?? profile.reasoningEffort;
  if (!EFFORTS.includes(effort as typeof EFFORTS[number])) throw new LlmError('不支持的 DeepSeek 推理强度', 'UNSUPPORTED_REASONING_EFFORT');
  if (options.purpose !== 'session-title' && model?.reasoningEfforts && !model.reasoningEfforts.includes(effort as typeof EFFORTS[number])) throw new LlmError(`${options.model} 不支持推理档位 ${effort}`, 'UNSUPPORTED_REASONING_EFFORT');
  const imageCapable = model?.inputModalities?.includes('image') === true;
  const projected = projectToolUpdates(options.messages, options.tools, undefined, options.toolHistory);
  const hasImages = projected.messages.some(m => contentHasImage(m.content));
  for (const message of projected.messages) {
    if (message.role !== 'user' && message.role !== 'tool' && contentHasImage(message.content)) throw new LlmError(`无法发送 ${message.role} 消息中的图片`, 'UNSUPPORTED_CONTENT');
  }
  // History may contain images from a previously selected vision model. Preserve a
  // handle on a text route; the dsh upload gate rejects new unsupported images.
  const versions = new Map<string, RequestImageAttachment>();
  if (imageCapable && hasImages) {
    if (!services.attachments) throw new LlmError('图片输入需要 dsh 附件服务', 'UNSUPPORTED_CONTENT');
    const refs: ImageAttachmentRef[] = [];
    const collect = (blocks: readonly ContentBlock[]) => {
      for (const block of blocks) {
        if (block.type === 'image' && !block.offloaded) refs.push(block.attachment);
      }
    };
    projected.messages.forEach(m => collect(m.content));
    for (const ref of refs) {
      options.signal?.throwIfAborted();
      if (!versions.has(ref.attachmentId)) versions.set(ref.attachmentId, await services.attachments.readImageRequest(ref, imagePolicy(model!, ref), options.signal));
    }
  }
  if (imageCapable && hasImages) {
    const offloadImages = requiredImageOffload(projected.messages, {
      representation: 'base64', maxBytes: profile.maxInlineRequestImageBytes, maxImages: profile.maxImagesPerRequest,
      byteQuantum: Math.min(profile.maxInlineRequestImageBytes, 10 * 1024 * 1024), countQuantum: 20,
    }, block => versions.get(block.attachment.attachmentId)?.bytes ?? block.attachment.bytes);
    if (offloadImages) throw new LlmError('内联图片超过请求上限，需由 dsh 卸载最旧图片后重试', 'IMAGE_OFFLOAD_REQUIRED', { offloadImages });
  }
  const messages = hasImages ? imageCapable
    ? projectOffloadedImages(projected.messages, ref => offloadedImageText(ref, services.resolveImageAccess?.(ref)))
    : projectImagesForTextModel(projected.messages) : projected.messages;

  const partsFor = (blocks: readonly ContentBlock[]): WirePart[] => {
    const parts: WirePart[] = [];
    for (const block of blocks) {
      switch (block.type) {
        case 'text': if (block.text) parts.push({ type: 'text', text: block.text }); break;
        case 'image': {
          const version = versions.get(block.attachment.attachmentId);
          if (!version) throw new LlmError('未准备请求图片', 'INVALID_REQUEST');
          parts.push({ type: 'text', text: requestImageHandleText(block.attachment, version, services.resolveImageAccess?.(block.attachment)) });
          parts.push({ type: 'image_url', image_url: { url: `data:${version.mediaType};base64,${Buffer.from(version.data).toString('base64')}` } });
          break;
        }
        case 'file': {
          const host = services.attachments?.fileHostPath(block.attachment);
          parts.push({ type: 'text', text: fileHandleText(block.attachment, host ? services.resolveFilePath?.(host) : undefined) });
          break;
        }
        case 'reasoning': break;
        case 'tool-call': throw new LlmError('用户或工具结果中不能包含工具请求', 'UNSUPPORTED_CONTENT');
        default: throw new LlmError('第三方 DeepSeek 不支持该内容块', 'UNSUPPORTED_CONTENT');
      }
    }
    return parts;
  };
  const textOf = (parts: WirePart[]) => parts.filter((p): p is Extract<WirePart, { type: 'text' }> => p.type === 'text').map(p => p.text).join('');
  const contentOf = (parts: WirePart[]): string | WirePart[] => parts.some(p => p.type === 'image_url') ? parts : textOf(parts);
  const wire: WireMessage[] = [];
  if (options.system) wire.push({ role: 'system', content: options.system });
  let pendingImages: WirePart[] = [];
  const flush = () => {
    if (!pendingImages.length) return;
    wire.push({ role: 'user', content: [{ type: 'text', text: 'Attached image(s) from tool result:' }, ...pendingImages] });
    pendingImages = [];
  };
  for (const message of messages) {
    if (message.role === 'assistant') {
      flush();
      const calls = message.content.filter(b => b.type === 'tool-call');
      const reasoning = message.content.filter(b => b.type === 'reasoning').map(b => b.text).join('');
      if (message.content.some(b => !['text', 'reasoning', 'tool-call'].includes(b.type))) throw new LlmError('无法表示 assistant 历史内容', 'UNSUPPORTED_CONTENT');
      wire.push({
        role: 'assistant', content: message.content.filter(b => b.type === 'text').map(b => b.text).join(''),
        ...(reasoning ? { reasoning_content: reasoning } : {}),
        ...(calls.length ? { tool_calls: calls.map(b => ({ id: b.id, type: 'function' as const, function: { name: b.name, arguments: b.arguments } })) } : {}),
      });
    } else if (message.role === 'system') {
      flush();
      if (message.content.some(b => b.type !== 'text')) throw new LlmError('系统消息仅支持文本', 'UNSUPPORTED_CONTENT');
      const text = message.content.map(b => b.type === 'text' ? b.text : '').join('');
      if (text) wire.push({ role: 'system', content: text });
    } else if (message.role === 'tool') {
      const output = partsFor(message.content);
      wire.push({ role: 'tool', tool_call_id: message.toolCallId, content: textOf(output) || '(no output)' });
      pendingImages.push(...output.filter(p => p.type === 'image_url'));
    } else if (message.role === 'user') {
      flush(); wire.push({ role: 'user', content: contentOf(partsFor(message.content)) });
    } else {
      throw new LlmError('无法表示此开发者消息', 'UNSUPPORTED_CONTENT');
    }
  }
  flush();
  const tools = projected.tools?.map(tool => ({ name: tool.name, description: tool.description, parameters: tool.parameters }));
  const protocol: GatewayProtocol = profile.protocol ?? 'chat-completions';
  if (protocol === 'responses') return responseBody(wire, tools, options, model, effort);
  if (protocol === 'anthropic-messages') return anthropicBody(wire, tools, options, model, effort);
  return {
    model: options.model, messages: wire, stream: true, stream_options: { include_usage: true },
    thinking: { type: effort === 'off' ? 'disabled' : 'enabled' },
    ...(effort === 'off' ? {} : { reasoning_effort: effort }),
    max_tokens: options.maxTokens ?? model?.maxTokens ?? profile.maxTokens,
    ...(options.temperature === undefined && model?.defaultTemperature === undefined ? {} : { temperature: options.temperature ?? model?.defaultTemperature }),
    ...(options.stop === undefined ? {} : { stop: options.stop }),
    ...(tools?.length && model?.supportsTools !== false ? { tools: tools.map(tool => ({ type: 'function', function: tool })) } : {}),
  };
}

export function imagePolicy(model: GatewayModel, ref: ImageAttachmentRef): { width: number; height: number; maxBytes: number } {
  const pixels = model.imagePixelBudget === 'low' ? 512 * 512 : model.imagePixelBudget ?? 640000;
  const scale = Math.min(1, Math.sqrt(pixels / (ref.width * ref.height)), 4096 / Math.max(ref.width, ref.height));
  return { width: Math.max(1, Math.floor(ref.width * scale)), height: Math.max(1, Math.floor(ref.height * scale)), maxBytes: model.imageMaxBytes ?? 1024 * 1024 };
}
