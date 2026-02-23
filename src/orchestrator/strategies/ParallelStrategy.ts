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
 * Parallel Strategy: All AIs work independently on the same prompt,
 * then one AI synthesizes all responses into a unified output.
 * Uses Promise.allSettled for resilience — partial results are fine.
 */
export class ParallelStrategy implements IStrategy {
    readonly name = 'parallel';

    async execute(
        request: OrchestrationRequest,
        providers: ReadonlyMap<string, BaseProvider>,
        _config: StrategyConfig,
        onEvent: (event: OrchestratorEvent) => void
    ): Promise<OrchestrationResult> {
        const startTime = Date.now();
        const resultId = uuidv4();
        const providerList = Array.from(providers.values());
        const messages: Message[] = [];

        if (providerList.length === 0) {
            throw new Error('No providers available for parallel strategy');
        }

        const userMessage: Message = {
            id: uuidv4(),
            role: MessageRole.User,
            content: request.context
                ? `${request.prompt}\n\nContext:\n${request.context}`
                : request.prompt,
            timestamp: Date.now(),
        };
        messages.push(userMessage);

        // Fire all providers in parallel
        onEvent({
            type: 'strategy:phaseStarted',
            timestamp: Date.now(),
            data: { strategy: this.name, phase: 'parallel-execution', providerCount: providerList.length },
        });

        const settled = await Promise.allSettled(
            providerList.map((provider) =>
                provider.sendMessages(
                    [userMessage],
                    `Provide your best independent response. You are one of ${providerList.length} AIs working in parallel.`
                )
            )
        );

        // Collect successful responses
        const responses: ProviderResponse[] = [];
        for (let i = 0; i < settled.length; i++) {
            const result = settled[i];
            if (result.status === 'fulfilled') {
                responses.push(result.value);
                onEvent({
                    type: 'provider:response',
                    timestamp: Date.now(),
                    data: { provider: providerList[i].name, status: 'success' },
                });
            } else {
                onEvent({
                    type: 'provider:error',
                    timestamp: Date.now(),
                    data: { provider: providerList[i].name, error: result.reason?.message ?? 'Unknown error' },
                });
            }
        }

        if (responses.length === 0) {
            throw new Error('All providers failed in parallel execution');
        }

        onEvent({
            type: 'strategy:phaseCompleted',
            timestamp: Date.now(),
            data: { strategy: this.name, phase: 'parallel-execution', successCount: responses.length },
        });

        // Merge phase: first provider synthesizes all responses
        onEvent({
            type: 'strategy:phaseStarted',
            timestamp: Date.now(),
            data: { strategy: this.name, phase: 'merge' },
        });

        const mergeMessages: Message[] = [
            userMessage,
            ...responses.map((r, i) => ({
                id: uuidv4(),
                role: MessageRole.Assistant as const,
                content: `[Response ${i + 1} from ${r.provider}]:\n${r.content}`,
                timestamp: Date.now(),
                provider: r.provider,
            })),
            {
                id: uuidv4(),
                role: MessageRole.User,
                content: [
                    `${responses.length} AIs independently responded above.`,
                    'Synthesize the best elements from all responses into a single, unified, comprehensive answer.',
                    'Combine unique insights from each. Resolve any conflicts by choosing the strongest approach.',
                ].join(' '),
                timestamp: Date.now(),
            },
        ];

        const synthesizer = providerList[0];
        const mergedResponse = await synthesizer.sendMessages(
            mergeMessages,
            'You are synthesizing multiple independent AI responses into one unified answer. Take the best from each.'
        );
        responses.push(mergedResponse);

        messages.push(...mergeMessages);

        onEvent({
            type: 'strategy:phaseCompleted',
            timestamp: Date.now(),
            data: { strategy: this.name, phase: 'merge' },
        });

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
            finalOutput: mergedResponse.content,
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
