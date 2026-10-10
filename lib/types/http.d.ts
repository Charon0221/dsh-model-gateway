import { LlmError } from '@deepseek-ai/dsh-llm';
export declare function errorCode(status: number, detail: string): string;
export declare function requestHeaders(key: string, extra?: Record<string, string>, sessionId?: string): Record<string, string>;
export declare function redactDiagnostic(message: string, secrets: readonly string[]): string;
export declare function httpFailure(response: Response, secrets?: readonly string[]): Promise<LlmError>;
export declare function cancellable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T>;
/** A watchdog spans connection setup, image reads, headers and SSE reads. */
export declare function idleControl(caller: AbortSignal | undefined, ms: number): {
    signal: AbortSignal;
    pulse: () => void;
    classify(error: unknown): LlmError;
    dispose(): void;
};
