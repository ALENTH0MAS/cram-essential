/* ============================================================
 * CRAM ESSENTIAL — Type Definitions
 * The foundation of the entire project. Every module imports from here.
 * ============================================================ */

// ============================================================
// Enums
// ============================================================

export enum ProviderType {
    Claude = 'claude',
    GPT = 'gpt',
    Gemini = 'gemini',
    Custom = 'custom',
}

/** Company roles that AI employees can assume */
export enum CompanyRole {
    CEO = 'ceo',
    CTO = 'cto',
    LeadArchitect = 'lead_architect',
    SeniorDeveloper = 'senior_developer',
    FrontendDeveloper = 'frontend_developer',
    BackendDeveloper = 'backend_developer',
    QAEngineer = 'qa_engineer',
    SecurityAuditor = 'security_auditor',
    DevOpsEngineer = 'devops_engineer',
    SEOSpecialist = 'seo_specialist',
    MarketingStrategist = 'marketing_strategist',
    PerformanceEngineer = 'performance_engineer',
}

export enum OrchestrationStrategy {
    Collaborative = 'collaborative',
    Sequential = 'sequential',
    Parallel = 'parallel',
    Competitive = 'competitive',
}

/** SDLC pipeline stages — the company workflow */
export enum SDLCStage {
    Discovery = 'discovery',
    Architecture = 'architecture',
    Implementation = 'implementation',
    QualityAssurance = 'quality_assurance',
    SEOMarketing = 'seo_marketing',
    Deployment = 'deployment',
}

export enum MeetingType {
    Kickoff = 'kickoff',
    ArchitectureReview = 'architecture_review',
    SprintPlanning = 'sprint_planning',
    CodeReview = 'code_review',
    BugTriage = 'bug_triage',
    SEOMarketingReview = 'seo_marketing_review',
    DeploymentReview = 'deployment_review',
    Retrospective = 'retrospective',
}

export enum MessageRole {
    System = 'system',
    User = 'user',
    Assistant = 'assistant',
}

export enum SessionStatus {
    Idle = 'idle',
    Running = 'running',
    Paused = 'paused',
    Completed = 'completed',
    Error = 'error',
}

export enum LogLevel {
    Debug = 'debug',
    Info = 'info',
    Warn = 'warn',
    Error = 'error',
}

// ============================================================
// Core Data Structures
// ============================================================

export interface Message {
    readonly id: string;
    readonly role: MessageRole;
    readonly content: string;
    readonly timestamp: number;
    readonly provider?: string;
    readonly companyRole?: CompanyRole;
    readonly mentionedRoles?: readonly CompanyRole[];
    readonly metadata?: Readonly<Record<string, string>>;
}

export interface Conversation {
    readonly id: string;
    readonly sessionId: string;
    readonly messages: readonly Message[];
    readonly createdAt: number;
    readonly updatedAt: number;
}

export interface TokenUsage {
    readonly promptTokens: number;
    readonly completionTokens: number;
    readonly totalTokens: number;
}

export interface ProviderResponse {
    readonly content: string;
    readonly provider: string;
    readonly model: string;
    readonly tokensUsed: TokenUsage;
    readonly durationMs: number;
    readonly raw?: unknown;
}

// ============================================================
// Provider Configuration
// ============================================================

export interface ProviderConfig {
    readonly apiKey: string;
    readonly model: string;
    readonly maxTokens: number;
    readonly timeoutMs: number;
    readonly temperature?: number;
}

export interface CustomProviderConfig {
    readonly name: string;
    readonly displayName?: string;
    readonly baseUrl: string;
    readonly apiKey: string;
    readonly model: string;
    readonly maxTokens: number;
}

export interface ProviderCapabilities {
    readonly supportsStreaming: boolean;
    readonly supportsSystemMessages: boolean;
    readonly maxContextTokens: number;
    readonly supportedRoles: readonly CompanyRole[];
}

export interface ProviderStatus {
    readonly name: string;
    readonly type: ProviderType;
    readonly isConfigured: boolean;
    readonly isHealthy: boolean;
    readonly lastError?: string;
    readonly lastUsed?: number;
}

// ============================================================
// Company & Roles
// ============================================================

export interface RoleDefinition {
    readonly role: CompanyRole;
    readonly title: string;
    readonly department: string;
    readonly responsibilities: readonly string[];
    readonly systemPrompt: string;
    readonly defaultProvider: ProviderType;
}

export interface RoleAssignment {
    readonly role: CompanyRole;
    readonly providerName: string;
}

export interface CompanyTeam {
    readonly assignments: readonly RoleAssignment[];
    readonly activeRoles: readonly CompanyRole[];
}

// ============================================================
// Meetings
// ============================================================

export interface MeetingAgenda {
    readonly title: string;
    readonly description: string;
    readonly type: MeetingType;
    readonly participants: readonly CompanyRole[];
    readonly leader: CompanyRole;
    readonly maxTurns: number;
    readonly context?: string;
}

export interface MeetingTurn {
    readonly turnNumber: number;
    readonly role: CompanyRole;
    readonly providerName: string;
    readonly message: string;
    readonly mentionedRoles: readonly CompanyRole[];
    readonly timestamp: number;
    readonly tokensUsed: TokenUsage;
}

export interface Decision {
    readonly id: string;
    readonly meetingId: string;
    readonly stage: SDLCStage;
    readonly title: string;
    readonly description: string;
    readonly rationale: string;
    readonly alternatives: readonly string[];
    readonly madeBy: CompanyRole;
    readonly timestamp: number;
}

export interface MeetingResult {
    readonly id: string;
    readonly agenda: MeetingAgenda;
    readonly turns: readonly MeetingTurn[];
    readonly decisions: readonly Decision[];
    readonly summary: string;
    readonly artifacts: readonly string[];
    readonly durationMs: number;
    readonly totalTokenUsage: TokenUsage;
}

// ============================================================
// SDLC Pipeline
// ============================================================

export interface StageConfig {
    readonly stage: SDLCStage;
    readonly name: string;
    readonly description: string;
    readonly leadRoles: readonly CompanyRole[];
    readonly supportingRoles: readonly CompanyRole[];
    readonly meetingType: MeetingType;
    readonly outputArtifacts: readonly string[];
}

export interface StageResult {
    readonly stage: SDLCStage;
    readonly meeting: MeetingResult;
    readonly generatedFiles: readonly GeneratedFile[];
    readonly durationMs: number;
}

export interface PipelineResult {
    readonly id: string;
    readonly projectName: string;
    readonly projectDescription: string;
    readonly stages: readonly StageResult[];
    readonly decisions: readonly Decision[];
    readonly generatedFiles: readonly GeneratedFile[];
    readonly totalDurationMs: number;
    readonly totalTokenUsage: TokenUsage;
}

export interface GeneratedFile {
    readonly path: string;
    readonly content: string;
    readonly language: string;
    readonly generatedBy: CompanyRole;
    readonly reviewedBy?: CompanyRole;
}

// ============================================================
// Orchestration
// ============================================================

export interface OrchestrationRequest {
    readonly prompt: string;
    readonly strategy: OrchestrationStrategy;
    readonly context?: string;
    readonly files?: readonly string[];
    readonly preferredProviders?: readonly string[];
}

export interface OrchestrationResult {
    readonly id: string;
    readonly strategy: OrchestrationStrategy;
    readonly responses: readonly ProviderResponse[];
    readonly finalOutput: string;
    readonly conversation: Conversation;
    readonly durationMs: number;
    readonly tokenUsage: TokenUsage;
}

export interface StrategyConfig {
    readonly maxRounds: number;
    readonly requireConsensus: boolean;
    readonly votingThreshold?: number;
    readonly timeoutPerProviderMs: number;
}

// ============================================================
// Session
// ============================================================

export interface Session {
    readonly id: string;
    readonly name: string;
    readonly status: SessionStatus;
    readonly strategy: OrchestrationStrategy;
    readonly team: CompanyTeam;
    readonly conversations: readonly Conversation[];
    readonly pipeline?: PipelineResult;
    readonly createdAt: number;
    readonly updatedAt: number;
}

// ============================================================
// Events (Observer Pattern)
// ============================================================

export type OrchestratorEventType =
    | 'session:started'
    | 'session:stopped'
    | 'session:error'
    | 'provider:request'
    | 'provider:response'
    | 'provider:error'
    | 'pipeline:started'
    | 'pipeline:stageStarted'
    | 'pipeline:stageCompleted'
    | 'pipeline:completed'
    | 'strategy:phaseStarted'
    | 'strategy:phaseCompleted'
    | 'meeting:started'
    | 'meeting:turn'
    | 'meeting:decision'
    | 'meeting:completed'
    | 'file:generated'
    | 'dashboard:update';

export interface OrchestratorEvent {
    readonly type: OrchestratorEventType;
    readonly timestamp: number;
    readonly data: Record<string, unknown>;
}

// ============================================================
// Dashboard / WebView Messages
// ============================================================

export interface DashboardState {
    readonly session: Session | null;
    readonly providerStatuses: readonly ProviderStatus[];
    readonly currentStrategy: OrchestrationStrategy;
    readonly currentStage: SDLCStage | null;
    readonly meetingInProgress: boolean;
    readonly recentDecisions: readonly Decision[];
    readonly activeMeeting: MeetingResult | null;
}

/** Messages from extension to WebView */
export type ExtensionToWebviewMessage =
    | { readonly type: 'stateUpdate'; readonly state: DashboardState }
    | { readonly type: 'meetingTurn'; readonly turn: MeetingTurn }
    | { readonly type: 'pipelineProgress'; readonly stage: SDLCStage; readonly progress: number }
    | { readonly type: 'decision'; readonly decision: Decision }
    | { readonly type: 'log'; readonly level: LogLevel; readonly message: string };

/** Messages from WebView to extension */
export type WebviewToExtensionMessage =
    | { readonly type: 'startProject'; readonly name: string; readonly description: string; readonly strategy: OrchestrationStrategy }
    | { readonly type: 'stopProject' }
    | { readonly type: 'startMeeting'; readonly agenda: MeetingAgenda }
    | { readonly type: 'changeStrategy'; readonly strategy: OrchestrationStrategy }
    | { readonly type: 'assignRole'; readonly role: CompanyRole; readonly providerName: string }
    | { readonly type: 'sendPrompt'; readonly prompt: string }
    | { readonly type: 'ready' };

// ============================================================
// Extension Configuration
// ============================================================

export interface ExtensionConfig {
    readonly claude: ProviderConfig;
    readonly gpt: ProviderConfig;
    readonly gemini: ProviderConfig;
    readonly customProviders: readonly CustomProviderConfig[];
    readonly defaultStrategy: OrchestrationStrategy;
    readonly outputDir: string;
    readonly meetingMaxTurns: number;
    readonly logLevel: LogLevel;
}
