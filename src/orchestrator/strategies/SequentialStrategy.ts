import { v4 as uuidv4 } from 'uuid';
import { IStrategy } from './IStrategy';
import { BaseProvider } from '../../ai-providers/BaseProvider';
import {
    OrchestrationRequest,
    OrchestrationResult,
    StrategyConfig,
    OrchestratorEvent,
    ProviderResponse,
    Message,
    MessageRole,
    Conversation,
    TokenUsage,
} from '../../types';

/**
 * Sequential Strategy: Pipeline execution.
 * Each AI receives the prompt plus all previous AIs' outputs.
 * Order: Provider A → Provider B → Provider C
 * The final provider's output is the result.
 */
export class SequentialStrategy implements IStrategy {
    readonly name = 'sequential';

    async execute(
        request: OrchestrationRequest,
        providers: ReadonlyMap<string, BaseProvider>,
        _config: StrategyConfig,
        onEvent: (event: OrchestratorEvent) => void
    ): Promise<OrchestrationResult> {
        const startTime = Date.now();
        const resultId = uuidv4();
        const providerList = Array.from(providers.values());
        const responses: ProviderResponse[] = [];
        const messages: Message[] = [];

        if (providerList.length === 0) {
            throw new Error('No providers available for sequential strategy');
        }

        messages.push({
            id: uuidv4(),
            role: MessageRole.User,
            content: request.context
                ? `${request.prompt}\n\nContext:\n${request.context}`
                : request.prompt,
            timestamp: Date.now(),
        });

        for (let i = 0; i < providerList.length; i++) {
            const provider = providerList[i];
            const position = i === 0 ? 'first' : i === providerList.length - 1 ? 'final' : 'middle';

            onEvent({
                type: 'provider:request',
                timestamp: Date.now(),
                data: { provider: provider.name, position, index: i },
            });

            const systemPrompt = position === 'first'
                ? 'You are the first in a sequential pipeline. Analyze the request and provide your best response. Others will build on your work.'
                : position === 'final'
                    ? 'You are the final step in a sequential pipeline. Review everything above and produce the definitive final output.'
                    : 'You are in the middle of a sequential pipeline. Build on what came before and improve/expand the response.';

            const response = await provider.sendMessages(messages, systemPrompt);
            responses.push(response);

            messages.push({
                id: uuidv4(),
                role: MessageRole.Assistant,
                content: `[Step ${i + 1} - ${provider.name}]: ${response.content}`,
                timestamp: Date.now(),
                provider: provider.name,
            });

            onEvent({
                type: 'provider:response',
                timestamp: Date.now(),
                data: { provider: provider.name, position },
            });
        }

        const finalResponse = responses[responses.length - 1];

        const conversation: Conversation = {
            id: uuidv4(),
            sessionId: resultId,
            messages,
            createdAt: startTime,
            updatedAt: Date.now(),
        };

        return {
            id: resultId,
            strategy: request.strategy,
            responses,
            finalOutput: finalResponse.content,
            conversation,
            durationMs: Date.now() - startTime,
            tokenUsage: this.sumTokens(responses),
        };
    }

    private sumTokens(responses: readonly ProviderResponse[]): TokenUsage {
        return responses.reduce(
            (acc, r) => ({
                promptTokens: acc.promptTokens + r.tokensUsed.promptTokens,
                completionTokens: acc.completionTokens + r.tokensUsed.completionTokens,
                totalTokens: acc.totalTokens + r.tokensUsed.totalTokens,
            }),
            { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
        );
    }
}
