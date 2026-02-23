import {
    CompanyRole,
    ProviderType,
    RoleDefinition,
    RoleAssignment,
    CompanyTeam,
    SDLCStage,
    MeetingType,
    StageConfig,
} from '../types';
import { ProviderRegistry } from '../ai-providers/ProviderRegistry';
import { Logger } from '../utils/logger';

/** All 12 company role definitions with responsibilities and default provider assignments */
const ROLE_DEFINITIONS: readonly RoleDefinition[] = [
    {
        role: CompanyRole.CEO,
        title: 'CEO / Project Manager',
        department: 'Executive',
        responsibilities: ['Vision & strategy', 'Resource allocation', 'Final decisions', 'Team coordination'],
        systemPrompt: CompanyRole.CEO,
        defaultProvider: ProviderType.Claude,
    },
    {
        role: CompanyRole.CTO,
        title: 'Chief Technology Officer',
        department: 'Executive',
        responsibilities: ['Technology choices', 'Architecture decisions', 'Feasibility assessment', 'Risk evaluation'],
        systemPrompt: CompanyRole.CTO,
        defaultProvider: ProviderType.Claude,
    },
    {
        role: CompanyRole.LeadArchitect,
        title: 'Lead Architect',
        department: 'Engineering',
        responsibilities: ['System design', 'Data models', 'API design', 'Component architecture'],
        systemPrompt: CompanyRole.LeadArchitect,
        defaultProvider: ProviderType.Claude,
    },
    {
        role: CompanyRole.SeniorDeveloper,
        title: 'Senior Developer',
        department: 'Engineering',
        responsibilities: ['Core implementation', 'Algorithm selection', 'Code optimization', 'Technical mentoring'],
        systemPrompt: CompanyRole.SeniorDeveloper,
        defaultProvider: ProviderType.GPT,
    },
    {
        role: CompanyRole.FrontendDeveloper,
        title: 'Frontend Developer',
        department: 'Engineering',
        responsibilities: ['UI implementation', 'Responsive design', 'UX patterns', 'State management'],
        systemPrompt: CompanyRole.FrontendDeveloper,
        defaultProvider: ProviderType.GPT,
    },
    {
        role: CompanyRole.BackendDeveloper,
        title: 'Backend Developer',
        department: 'Engineering',
        responsibilities: ['Server implementation', 'Database logic', 'API endpoints', 'Business logic'],
        systemPrompt: CompanyRole.BackendDeveloper,
        defaultProvider: ProviderType.GPT,
    },
    {
        role: CompanyRole.QAEngineer,
        title: 'QA Engineer',
        department: 'Quality',
        responsibilities: ['Test planning', 'Bug detection', 'Edge case analysis', 'Test automation'],
        systemPrompt: CompanyRole.QAEngineer,
        defaultProvider: ProviderType.Gemini,
    },
    {
        role: CompanyRole.SecurityAuditor,
        title: 'Security Auditor',
        department: 'Quality',
        responsibilities: ['Vulnerability scanning', 'OWASP compliance', 'Security review', 'Threat modeling'],
        systemPrompt: CompanyRole.SecurityAuditor,
        defaultProvider: ProviderType.Gemini,
    },
    {
        role: CompanyRole.DevOpsEngineer,
        title: 'DevOps Engineer',
        department: 'Operations',
        responsibilities: ['CI/CD pipeline', 'Infrastructure', 'Deployment', 'Monitoring'],
        systemPrompt: CompanyRole.DevOpsEngineer,
        defaultProvider: ProviderType.Gemini,
    },
    {
        role: CompanyRole.SEOSpecialist,
        title: 'SEO Specialist',
        department: 'Marketing',
        responsibilities: ['Search optimization', 'Meta tags', 'Structured data', 'Core Web Vitals'],
        systemPrompt: CompanyRole.SEOSpecialist,
        defaultProvider: ProviderType.GPT,
    },
    {
        role: CompanyRole.MarketingStrategist,
        title: 'Marketing Strategist',
        department: 'Marketing',
        responsibilities: ['Go-to-market strategy', 'Content planning', 'Analytics', 'Growth strategy'],
        systemPrompt: CompanyRole.MarketingStrategist,
        defaultProvider: ProviderType.Claude,
    },
    {
        role: CompanyRole.PerformanceEngineer,
        title: 'Performance Engineer',
        department: 'Quality',
        responsibilities: ['Performance profiling', 'Load testing', 'Optimization', 'Benchmarking'],
        systemPrompt: CompanyRole.PerformanceEngineer,
        defaultProvider: ProviderType.Gemini,
    },
];

/** SDLC stage configurations — which roles participate in each stage */
const STAGE_CONFIGS: readonly StageConfig[] = [
    {
        stage: SDLCStage.Discovery,
        name: 'Discovery & Planning',
        description: 'Analyze project requirements, set vision, evaluate feasibility',
        leadRoles: [CompanyRole.CEO, CompanyRole.CTO],
        supportingRoles: [CompanyRole.LeadArchitect, CompanyRole.SeniorDeveloper, CompanyRole.QAEngineer],
        meetingType: MeetingType.Kickoff,
        outputArtifacts: ['project-charter.md', 'requirements.md', 'tech-stack-decision.md'],
    },
    {
        stage: SDLCStage.Architecture,
        name: 'Architecture & Design',
        description: 'Design system components, data models, APIs, choose algorithms',
        leadRoles: [CompanyRole.CTO, CompanyRole.LeadArchitect],
        supportingRoles: [CompanyRole.SeniorDeveloper, CompanyRole.BackendDeveloper, CompanyRole.SecurityAuditor],
        meetingType: MeetingType.ArchitectureReview,
        outputArtifacts: ['architecture.md', 'database-schema.md', 'api-contracts.md'],
    },
    {
        stage: SDLCStage.Implementation,
        name: 'Implementation',
        description: 'Write production code based on the architecture',
        leadRoles: [CompanyRole.SeniorDeveloper, CompanyRole.FrontendDeveloper, CompanyRole.BackendDeveloper],
        supportingRoles: [CompanyRole.LeadArchitect, CompanyRole.CTO],
        meetingType: MeetingType.SprintPlanning,
        outputArtifacts: ['source-code'],
    },
    {
        stage: SDLCStage.QualityAssurance,
        name: 'Quality Assurance',
        description: 'Test, review security, check performance, fix bugs',
        leadRoles: [CompanyRole.QAEngineer, CompanyRole.SecurityAuditor],
        supportingRoles: [CompanyRole.PerformanceEngineer, CompanyRole.SeniorDeveloper],
        meetingType: MeetingType.CodeReview,
        outputArtifacts: ['test-results.md', 'security-report.md', 'performance-report.md'],
    },
    {
        stage: SDLCStage.SEOMarketing,
        name: 'SEO & Marketing',
        description: 'Optimize for search engines, plan marketing strategy',
        leadRoles: [CompanyRole.SEOSpecialist, CompanyRole.MarketingStrategist],
        supportingRoles: [CompanyRole.FrontendDeveloper, CompanyRole.CEO],
        meetingType: MeetingType.SEOMarketingReview,
        outputArtifacts: ['seo-report.md', 'marketing-plan.md'],
    },
    {
        stage: SDLCStage.Deployment,
        name: 'Deployment & Launch',
        description: 'Plan infrastructure, CI/CD, monitoring, and launch',
        leadRoles: [CompanyRole.DevOpsEngineer],
        supportingRoles: [CompanyRole.CTO, CompanyRole.CEO, CompanyRole.SecurityAuditor],
        meetingType: MeetingType.DeploymentReview,
        outputArtifacts: ['deployment-config.md', 'monitoring-setup.md', 'launch-checklist.md'],
    },
];

/**
 * Manages company roles, assignments, and SDLC stage configurations.
 * Maps each role to an AI provider and provides stage-specific participation lists.
 */
export class RoleManager {
    private readonly assignments: Map<CompanyRole, string> = new Map();
    private readonly logger = Logger.getInstance();

    /** Get all role definitions */
    getRoleDefinitions(): readonly RoleDefinition[] {
        return ROLE_DEFINITIONS;
    }

    /** Get a specific role definition */
    getRoleDefinition(role: CompanyRole): RoleDefinition {
        const def = ROLE_DEFINITIONS.find((d) => d.role === role);
        if (!def) {
            throw new Error(`Unknown role: ${role}`);
        }
        return def;
    }

    /** Get all SDLC stage configurations */
    getStageConfigs(): readonly StageConfig[] {
        return STAGE_CONFIGS;
    }

    /** Get a specific stage configuration */
    getStageConfig(stage: SDLCStage): StageConfig {
        const config = STAGE_CONFIGS.find((s) => s.stage === stage);
        if (!config) {
            throw new Error(`Unknown stage: ${stage}`);
        }
        return config;
    }

    /** Assign a role to a specific provider by name */
    assignRole(role: CompanyRole, providerName: string): void {
        const registry = ProviderRegistry.getInstance();
        if (!registry.has(providerName)) {
            throw new Error(`Provider "${providerName}" not found. Available: ${registry.listNames().join(', ')}`);
        }
        this.assignments.set(role, providerName);
        this.logger.info(`Role ${role} assigned to provider ${providerName}`);
    }

    /** Get the provider name assigned to a role (falls back to default) */
    getProviderForRole(role: CompanyRole): string {
        const assigned = this.assignments.get(role);
        if (assigned) {
            return assigned;
        }

        // Fall back to default provider type for this role
        const def = this.getRoleDefinition(role);
        const registry = ProviderRegistry.getInstance();

        // Find first available provider matching default type
        for (const provider of registry.listAll()) {
            if (provider.type === def.defaultProvider) {
                return provider.name;
            }
        }

        // Fall back to any available provider
        const names = registry.listNames();
        if (names.length === 0) {
            throw new Error(`No providers available for role ${role}`);
        }
        return names[0];
    }

    /** Initialize default role assignments based on available providers */
    initializeDefaults(): void {
        const registry = ProviderRegistry.getInstance();

        for (const def of ROLE_DEFINITIONS) {
            // Find provider matching default type
            for (const provider of registry.listAll()) {
                if (provider.type === def.defaultProvider) {
                    this.assignments.set(def.role, provider.name);
                    break;
                }
            }
        }

        this.logger.info(`Initialized default role assignments for ${this.assignments.size} roles`);
    }

    /** Get the current team (all assignments) */
    getTeam(): CompanyTeam {
        const assignments: RoleAssignment[] = [];
        for (const [role, providerName] of this.assignments) {
            assignments.push({ role, providerName });
        }
        return {
            assignments,
            activeRoles: Array.from(this.assignments.keys()),
        };
    }

    /** Get all roles participating in a given SDLC stage */
    getRolesForStage(stage: SDLCStage): readonly CompanyRole[] {
        const config = this.getStageConfig(stage);
        return [...config.leadRoles, ...config.supportingRoles];
    }
}
