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
 * Competitive Strategy: All AIs independently solve the same problem,
 * then a judge (last provider) scores each response and picks the best.
 */
export class CompetitiveStrategy implements IStrategy {
    readonly name = 'competitive';

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
            throw new Error('No providers available for competitive strategy');
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

        // Competition phase: all providers work independently
        onEvent({
            type: 'strategy:phaseStarted',
            timestamp: Date.now(),
            data: { strategy: this.name, phase: 'competition' },
        });

        const settled = await Promise.allSettled(
            providerList.map((provider) =>
                provider.sendMessages(
                    [userMessage],
                    'Provide your absolute best response. Your answer will be judged against other AIs. Be thorough, accurate, and creative.'
                )
            )
        );

        const responses: ProviderResponse[] = [];
        for (let i = 0; i < settled.length; i++) {
            const result = settled[i];
            if (result.status === 'fulfilled') {
                responses.push(result.value);
            } else {
                onEvent({
                    type: 'provider:error',
                    timestamp: Date.now(),
                    data: { provider: providerList[i].name, error: result.reason?.message ?? 'Unknown error' },
                });
            }
        }

        if (responses.length === 0) {
            throw new Error('All providers failed in competitive execution');
        }

        onEvent({
            type: 'strategy:phaseCompleted',
            timestamp: Date.now(),
            data: { strategy: this.name, phase: 'competition', responseCount: responses.length },
        });

        // If only one response, it wins by default
        if (responses.length === 1) {
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
                finalOutput: responses[0].content,
                conversation,
                durationMs: Date.now() - startTime,
                tokenUsage: responses[0].tokensUsed,
            };
        }

        // Judging phase: last provider judges all responses
        onEvent({
            type: 'strategy:phaseStarted',
            timestamp: Date.now(),
            data: { strategy: this.name, phase: 'judging' },
        });

        const judge = providerList[providerList.length - 1];
        const judgingMessages: Message[] = [
            userMessage,
            ...responses.map((r, i) => ({
                id: uuidv4(),
                role: MessageRole.Assistant as const,
                content: `[Candidate ${i + 1} from ${r.provider}]:\n${r.content}`,
                timestamp: Date.now(),
                provider: r.provider,
            })),
            {
                id: uuidv4(),
                role: MessageRole.User,
                content: [
                    `Judge the ${responses.length} candidate responses above.`,
                    'Score each on: correctness (1-10), completeness (1-10), code quality (1-10), creativity (1-10).',
                    'Format: "WINNER: Candidate X" followed by your scoring breakdown.',
                    'Then output the winning response in full.',
                ].join('\n'),
                timestamp: Date.now(),
            },
        ];

        const judgingResponse = await judge.sendMessages(
            judgingMessages,
            'You are an impartial judge evaluating AI responses. Pick the best one based on quality, correctness, and completeness.'
        );
        responses.push(judgingResponse);

        // Parse winner or fall back to judge's full output
        const winnerIndex = this.parseWinner(judgingResponse.content, responses.length - 1);
        const finalOutput = winnerIndex !== null
            ? responses[winnerIndex].content
            : judgingResponse.content;

        messages.push(...judgingMessages);

        onEvent({
            type: 'strategy:phaseCompleted',
            timestamp: Date.now(),
            data: { strategy: this.name, phase: 'judging', winner: winnerIndex },
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
            finalOutput,
            conversation,
            durationMs: Date.now() - startTime,
            tokenUsage: this.sumTokens(responses),
        };
    }

    /** Parse "WINNER: Candidate X" from judge response */
    private parseWinner(judgingContent: string, maxCandidates: number): number | null {
        const match = judgingContent.match(/WINNER:\s*Candidate\s*(\d+)/i);
        if (match) {
            const index = parseInt(match[1], 10) - 1;
            if (index >= 0 && index < maxCandidates) {
                return index;
            }
        }
        return null;
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
