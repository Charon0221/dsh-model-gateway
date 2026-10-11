import { type StreamChunk, type TokenUsage } from '@deepseek-ai/dsh-llm';
/** Decode SSE across arbitrary byte/UTF-8 boundaries; never collect a whole response. */
export declare function ssePayloads(body: ReadableStream<Uint8Array>, activity: () => void): AsyncGenerator<string>;
type JsonObject = Record<string, unknown>;
export declare function mapUsage(raw: JsonObject): TokenUsage | undefined;
export declare function translate(payloads: AsyncIterable<string>, secrets?: readonly string[]): AsyncGenerator<StreamChunk>;
/** Translate OpenAI Responses SSE events into the dsh-neutral stream. */
export declare function translateResponses(payloads: AsyncIterable<string>, secrets?: readonly string[]): AsyncGenerator<StreamChunk>;
/** Translate Anthropic Messages SSE events into the dsh-neutral stream. */
export declare function translateAnthropic(payloads: AsyncIterable<string>, secrets?: readonly string[]): AsyncGenerator<StreamChunk>;
export {};
