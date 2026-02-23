import OpenAI from 'openai';
import { BaseProvider } from './BaseProvider';
import {
    ProviderType,
    CompanyRole,
    CustomProviderConfig,
    ProviderConfig,
    ProviderCapabilities,
    ProviderResponse,
    Message,
    MessageRole,
    TokenUsage,
} from '../types';
import { ProviderError } from '../types/errors';

/**
 * Generic provider for any OpenAI-compatible API.
 * Works with: Mistral, Cohere, Together AI, Ollama, LM Studio, vLLM, etc.
 * Any API that follows the OpenAI chat completions format.
 */
export class CustomProvider extends BaseProvider {
    private readonly client: OpenAI;

    constructor(customConfig: CustomProviderConfig) {
        const providerConfig: ProviderConfig = {
            apiKey: customConfig.apiKey,
            model: customConfig.model,
            maxTokens: customConfig.maxTokens,
            timeoutMs: 120000,
        };
        super(customConfig.name, ProviderType.Custom, providerConfig);

        this.client = new OpenAI({
            apiKey: customConfig.apiKey || 'not-needed',
            baseURL: customConfig.baseUrl,
        });
    }

    async sendMessages(
        messages: readonly Message[],
        systemPrompt?: string
    ): Promise<ProviderResponse> {
        const startTime = Date.now();

        const system = systemPrompt ?? 'You are a helpful AI assistant working as part of a development team.';

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
            throw new ProviderError(this.name, err instanceof Error ? err.message : String(err));
        }
    }

    getCapabilities(): ProviderCapabilities {
        return {
            supportsStreaming: true,
            supportsSystemMessages: true,
            maxContextTokens: 32000,
            supportedRoles: Object.values(CompanyRole),
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
