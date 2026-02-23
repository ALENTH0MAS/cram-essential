import * as vscode from 'vscode';
import { v4 as uuidv4 } from 'uuid';
import {
    CompanyRole,
    MeetingAgenda,
    MeetingResult,
    MeetingTurn,
    Message,
    MessageRole,
    TokenUsage,
    OrchestratorEvent,
} from '../types';
import { BaseProvider } from '../ai-providers/BaseProvider';
import { ProviderRegistry } from '../ai-providers/ProviderRegistry';
import { RoleManager } from './RoleManager';
import { DecisionTracker } from './DecisionTracker';
import { Logger } from '../utils/logger';
import { MeetingError } from '../types/errors';

/**
 * The MeetingRoom conducts multi-turn AI conversations.
 * AIs talk to each other in character, @mention colleagues, debate, and make decisions.
 */
export class MeetingRoom {
    private readonly logger = Logger.getInstance();
    private readonly decisionTracker = new DecisionTracker();

    private readonly _onEvent = new vscode.EventEmitter<OrchestratorEvent>();
    public readonly onEvent: vscode.Event<OrchestratorEvent> = this._onEvent.event;

    constructor(
        private readonly roleManager: RoleManager,
        private readonly registry: ProviderRegistry
    ) {}

    /**
     * Run a complete meeting with multi-turn AI conversation.
     * AIs speak in turn order, responding to the conversation so far,
     * mentioning other roles, and building on previous turns.
     */
    async runMeeting(agenda: MeetingAgenda): Promise<MeetingResult> {
        const meetingId = uuidv4();
        const startTime = Date.now();
        const turns: MeetingTurn[] = [];
        const conversationHistory: Message[] = [];
        let totalTokens: TokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

        this.logger.info(`Meeting started: "${agenda.title}" (${agenda.type})`, {
            participants: agenda.participants.join(', '),
            leader: agenda.leader,
        });

        this.emitEvent('meeting:started', { meetingId, agenda });

        try {
            // Build the meeting context message
            const meetingContext = this.buildMeetingContext(agenda);
            conversationHistory.push({
                id: uuidv4(),
                role: MessageRole.User,
                content: meetingContext,
                timestamp: Date.now(),
            });

            // Leader speaks first
            const leaderTurn = await this.executeRoleTurn(
                meetingId,
                agenda.leader,
                conversationHistory,
                agenda,
                1
            );
            turns.push(leaderTurn);
            totalTokens = this.addTokens(totalTokens, leaderTurn.tokensUsed);
            this.appendTurnToHistory(conversationHistory, leaderTurn);
            this.emitEvent('meeting:turn', { meetingId, turn: leaderTurn });

            // Remaining participants take turns
            let turnNumber = 2;
            const otherParticipants = agenda.participants.filter((r) => r !== agenda.leader);

            for (let round = 0; round < Math.ceil(agenda.maxTurns / agenda.participants.length); round++) {
                for (const role of otherParticipants) {
                    if (turnNumber > agenda.maxTurns) {
                        break;
                    }

                    const turn = await this.executeRoleTurn(
                        meetingId,
                        role,
                        conversationHistory,
                        agenda,
                        turnNumber
                    );
                    turns.push(turn);
                    totalTokens = this.addTokens(totalTokens, turn.tokensUsed);
                    this.appendTurnToHistory(conversationHistory, turn);
                    this.emitEvent('meeting:turn', { meetingId, turn });
                    turnNumber++;
                }

                // Leader responds after each round
                if (turnNumber <= agenda.maxTurns) {
                    const leaderReply = await this.executeRoleTurn(
                        meetingId,
                        agenda.leader,
                        conversationHistory,
                        agenda,
                        turnNumber
                    );
                    turns.push(leaderReply);
                    totalTokens = this.addTokens(totalTokens, leaderReply.tokensUsed);
                    this.appendTurnToHistory(conversationHistory, leaderReply);
                    this.emitEvent('meeting:turn', { meetingId, turn: leaderReply });
                    turnNumber++;
                }
            }

            // Extract decisions from the conversation
            const decisions = this.decisionTracker.extractDecisions(meetingId, turns, agenda);

            // Generate meeting summary using the leader
            const summary = await this.generateSummary(agenda.leader, conversationHistory, agenda);

            // Extract code artifacts from implementation turns
            const artifacts = this.extractArtifacts(turns);

            const result: MeetingResult = {
                id: meetingId,
                agenda,
                turns,
                decisions,
                summary,
                artifacts,
                durationMs: Date.now() - startTime,
                totalTokenUsage: totalTokens,
            };

            this.emitEvent('meeting:completed', { meetingId, result });
            this.logger.info(`Meeting completed: "${agenda.title}" (${turns.length} turns, ${decisions.length} decisions)`);

            return result;
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            this.logger.error(`Meeting failed: "${agenda.title}"`, err instanceof Error ? err : undefined);
            throw new MeetingError(meetingId, message);
        }
    }

    /** Execute a single role's turn in the meeting */
    private async executeRoleTurn(
        _meetingId: string,
        role: CompanyRole,
        conversationHistory: readonly Message[],
        agenda: MeetingAgenda,
        turnNumber: number
    ): Promise<MeetingTurn> {
        const providerName = this.roleManager.getProviderForRole(role);
        const provider = this.registry.getOrThrow(providerName);

        const roleDef = this.roleManager.getRoleDefinition(role);
        const systemPrompt = this.buildRolePrompt(provider, role, agenda, turnNumber);

        this.logger.debug(`Turn ${turnNumber}: ${roleDef.title} (${providerName}) speaking...`);

        const response = await provider.sendMessages(conversationHistory, systemPrompt);

        const mentionedRoles = this.parseMentions(response.content);

        return {
            turnNumber,
            role,
            providerName,
            message: response.content,
            mentionedRoles,
            timestamp: Date.now(),
            tokensUsed: response.tokensUsed,
        };
    }

    /** Build the system prompt for a specific role in a meeting context */
    private buildRolePrompt(
        provider: BaseProvider,
        role: CompanyRole,
        agenda: MeetingAgenda,
        turnNumber: number
    ): string {
        const rolePrompt = provider.getRoleSystemPrompt(role);
        const roleDef = this.roleManager.getRoleDefinition(role);

        const participantNames = agenda.participants
            .map((r) => {
                const def = this.roleManager.getRoleDefinition(r);
                return `@${def.title} (${r})`;
            })
            .join(', ');

        return [
            rolePrompt,
            '',
            `MEETING CONTEXT:`,
            `You are in a ${agenda.type} meeting titled "${agenda.title}".`,
            `Your role: ${roleDef.title}`,
            `Participants: ${participantNames}`,
            `Turn: ${turnNumber} of ${agenda.maxTurns}`,
            '',
            'INSTRUCTIONS:',
            '- Speak in character as your role with expertise and authority.',
            '- You can @mention other roles to ask questions or request input (e.g., "@QA Engineer, what about...").',
            '- Build on what others have said. Agree, disagree, or add new perspectives.',
            '- If you have a decision to propose, clearly state it as: "DECISION: [description]".',
            '- Be concise but thorough. Focus on your area of expertise.',
            '- If discussing algorithms or technology choices, explain trade-offs.',
            turnNumber === 1
                ? '- You are opening the meeting. Set the context and ask for input from the team.'
                : '- Respond to what has been discussed so far. Add your perspective.',
        ].join('\n');
    }

    /** Build the initial meeting context message */
    private buildMeetingContext(agenda: MeetingAgenda): string {
        const lines = [
            `# ${agenda.type.replace(/_/g, ' ').toUpperCase()} MEETING: ${agenda.title}`,
            '',
            `## Description`,
            agenda.description,
            '',
        ];

        if (agenda.context) {
            lines.push('## Additional Context', agenda.context, '');
        }

        lines.push(
            '## Objectives',
            '- Discuss the topic thoroughly from all perspectives',
            '- Make concrete decisions with clear rationale',
            '- Identify action items and next steps',
            '- Address concerns raised by any team member',
            '',
            'Please begin the meeting discussion.'
        );

        return lines.join('\n');
    }

    /** Generate a meeting summary using the leader role's provider */
    private async generateSummary(
        leaderRole: CompanyRole,
        conversationHistory: readonly Message[],
        agenda: MeetingAgenda
    ): Promise<string> {
        const providerName = this.roleManager.getProviderForRole(leaderRole);
        const provider = this.registry.getOrThrow(providerName);

        const summaryRequest: Message[] = [
            ...conversationHistory,
            {
                id: uuidv4(),
                role: MessageRole.User,
                content: [
                    'Please summarize this meeting concisely:',
                    '1. Key decisions made (with rationale)',
                    '2. Action items and who is responsible',
                    '3. Open questions or concerns',
                    '4. Next steps',
                    'Format as a clear, structured markdown document.',
                ].join('\n'),
                timestamp: Date.now(),
            },
        ];

        const response = await provider.sendMessages(
            summaryRequest,
            `You are a meeting facilitator summarizing the ${agenda.type} meeting titled "${agenda.title}". Be concise and focus on actionable outcomes.`
        );

        return response.content;
    }

    /** Parse @mentions from a message to identify which roles were addressed */
    private parseMentions(content: string): CompanyRole[] {
        const mentions: CompanyRole[] = [];
        const roleValues = Object.values(CompanyRole);

        for (const role of roleValues) {
            // Match @RoleName or @role_name patterns
            const patterns = [
                new RegExp(`@${role}\\b`, 'i'),
                new RegExp(`@${role.replace(/_/g, ' ')}`, 'i'),
            ];
            const roleDef = this.roleManager.getRoleDefinition(role);
            patterns.push(new RegExp(`@${roleDef.title}`, 'i'));

            if (patterns.some((p) => p.test(content))) {
                mentions.push(role);
            }
        }

        return mentions;
    }

    /** Extract code blocks and artifacts from meeting turns */
    private extractArtifacts(turns: readonly MeetingTurn[]): string[] {
        const artifacts: string[] = [];
        const codeBlockRegex = /```[\s\S]*?```/g;

        for (const turn of turns) {
            const matches = turn.message.match(codeBlockRegex);
            if (matches) {
                artifacts.push(...matches);
            }
        }

        return artifacts;
    }

    /** Append a meeting turn as a conversation message */
    private appendTurnToHistory(history: Message[], turn: MeetingTurn): void {
        const roleDef = this.roleManager.getRoleDefinition(turn.role);
        history.push({
            id: uuidv4(),
            role: MessageRole.Assistant,
            content: `[${roleDef.title} - ${turn.providerName}]: ${turn.message}`,
            timestamp: turn.timestamp,
            provider: turn.providerName,
            companyRole: turn.role,
        });
    }

    /** Add two TokenUsage objects together */
    private addTokens(a: TokenUsage, b: TokenUsage): TokenUsage {
        return {
            promptTokens: a.promptTokens + b.promptTokens,
            completionTokens: a.completionTokens + b.completionTokens,
            totalTokens: a.totalTokens + b.totalTokens,
        };
    }

    private emitEvent(type: OrchestratorEvent['type'], data: Record<string, unknown>): void {
        this._onEvent.fire({ type, timestamp: Date.now(), data });
    }

    dispose(): void {
        this._onEvent.dispose();
    }
}
