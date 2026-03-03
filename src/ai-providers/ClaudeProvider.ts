import type Anthropic from '@anthropic-ai/sdk';
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

export class ClaudeProvider extends BaseProvider {
    private client: Anthropic | undefined;

    constructor(config: ProviderConfig) {
        super('claude', ProviderType.Claude, config);
    }

    private async getClient(): Promise<Anthropic> {
        if (this.client) {
            return this.client;
        }
        const { default: AnthropicSDK } = await import('@anthropic-ai/sdk');
        this.client = new AnthropicSDK({ apiKey: this.config.apiKey });
        return this.client;
    }

    async sendMessages(
        messages: readonly Message[],
        systemPrompt?: string
    ): Promise<ProviderResponse> {
        const startTime = Date.now();
        const client = await this.getClient();

        const anthropicMessages = messages
            .filter((m) => m.role !== MessageRole.System)
            .map((m) => ({
                role: m.role === MessageRole.User ? ('user' as const) : ('assistant' as const),
                content: m.content,
            }));

        const system = systemPrompt ?? this.getRoleSystemPrompt(CompanyRole.LeadArchitect);

        try {
            const response = await client.messages.create({
                model: this.config.model,
                max_tokens: this.config.maxTokens,
                system,
                messages: anthropicMessages,
                temperature: this.config.temperature,
            });

            this.lastUsed = Date.now();
            this.lastError = undefined;

            const textBlock = response.content.find((b) => b.type === 'text');

            return {
                content: textBlock?.text ?? '',
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
            maxContextTokens: 200000,
            supportedRoles: [
                CompanyRole.CEO,
                CompanyRole.CTO,
                CompanyRole.LeadArchitect,
                CompanyRole.SEOSpecialist,
                CompanyRole.MarketingStrategist,
            ],
        };
    }

    async healthCheck(): Promise<boolean> {
        try {
            const client = await this.getClient();
            await client.messages.create({
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
        const resp = rawResponse as { usage: { input_tokens: number; output_tokens: number } };
        return {
            promptTokens: resp.usage.input_tokens,
            completionTokens: resp.usage.output_tokens,
            totalTokens: resp.usage.input_tokens + resp.usage.output_tokens,
        };
    }
}
