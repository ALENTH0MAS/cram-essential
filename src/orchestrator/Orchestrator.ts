import * as vscode from 'vscode';
import { v4 as uuidv4 } from 'uuid';
import {
    OrchestrationRequest,
    OrchestrationResult,
    OrchestrationStrategy,
    StrategyConfig,
    MeetingAgenda,
    MeetingResult,
    PipelineResult,
    Session,
    SessionStatus,
    CompanyRole,
    CompanyTeam,
    Decision,
    ProviderStatus,
    OrchestratorEvent,
    ExtensionConfig,
} from '../types';
import { ProviderRegistry } from '../ai-providers/ProviderRegistry';
import { ProviderFactory } from '../ai-providers/ProviderFactory';
import { CompanyManager } from '../company/CompanyManager';
import { IStrategy } from './strategies/IStrategy';
import { CollaborativeStrategy } from './strategies/CollaborativeStrategy';
import { SequentialStrategy } from './strategies/SequentialStrategy';
import { ParallelStrategy } from './strategies/ParallelStrategy';
import { CompetitiveStrategy } from './strategies/CompetitiveStrategy';
import { Logger } from '../utils/logger';

/**
 * Central orchestrator that wires together providers, strategies, and the company system.
 * This is the main entry point for all AI operations.
 */
export class Orchestrator implements vscode.Disposable {
    private readonly registry: ProviderRegistry;
    private readonly strategies: Map<OrchestrationStrategy, IStrategy> = new Map();
    private readonly companyManager: CompanyManager;
    private readonly logger = Logger.getInstance();
    private session: Session | null = null;

    private readonly _onEvent = new vscode.EventEmitter<OrchestratorEvent>();
    public readonly onEvent: vscode.Event<OrchestratorEvent> = this._onEvent.event;

    constructor(private config: ExtensionConfig) {
        // Initialize providers from config
        this.registry = ProviderFactory.initializeFromConfig(config);

        // Initialize strategies
        this.strategies.set(OrchestrationStrategy.Collaborative, new CollaborativeStrategy());
        this.strategies.set(OrchestrationStrategy.Sequential, new SequentialStrategy());
        this.strategies.set(OrchestrationStrategy.Parallel, new ParallelStrategy());
        this.strategies.set(OrchestrationStrategy.Competitive, new CompetitiveStrategy());

        // Initialize company manager
        this.companyManager = new CompanyManager(config, this.registry);

        // Forward company events
        this.companyManager.onEvent((event) => this._onEvent.fire(event));
    }

    /** Start a new session */
    startSession(name: string, strategy: OrchestrationStrategy): Session {
        this.session = {
            id: uuidv4(),
            name,
            status: SessionStatus.Running,
            strategy,
            team: this.companyManager.getTeam(),
            conversations: [],
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };

        this.emitEvent('session:started', { sessionId: this.session.id, name });
        this.logger.info(`Session started: "${name}" with ${strategy} strategy`);

        return this.session;
    }

    /** Stop the current session */
    stopSession(): void {
        if (this.session) {
            this.emitEvent('session:stopped', { sessionId: this.session.id });
            this.logger.info(`Session stopped: "${this.session.name}"`);
            this.session = null;
        }
    }

    /** Execute a one-shot orchestration request using a strategy */
    async execute(request: OrchestrationRequest): Promise<OrchestrationResult> {
        const strategy = this.strategies.get(request.strategy);
        if (!strategy) {
            throw new Error(`Unknown strategy: ${request.strategy}`);
        }

        const providers = this.registry.getProviderMap();
        if (providers.size === 0) {
            throw new Error('No AI providers configured. Add API keys in settings.');
        }

        const strategyConfig: StrategyConfig = {
            maxRounds: 3,
            requireConsensus: request.strategy === OrchestrationStrategy.Collaborative,
            timeoutPerProviderMs: this.config.claude.timeoutMs,
        };

        return strategy.execute(request, providers, strategyConfig, (event) => {
            this._onEvent.fire(event);
        });
    }

    /** Run a full company project through the SDLC pipeline */
    async runProject(name: string, description: string): Promise<PipelineResult> {
        return this.companyManager.runProject(name, description);
    }

    /** Run a standalone meeting */
    async runMeeting(agenda: MeetingAgenda): Promise<MeetingResult> {
        return this.companyManager.runMeeting(agenda);
    }

    /** Assign a company role to a provider */
    assignRole(role: CompanyRole, providerName: string): void {
        this.companyManager.assignRole(role, providerName);
    }

    /** Get current team assignments */
    getTeam(): CompanyTeam {
        return this.companyManager.getTeam();
    }

    /** Get all decisions */
    getDecisions(): readonly Decision[] {
        return this.companyManager.getDecisions();
    }

    /** Get provider statuses */
    getProviderStatuses(): readonly ProviderStatus[] {
        return this.registry.getAllStatuses();
    }

    /** Get current session */
    getSession(): Session | null {
        return this.session;
    }

    /** Get the provider registry */
    getRegistry(): ProviderRegistry {
        return this.registry;
    }

    /** Get the company manager */
    getCompanyManager(): CompanyManager {
        return this.companyManager;
    }

    /** Reinitialize with new config */
    reinitialize(newConfig: ExtensionConfig): void {
        this.config = newConfig;
        ProviderFactory.initializeFromConfig(newConfig);
        this.logger.info('Orchestrator reinitialized with new config');
    }

    private emitEvent(type: OrchestratorEvent['type'], data: Record<string, unknown>): void {
        this._onEvent.fire({ type, timestamp: Date.now(), data });
    }

    dispose(): void {
        this._onEvent.dispose();
        this.companyManager.dispose();
    }
}
