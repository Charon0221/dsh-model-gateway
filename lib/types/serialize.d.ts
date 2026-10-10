import type { AttachmentStore, ImageAttachmentRef } from '@deepseek-ai/dsh-attachment';
import { type GenerateOptions, type ImageAttachmentAccessResolver } from '@deepseek-ai/dsh-llm';
import { type GatewayModel } from './shared.js';
import type { ResolvedProfile } from './config.js';
export type WirePart = {
    type: 'text';
    text: string;
} | {
    type: 'image_url';
    image_url: {
        url: string;
    };
};
export interface WireMessage {
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string | WirePart[];
    reasoning_content?: string;
    tool_call_id?: string;
    tool_calls?: {
        id: string;
        type: 'function';
        function: {
            name: string;
            arguments: string;
        };
    }[];
}
export interface SerializationServices {
    attachments?: AttachmentStore;
    resolveImageAccess?: ImageAttachmentAccessResolver;
    resolveFilePath?: (hostPath: string) => string | undefined;
}
export declare function serializeRequest(options: GenerateOptions, profile: ResolvedProfile, services?: SerializationServices): Promise<Record<string, unknown>>;
export declare function imagePolicy(model: GatewayModel, ref: ImageAttachmentRef): {
    width: number;
    height: number;
    maxBytes: number;
};
