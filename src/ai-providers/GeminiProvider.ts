import { GoogleGenerativeAI, GenerativeModel, GenerateContentResult } from '@google/generative-ai';
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
import { ProviderAuthError, ProviderError } from '../types/errors';

export class GeminiProvider extends BaseProvider {
    private readonly genAI: GoogleGenerativeAI;

    constructor(config: ProviderConfig) {
        super('gemini', ProviderType.Gemini, config);
        this.genAI = new GoogleGenerativeAI(config.apiKey);
    }

    async sendMessages(
        messages: readonly Message[],
        systemPrompt?: string
    ): Promise<ProviderResponse> {
        const startTime = Date.now();

        const system = systemPrompt ?? this.getRoleSystemPrompt(CompanyRole.QAEngineer);

        const model: GenerativeModel = this.genAI.getGenerativeModel({
            model: this.config.model,
            systemInstruction: system,
        });

        const geminiHistory = messages
            .filter((m) => m.role !== MessageRole.System)
            .slice(0, -1)
            .map((m) => ({
                role: m.role === MessageRole.User ? 'user' : 'model',
                parts: [{ text: m.content }],
            }));

        const lastMessage = messages.filter((m) => m.role !== MessageRole.System).at(-1);
        const userInput = lastMessage?.content ?? '';

        try {
            const chat = model.startChat({
                history: geminiHistory,
                generationConfig: {
                    maxOutputTokens: this.config.maxTokens,
                    temperature: this.config.temperature,
                },
            });

            const result: GenerateContentResult = await chat.sendMessage(userInput);
            const response = result.response;

            this.lastUsed = Date.now();
            this.lastError = undefined;

            return {
                content: response.text(),
                provider: this.name,
                model: this.config.model,
                tokensUsed: this.extractTokenUsage(response),
                durationMs: Date.now() - startTime,
                raw: response,
            };
        } catch (err: unknown) {
            this.lastError = err instanceof Error ? err.message : String(err);

            const errMsg = err instanceof Error ? err.message : String(err);
            if (errMsg.includes('API_KEY') || errMsg.includes('401') || errMsg.includes('403')) {
                throw new ProviderAuthError(this.name, errMsg);
            }
            throw new ProviderError(this.name, errMsg);
        }
    }

    getCapabilities(): ProviderCapabilities {
        return {
            supportsStreaming: true,
            supportsSystemMessages: true,
            maxContextTokens: 1000000,
            supportedRoles: [
                CompanyRole.QAEngineer,
                CompanyRole.SecurityAuditor,
                CompanyRole.DevOpsEngineer,
                CompanyRole.PerformanceEngineer,
            ],
        };
    }

    async healthCheck(): Promise<boolean> {
        try {
            const model = this.genAI.getGenerativeModel({ model: this.config.model });
            await model.generateContent('ping');
            return true;
        } catch {
            return false;
        }
    }

    protected extractTokenUsage(rawResponse: unknown): TokenUsage {
        const resp = rawResponse as { usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number } };
        return {
            promptTokens: resp.usageMetadata?.promptTokenCount ?? 0,
            completionTokens: resp.usageMetadata?.candidatesTokenCount ?? 0,
            totalTokens: resp.usageMetadata?.totalTokenCount ?? 0,
        };
    }
}
