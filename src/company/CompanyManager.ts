import * as vscode from 'vscode';
import { v4 as uuidv4 } from 'uuid';
import {
    SDLCStage,
    MeetingAgenda,
    MeetingResult,
    StageResult,
    PipelineResult,
    GeneratedFile,
    CompanyRole,
    CompanyTeam,
    Decision,
    TokenUsage,
    OrchestratorEvent,
    ExtensionConfig,
} from '../types';
import { ProviderRegistry } from '../ai-providers/ProviderRegistry';
import { RoleManager } from './RoleManager';
import { MeetingRoom } from './MeetingRoom';
import { DecisionTracker } from './DecisionTracker';
import { Logger } from '../utils/logger';
import { PipelineError } from '../types/errors';

/**
 * The CompanyManager is the "CEO of AIs" — it orchestrates the full SDLC pipeline
 * by running meetings at each stage, collecting decisions, and tracking outputs.
 */
export class CompanyManager implements vscode.Disposable {
    private readonly roleManager: RoleManager;
    private readonly meetingRoom: MeetingRoom;
    private readonly decisionTracker: DecisionTracker;
    private readonly logger = Logger.getInstance();

    private readonly _onEvent = new vscode.EventEmitter<OrchestratorEvent>();
    public readonly onEvent: vscode.Event<OrchestratorEvent> = this._onEvent.event;

    constructor(
        private readonly config: ExtensionConfig,
        private readonly registry: ProviderRegistry
    ) {
        this.roleManager = new RoleManager();
        this.meetingRoom = new MeetingRoom(this.roleManager, this.registry);
        this.decisionTracker = new DecisionTracker();

        // Forward meeting events
        this.meetingRoom.onEvent((event) => this._onEvent.fire(event));

        // Initialize default role assignments
        this.roleManager.initializeDefaults();
    }

    /**
     * Run the full SDLC pipeline for a project.
     * Executes all 6 stages in order, each with a meeting.
     */
    async runProject(
        projectName: string,
        projectDescription: string
    ): Promise<PipelineResult> {
        const pipelineId = uuidv4();
        const startTime = Date.now();
        const stageResults: StageResult[] = [];
        const allFiles: GeneratedFile[] = [];
        let totalTokens: TokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
        let accumulatedContext = projectDescription;

        this.logger.info(`Starting project pipeline: "${projectName}"`);
        this.emitEvent('pipeline:started', { pipelineId, projectName });

        const stages = this.roleManager.getStageConfigs();

        for (const stageConfig of stages) {
            this.logger.info(`Pipeline stage: ${stageConfig.name}`);
            this.emitEvent('pipeline:stageStarted', {
                pipelineId,
                stage: stageConfig.stage,
                name: stageConfig.name,
            });

            try {
                // Build meeting agenda for this stage
                const participants = [...stageConfig.leadRoles, ...stageConfig.supportingRoles];
                const leader = stageConfig.leadRoles[0];

                const agenda: MeetingAgenda = {
                    title: `${stageConfig.name} — ${projectName}`,
                    description: `${stageConfig.description}\n\nProject: ${projectName}\n${projectDescription}`,
                    type: stageConfig.meetingType,
                    participants,
                    leader,
                    maxTurns: this.config.meetingMaxTurns,
                    context: accumulatedContext,
                };

                // Run the meeting
                const meetingResult = await this.meetingRoom.runMeeting(agenda);

                // Extract generated files from implementation stage
                const generatedFiles = stageConfig.stage === SDLCStage.Implementation
                    ? this.extractGeneratedFiles(meetingResult)
                    : [];

                allFiles.push(...generatedFiles);

                const stageResult: StageResult = {
                    stage: stageConfig.stage,
                    meeting: meetingResult,
                    generatedFiles,
                    durationMs: meetingResult.durationMs,
                };

                stageResults.push(stageResult);
                totalTokens = this.addTokens(totalTokens, meetingResult.totalTokenUsage);

                // Accumulate context for next stage
                accumulatedContext += `\n\n## ${stageConfig.name} Results\n${meetingResult.summary}`;

                this.emitEvent('pipeline:stageCompleted', {
                    pipelineId,
                    stage: stageConfig.stage,
                    decisions: meetingResult.decisions.length,
                });
            } catch (err) {
                const message = err instanceof Error ? err.message : String(err);
                this.logger.error(`Stage ${stageConfig.name} failed`, err instanceof Error ? err : undefined);
                throw new PipelineError(stageConfig.stage, message);
            }
        }

        const allDecisions = stageResults.flatMap((sr) => sr.meeting.decisions);

        const pipelineResult: PipelineResult = {
            id: pipelineId,
            projectName,
            projectDescription,
            stages: stageResults,
            decisions: allDecisions,
            generatedFiles: allFiles,
            totalDurationMs: Date.now() - startTime,
            totalTokenUsage: totalTokens,
        };

        this.emitEvent('pipeline:completed', { pipelineId, projectName });
        this.logger.info(
            `Project pipeline completed: "${projectName}" ` +
            `(${stageResults.length} stages, ${allDecisions.length} decisions, ${allFiles.length} files)`
        );

        return pipelineResult;
    }

    /** Run a single standalone meeting (not part of a pipeline) */
    async runMeeting(agenda: MeetingAgenda): Promise<MeetingResult> {
        return this.meetingRoom.runMeeting(agenda);
    }

    /** Assign a company role to a specific provider */
    assignRole(role: CompanyRole, providerName: string): void {
        this.roleManager.assignRole(role, providerName);
    }

    /** Get the current team assignments */
    getTeam(): CompanyTeam {
        return this.roleManager.getTeam();
    }

    /** Get all decisions made across all meetings */
    getDecisions(): readonly Decision[] {
        return this.decisionTracker.getAllDecisions();
    }

    /** Get the role manager for external access */
    getRoleManager(): RoleManager {
        return this.roleManager;
    }

    /** Extract generated files from a meeting result (parses code blocks) */
    private extractGeneratedFiles(meetingResult: MeetingResult): GeneratedFile[] {
        const files: GeneratedFile[] = [];
        const filePattern = /```(\w+)?\s*\n\/\/\s*file:\s*(.+?)\n([\s\S]*?)```/g;

        for (const turn of meetingResult.turns) {
            let match: RegExpExecArray | null;
            while ((match = filePattern.exec(turn.message)) !== null) {
                files.push({
                    path: match[2].trim(),
                    content: match[3].trim(),
                    language: match[1] ?? 'text',
                    generatedBy: turn.role,
                });
            }
        }

        return files;
    }

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
        this.meetingRoom.dispose();
    }
}
