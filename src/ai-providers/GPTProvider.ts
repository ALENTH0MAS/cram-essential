import type OpenAI from 'openai';
import { BaseProvider } from './BaseProvider';
import {
    ProviderType,
    CompanyRole,
    ProviderConfig,
    ProviderCapabilities,
    ProviderResponse,
    Message,
    MessageRole,
    TokenUsage,
} from '../types';
import { ProviderAuthError, ProviderRateLimitError, ProviderError } from '../types/errors';

export class GPTProvider extends BaseProvider {
    private client: OpenAI | undefined;

    constructor(config: ProviderConfig) {
        super('gpt', ProviderType.GPT, config);
    }

    private async getClient(): Promise<OpenAI> {
        if (this.client) {
            return this.client;
        }
        const { default: OpenAISDK } = await import('openai');
        this.client = new OpenAISDK({ apiKey: this.config.apiKey });
        return this.client;
    }

    async sendMessages(
        messages: readonly Message[],
        systemPrompt?: string
    ): Promise<ProviderResponse> {
        const startTime = Date.now();
        const client = await this.getClient();

        const system = systemPrompt ?? this.getRoleSystemPrompt(CompanyRole.SeniorDeveloper);

        const openaiMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
            { role: 'system', content: system },
            ...messages
                .filter((m) => m.role !== MessageRole.System)
                .map((m) => ({
                    role: m.role === MessageRole.User ? ('user' as const) : ('assistant' as const),
                    content: m.content,
                })),
        ];

        try {
            const response = await client.chat.completions.create({
                model: this.config.model,
                max_tokens: this.config.maxTokens,
                messages: openaiMessages,
                temperature: this.config.temperature,
            });

            this.lastUsed = Date.now();
            this.lastError = undefined;

            const choice = response.choices[0];

            return {
                content: choice?.message?.content ?? '',
                provider: this.name,
                model: response.model,
                tokensUsed: this.extractTokenUsage(response),
                durationMs: Date.now() - startTime,
                raw: response,
            };
        } catch (err: unknown) {
            this.lastError = err instanceof Error ? err.message : String(err);

            const errObj = err as { status?: number };
            if (errObj.status === 401) {
                throw new ProviderAuthError(this.name, this.lastError);
            }
            if (errObj.status === 429) {
                throw new ProviderRateLimitError(this.name, this.lastError);
            }
            throw new ProviderError(this.name, this.lastError);
        }
    }

    getCapabilities(): ProviderCapabilities {
        return {
            supportsStreaming: true,
            supportsSystemMessages: true,
            maxContextTokens: 128000,
            supportedRoles: [
                CompanyRole.SeniorDeveloper,
                CompanyRole.FrontendDeveloper,
                CompanyRole.BackendDeveloper,
                CompanyRole.SEOSpecialist,
            ],
        };
    }

    async healthCheck(): Promise<boolean> {
        try {
            const client = await this.getClient();
            await client.chat.completions.create({
                model: this.config.model,
                max_tokens: 10,
                messages: [{ role: 'user', content: 'ping' }],
            });
            return true;
        } catch {
            return false;
        }
    }

    protected extractTokenUsage(rawResponse: unknown): TokenUsage {
        const resp = rawResponse as { usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } };
        return {
            promptTokens: resp.usage?.prompt_tokens ?? 0,
            completionTokens: resp.usage?.completion_tokens ?? 0,
            totalTokens: resp.usage?.total_tokens ?? 0,
        };
    }
}
