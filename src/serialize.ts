import type { AttachmentStore, ImageAttachmentRef, RequestImageAttachment } from '@deepseek-ai/dsh-attachment';
import {
  LlmError, contentHasImage, offloadRequestImagesWithPolicy, offloadedImageText,
  requestImageHandleText, fileHandleText,
  type ContentBlock, type GenerateOptions, type ImageAttachmentAccessResolver,
} from '@deepseek-ai/dsh-llm';
import { EFFORTS, type GatewayModel } from './shared.js';
import type { ResolvedProfile } from './config.js';

export type WirePart = { type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } };
export interface WireMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | WirePart[];
  reasoning_content?: string;
  tool_call_id?: string;
  tool_calls?: { id: string; type: 'function'; function: { name: string; arguments: string } }[];
}
export interface SerializationServices {
  attachments?: AttachmentStore;
  resolveImageAccess?: ImageAttachmentAccessResolver;
  resolveFilePath?: (hostPath: string) => string | undefined;
}

export async function serializeRequest(options: GenerateOptions, profile: ResolvedProfile, services: SerializationServices = {}): Promise<Record<string, unknown>> {
  const model = profile.models.find(m => m.id === options.model);
  const effort = options.purpose === 'session-title' ? 'off' : options.reasoningEffort ?? profile.reasoningEffort;
  if (!EFFORTS.includes(effort as typeof EFFORTS[number])) throw new LlmError('不支持的 DeepSeek 推理强度', 'UNSUPPORTED_REASONING_EFFORT');
  const imageCapable = model?.inputModalities?.includes('image') === true;
  const hasImages = options.messages.some(m => contentHasImage(m.content));
  for (const message of options.messages) {
    if (message.role !== 'user' && contentHasImage(message.content)) throw new LlmError(`无法发送 ${message.role} 消息中的图片`, 'UNSUPPORTED_CONTENT');
  }
  // History may contain images from a previously selected vision model. Preserve a
  // handle on a text route; the dsh upload gate rejects new unsupported images.
  const versions = new Map<string, RequestImageAttachment>();
  if (imageCapable && hasImages) {
    if (!services.attachments) throw new LlmError('图片输入需要 dsh 附件服务', 'UNSUPPORTED_CONTENT');
    const refs: ImageAttachmentRef[] = [];
    const collect = (blocks: readonly ContentBlock[]) => {
      for (const block of blocks) {
        if (block.type === 'image') refs.push(block.attachment);
        if (block.type === 'tool-result') collect(block.content);
      }
    };
    options.messages.forEach(m => collect(m.content));
    const policy = imagePolicy(model!);
    for (const ref of refs) {
      options.signal?.throwIfAborted();
      if (!versions.has(ref.attachmentId)) versions.set(ref.attachmentId, await services.attachments.readImageRequest(ref, policy, options.signal));
    }
  }
  const messages = hasImages ? offloadRequestImagesWithPolicy(options.messages, {
    representation: 'base64', maxBytes: imageCapable ? profile.maxInlineRequestImageBytes : 0,
    maxImages: imageCapable ? profile.maxImagesPerRequest : 0,
    byteQuantum: Math.min(profile.maxInlineRequestImageBytes, 10 * 1024 * 1024), countQuantum: 20,
    byteLength: ref => versions.get(ref.attachmentId)?.bytes ?? ref.bytes,
    placeholder: ref => offloadedImageText(ref, services.resolveImageAccess?.(ref)),
  }) : options.messages;

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
        case 'tool-result': parts.push(...partsFor(block.content)); break;
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
    } else {
      const results = message.content.filter(b => b.type === 'tool-result');
      const parts = partsFor(message.content.filter(b => b.type !== 'tool-result'));
      if (parts.length || !results.length) { flush(); wire.push({ role: 'user', content: contentOf(parts) }); }
      for (const result of results) {
        const output = partsFor(result.content);
        wire.push({ role: 'tool', tool_call_id: result.toolCallId, content: textOf(output) || '(no output)' });
        pendingImages.push(...output.filter(p => p.type === 'image_url'));
      }
    }
  }
  flush();
  return {
    model: options.model, messages: wire, stream: true, stream_options: { include_usage: true },
    thinking: { type: effort === 'off' ? 'disabled' : 'enabled' },
    ...(effort === 'off' ? {} : { reasoning_effort: effort }),
    max_tokens: options.maxTokens ?? model?.maxTokens ?? profile.maxTokens,
    ...(options.temperature === undefined ? {} : { temperature: options.temperature }),
    ...(options.stop === undefined ? {} : { stop: options.stop }),
    ...(options.tools?.length ? { tools: options.tools.map(tool => ({ type: 'function', function: { name: tool.name, description: tool.description, parameters: tool.parameters } })) } : {}),
  };
}

export function imagePolicy(model: GatewayModel): { maxPixels: number; maxBytes: number } {
  return { maxPixels: model.imagePixelBudget === 'low' ? 512 * 512 : model.imagePixelBudget ?? 640000, maxBytes: model.imageMaxBytes ?? 1024 * 1024 };
}
