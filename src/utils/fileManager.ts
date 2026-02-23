import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import {
    Session,
    MeetingResult,
    PipelineResult,
    GeneratedFile,
    Decision,
} from '../types';
import { Logger } from './logger';

/**
 * Manages the .cram-essential/ directory structure for persisting
 * sessions, meetings, decisions, generated code, and reports.
 */
export class FileManager {
    private readonly baseDir: string;
    private readonly logger = Logger.getInstance();

    constructor(workspaceRoot: string, outputDir: string) {
        this.baseDir = path.join(workspaceRoot, outputDir);
    }

    /** Ensure the directory structure exists */
    async initialize(): Promise<void> {
        const dirs = [
            this.baseDir,
            path.join(this.baseDir, 'sessions'),
            path.join(this.baseDir, 'meetings'),
            path.join(this.baseDir, 'decisions'),
            path.join(this.baseDir, 'generated'),
            path.join(this.baseDir, 'reports'),
        ];

        for (const dir of dirs) {
            await fs.mkdir(dir, { recursive: true });
        }

        this.logger.info(`File manager initialized at ${this.baseDir}`);
    }

    /** Save a session to JSON */
    async saveSession(session: Session): Promise<string> {
        const filePath = path.join(this.baseDir, 'sessions', `${session.id}.json`);
        await fs.writeFile(filePath, JSON.stringify(session, null, 2), 'utf-8');
        this.logger.debug(`Session saved: ${filePath}`);
        return filePath;
    }

    /** Save a meeting result as both JSON and readable Markdown */
    async saveMeeting(result: MeetingResult): Promise<string> {
        const jsonPath = path.join(this.baseDir, 'meetings', `${result.id}.json`);
        await fs.writeFile(jsonPath, JSON.stringify(result, null, 2), 'utf-8');

        // Also save as readable markdown
        const mdPath = path.join(this.baseDir, 'meetings', `${result.id}.md`);
        const markdown = this.meetingToMarkdown(result);
        await fs.writeFile(mdPath, markdown, 'utf-8');

        this.logger.debug(`Meeting saved: ${mdPath}`);
        return mdPath;
    }

    /** Save a complete pipeline result */
    async savePipeline(result: PipelineResult): Promise<string> {
        const dir = path.join(this.baseDir, 'sessions', result.id);
        await fs.mkdir(dir, { recursive: true });

        // Save pipeline summary
        const summaryPath = path.join(dir, 'pipeline-summary.json');
        await fs.writeFile(summaryPath, JSON.stringify(result, null, 2), 'utf-8');

        // Save each stage meeting
        for (const stage of result.stages) {
            await this.saveMeeting(stage.meeting);
        }

        // Save all generated files
        for (const file of result.generatedFiles) {
            await this.saveGeneratedFile(file);
        }

        // Save decisions
        await this.saveDecisions(result.decisions);

        // Save readable report
        const reportPath = path.join(this.baseDir, 'reports', `${result.id}-report.md`);
        const report = this.pipelineToMarkdown(result);
        await fs.writeFile(reportPath, report, 'utf-8');

        this.logger.info(`Pipeline saved: ${dir}`);
        return dir;
    }

    /** Save a generated file to the generated/ directory */
    async saveGeneratedFile(file: GeneratedFile): Promise<vscode.Uri> {
        const filePath = path.join(this.baseDir, 'generated', file.path);
        const dir = path.dirname(filePath);
        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(filePath, file.content, 'utf-8');
        this.logger.debug(`Generated file saved: ${filePath}`);
        return vscode.Uri.file(filePath);
    }

    /** Save decisions as JSON and markdown */
    async saveDecisions(decisions: readonly Decision[]): Promise<string> {
        if (decisions.length === 0) {
            return '';
        }

        const filePath = path.join(this.baseDir, 'decisions', `decisions-${Date.now()}.md`);
        const lines = ['# Decision Log\n'];

        for (const decision of decisions) {
            lines.push(`## ${decision.title}`);
            lines.push(`- **Stage**: ${decision.stage}`);
            lines.push(`- **Made by**: ${decision.madeBy}`);
            lines.push(`- **Description**: ${decision.description}`);
            if (decision.rationale) {
                lines.push(`- **Rationale**: ${decision.rationale}`);
            }
            if (decision.alternatives.length > 0) {
                lines.push(`- **Alternatives considered**: ${decision.alternatives.join(', ')}`);
            }
            lines.push(`- **Time**: ${new Date(decision.timestamp).toISOString()}`);
            lines.push('');
        }

        await fs.writeFile(filePath, lines.join('\n'), 'utf-8');
        return filePath;
    }

    /** Load a session by ID */
    async loadSession(sessionId: string): Promise<Session | null> {
        try {
            const filePath = path.join(this.baseDir, 'sessions', `${sessionId}.json`);
            const content = await fs.readFile(filePath, 'utf-8');
            return JSON.parse(content) as Session;
        } catch {
            return null;
        }
    }

    /** List all saved sessions */
    async listSessions(): Promise<string[]> {
        try {
            const dir = path.join(this.baseDir, 'sessions');
            const files = await fs.readdir(dir);
            return files.filter((f) => f.endsWith('.json')).map((f) => f.replace('.json', ''));
        } catch {
            return [];
        }
    }

    /** Convert a meeting result to readable markdown */
    private meetingToMarkdown(result: MeetingResult): string {
        const lines = [
            `# Meeting: ${result.agenda.title}`,
            `**Type**: ${result.agenda.type}`,
            `**Duration**: ${(result.durationMs / 1000).toFixed(1)}s`,
            `**Tokens used**: ${result.totalTokenUsage.totalTokens.toLocaleString()}`,
            '',
            '## Discussion',
            '',
        ];

        for (const turn of result.turns) {
            lines.push(`### Turn ${turn.turnNumber} — ${turn.role} (${turn.providerName})`);
            lines.push(turn.message);
            lines.push('');
        }

        if (result.decisions.length > 0) {
            lines.push('## Decisions');
            for (const d of result.decisions) {
                lines.push(`- **${d.title}**: ${d.description}`);
            }
            lines.push('');
        }

        lines.push('## Summary', result.summary);

        return lines.join('\n');
    }

    /** Convert a pipeline result to a comprehensive report */
    private pipelineToMarkdown(result: PipelineResult): string {
        const lines = [
            `# Project Report: ${result.projectName}`,
            `**Duration**: ${(result.totalDurationMs / 1000 / 60).toFixed(1)} minutes`,
            `**Total tokens**: ${result.totalTokenUsage.totalTokens.toLocaleString()}`,
            `**Stages completed**: ${result.stages.length}`,
            `**Decisions made**: ${result.decisions.length}`,
            `**Files generated**: ${result.generatedFiles.length}`,
            '',
            '---',
            '',
        ];

        for (const stage of result.stages) {
            lines.push(`## ${stage.stage.replace(/_/g, ' ').toUpperCase()}`);
            lines.push(`Duration: ${(stage.durationMs / 1000).toFixed(1)}s`);
            lines.push('');
            lines.push(stage.meeting.summary);
            lines.push('');

            if (stage.meeting.decisions.length > 0) {
                lines.push('### Decisions');
                for (const d of stage.meeting.decisions) {
                    lines.push(`- ${d.title}`);
                }
                lines.push('');
            }
        }

        return lines.join('\n');
    }
}
