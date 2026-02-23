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
 * Collaborative Strategy: AIs discuss iteratively.
 * Round 1: First AI (Architect) designs the approach
 * Round 2: Second AI (Developer) implements based on the design
 * Round 3: Third AI (Reviewer) reviews and provides feedback
 * Round 4+: Developer refines based on feedback. Repeats until maxRounds or consensus.
 * Final: Architect synthesizes everything into a unified output.
 */
export class CollaborativeStrategy implements IStrategy {
    readonly name = 'collaborative';

    async execute(
        request: OrchestrationRequest,
        providers: ReadonlyMap<string, BaseProvider>,
        config: StrategyConfig,
        onEvent: (event: OrchestratorEvent) => void
    ): Promise<OrchestrationResult> {
        const startTime = Date.now();
        const resultId = uuidv4();
        const providerList = Array.from(providers.values());
        const responses: ProviderResponse[] = [];
        const messages: Message[] = [];

        if (providerList.length === 0) {
            throw new Error('No providers available for collaborative strategy');
        }

        // User prompt
        messages.push({
            id: uuidv4(),
            role: MessageRole.User,
            content: request.context
                ? `${request.prompt}\n\nContext:\n${request.context}`
                : request.prompt,
            timestamp: Date.now(),
        });

        const [architect, developer, reviewer] = this.assignRoles(providerList);

        for (let round = 0; round < config.maxRounds; round++) {
            onEvent({
                type: 'strategy:phaseStarted',
                timestamp: Date.now(),
                data: { strategy: this.name, round, phase: round === 0 ? 'design' : 'refine' },
            });

            // Architect designs (first round) or synthesizes (later rounds)
            if (round === 0) {
                const archResponse = await architect.sendMessages(
                    messages,
                    'You are the architect. Design the solution architecture, data structures, and approach. Be thorough and specific.'
                );
                responses.push(archResponse);
                messages.push(this.toMessage(archResponse, 'Architect'));
            }

            // Developer implements
            const devResponse = await developer.sendMessages(
                messages,
                round === 0
                    ? 'You are the developer. Implement the solution based on the architecture above. Write complete, production-ready code.'
                    : 'You are the developer. Refine your implementation based on the review feedback above. Fix all issues mentioned.'
            );
            responses.push(devResponse);
            messages.push(this.toMessage(devResponse, 'Developer'));

            // Reviewer reviews
            const reviewResponse = await reviewer.sendMessages(
                messages,
                'You are the code reviewer. Review the implementation for: bugs, security issues, performance problems, and best practices. Be specific about what needs to change.'
            );
            responses.push(reviewResponse);
            messages.push(this.toMessage(reviewResponse, 'Reviewer'));

            onEvent({
                type: 'strategy:phaseCompleted',
                timestamp: Date.now(),
                data: { strategy: this.name, round },
            });

            // Check if reviewer is satisfied (simple heuristic)
            if (this.isConsensusReached(reviewResponse.content)) {
                break;
            }
        }

        // Final synthesis by architect
        messages.push({
            id: uuidv4(),
            role: MessageRole.User,
            content: 'Synthesize all the discussion into a final, complete deliverable. Include the final architecture and code.',
            timestamp: Date.now(),
        });

        const finalResponse = await architect.sendMessages(
            messages,
            'Produce the final unified output combining the architecture, implementation, and review feedback. Include all final code.'
        );
        responses.push(finalResponse);

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

    private assignRoles(providers: BaseProvider[]): [BaseProvider, BaseProvider, BaseProvider] {
        // If we have 3+ providers, assign different ones
        if (providers.length >= 3) {
            return [providers[0], providers[1], providers[2]];
        }
        if (providers.length === 2) {
            return [providers[0], providers[1], providers[0]];
        }
        // Single provider plays all roles
        return [providers[0], providers[0], providers[0]];
    }

    private isConsensusReached(reviewContent: string): boolean {
        const lowerContent = reviewContent.toLowerCase();
        const positiveSignals = ['looks good', 'approved', 'no issues', 'well implemented', 'ship it', 'lgtm'];
        return positiveSignals.some((signal) => lowerContent.includes(signal));
    }

    private toMessage(response: ProviderResponse, label: string): Message {
        return {
            id: uuidv4(),
            role: MessageRole.Assistant,
            content: `[${label} - ${response.provider}]: ${response.content}`,
            timestamp: Date.now(),
            provider: response.provider,
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
