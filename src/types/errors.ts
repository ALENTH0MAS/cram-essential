/** Custom error hierarchy for CRAM ESSENTIAL */

export class ProviderError extends Error {
    constructor(
        public readonly provider: string,
        message: string
    ) {
        super(`[${provider}] ${message}`);
        this.name = 'ProviderError';
    }
}

export class ProviderAuthError extends ProviderError {
    constructor(provider: string, message: string) {
        super(provider, `Authentication failed: ${message}`);
        this.name = 'ProviderAuthError';
    }
}

export class ProviderRateLimitError extends ProviderError {
    public readonly retryAfterMs: number;

    constructor(provider: string, message: string, retryAfterMs: number = 30000) {
        super(provider, `Rate limited: ${message}`);
        this.name = 'ProviderRateLimitError';
        this.retryAfterMs = retryAfterMs;
    }
}

export class ProviderTimeoutError extends ProviderError {
    constructor(provider: string, timeoutMs: number) {
        super(provider, `Request timed out after ${timeoutMs}ms`);
        this.name = 'ProviderTimeoutError';
    }
}

export class OrchestrationError extends Error {
    constructor(
        public readonly strategy: string,
        message: string
    ) {
        super(`[Orchestration:${strategy}] ${message}`);
        this.name = 'OrchestrationError';
    }
}

export class MeetingError extends Error {
    constructor(
        public readonly meetingId: string,
        message: string
    ) {
        super(`[Meeting:${meetingId}] ${message}`);
        this.name = 'MeetingError';
    }
}

export class PipelineError extends Error {
    constructor(
        public readonly stage: string,
        message: string
    ) {
        super(`[Pipeline:${stage}] ${message}`);
        this.name = 'PipelineError';
    }
}
