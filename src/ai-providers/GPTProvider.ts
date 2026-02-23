import OpenAI from 'openai';
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
    private readonly client: OpenAI;

    constructor(config: ProviderConfig) {
        super('gpt', ProviderType.GPT, config);
        this.client = new OpenAI({ apiKey: config.apiKey });
    }

    async sendMessages(
        messages: readonly Message[],
        systemPrompt?: string
    ): Promise<ProviderResponse> {
        const startTime = Date.now();

        const system = systemPrompt ?? this.getRoleSystemPrompt(CompanyRole.SeniorDeveloper);

        const openaiMessages: OpenAI.ChatCompletionMessageParam[] = [
            { role: 'system', content: system },
            ...messages
                .filter((m) => m.role !== MessageRole.System)
                .map((m) => ({
                    role: m.role === MessageRole.User ? ('user' as const) : ('assistant' as const),
                    content: m.content,
                })),
        ];

        try {
            const response = await this.client.chat.completions.create({
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

            if (err instanceof OpenAI.AuthenticationError) {
                throw new ProviderAuthError(this.name, err.message);
            }
            if (err instanceof OpenAI.RateLimitError) {
                throw new ProviderRateLimitError(this.name, err.message);
            }
            throw new ProviderError(this.name, err instanceof Error ? err.message : String(err));
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
            await this.client.chat.completions.create({
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
        const resp = rawResponse as OpenAI.ChatCompletion;
        return {
            promptTokens: resp.usage?.prompt_tokens ?? 0,
            completionTokens: resp.usage?.completion_tokens ?? 0,
            totalTokens: resp.usage?.total_tokens ?? 0,
        };
    }
}
