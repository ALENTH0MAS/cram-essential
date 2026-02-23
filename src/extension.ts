import * as vscode from 'vscode';
import { Orchestrator } from './orchestrator/Orchestrator';
import { SidebarPanel } from './ui/SidebarPanel';
import { WelcomePanel } from './ui/WelcomePanel';
import { FileManager } from './utils/fileManager';
import { handleError } from './utils/errorHandler';
import { Logger } from './utils/logger';
import { readConfig, watchConfig } from './utils/configReader';
import {
    OrchestrationStrategy,
    CompanyRole,
    MeetingType,
    MeetingResult,
    GeneratedFile,
} from './types';

/** Activate the CRAM ESSENTIAL extension. */
export function activate(context: vscode.ExtensionContext): void {
    const logger = Logger.getInstance();
    const config = readConfig();
    logger.setLevel(config.logLevel);

    if (config.customProviders.some((provider) => provider.apiKey.trim().length > 0)) {
        void vscode.window.showWarningMessage(
            'CRAM ESSENTIAL: API keys inside "cramEssential.customProviders" are stored in plain text in settings.'
        );
    }

    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot) {
        vscode.window.showWarningMessage('CRAM ESSENTIAL requires an open workspace folder.');
        return;
    }

    const fileManager = new FileManager(workspaceRoot, config.outputDir);
    fileManager.initialize().catch((err) =>
        logger.error('Failed to initialize file manager', err instanceof Error ? err : undefined)
    );

    const orchestrator = new Orchestrator(config);

    // Register WebView sidebar
    const sidebarPanel = new SidebarPanel(context.extensionUri, orchestrator, context);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('cramEssential.sidebar', sidebarPanel)
    );

    // Show Welcome page on first install
    const hasSeenWelcome = context.globalState.get<boolean>('cramEssential.welcomeShown', false);
    if (!hasSeenWelcome) {
        WelcomePanel.show(context.extensionUri);
        void context.globalState.update('cramEssential.welcomeShown', true);
    }

    // ==========================================
    // Commands
    // ==========================================

    context.subscriptions.push(
        vscode.commands.registerCommand('cramEssential.welcome', () => {
            WelcomePanel.show(context.extensionUri);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('cramEssential.startProject', async () => {
            const name = await vscode.window.showInputBox({
                prompt: 'Project name',
                placeHolder: 'e.g., E-Commerce Platform',
            });
            if (!name) {
                return;
            }

            const description = await vscode.window.showInputBox({
                prompt: 'Describe your project in detail',
                placeHolder: 'e.g., Build an e-commerce site with user auth, product catalog, cart, and Stripe payment',
            });
            if (!description) {
                return;
            }

            const strategyPick = await vscode.window.showQuickPick(
                Object.values(OrchestrationStrategy).map((s) => ({
                    label: s.charAt(0).toUpperCase() + s.slice(1),
                    value: s,
                })),
                { placeHolder: 'Select orchestration strategy' }
            );
            if (!strategyPick) {
                return;
            }

            try {
                orchestrator.startSession(name, strategyPick.value as OrchestrationStrategy);

                await vscode.window.withProgress(
                    {
                        location: vscode.ProgressLocation.Notification,
                        title: `CRAM ESSENTIAL: Running "${name}" through SDLC pipeline...`,
                        cancellable: true,
                    },
                    async (progress, _token) => {
                        const disposable = orchestrator.onEvent((event) => {
                            if (event.type === 'pipeline:stageStarted') {
                                const stageName = event.data['name'] as string;
                                progress.report({ message: stageName });
                            }
                        });

                        try {
                            const result = await orchestrator.runProject(name, description);
                            await fileManager.savePipeline(result);

                            void vscode.window.showInformationMessage(
                                `Project "${name}" completed! ` +
                                `${result.stages.length} stages, ` +
                                `${result.decisions.length} decisions, ` +
                                `${result.generatedFiles.length} files generated.`,
                                'View Report'
                            ).then((action) => {
                                if (action === 'View Report') {
                                    const reportPath = vscode.Uri.joinPath(
                                        vscode.Uri.file(workspaceRoot),
                                        config.outputDir, 'reports', `${result.id}-report.md`
                                    );
                                    void vscode.workspace.openTextDocument(reportPath).then(
                                        (doc) => vscode.window.showTextDocument(doc)
                                    );
                                }
                            });
                        } finally {
                            disposable.dispose();
                        }
                    }
                );
            } catch (err) {
                handleError(err, logger);
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('cramEssential.stopProject', () => {
            orchestrator.stopSession();
            void vscode.window.showInformationMessage('CRAM ESSENTIAL: Project stopped.');
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('cramEssential.openDashboard', () => {
            void vscode.commands.executeCommand('cramEssential.sidebar.focus');
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('cramEssential.startMeeting', async () => {
            const meetingTypes = Object.values(MeetingType).map((t) => ({
                label: t.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
                value: t,
            }));

            const typePick = await vscode.window.showQuickPick(meetingTypes, {
                placeHolder: 'Select meeting type',
            });
            if (!typePick) {
                return;
            }

            const title = await vscode.window.showInputBox({ prompt: 'Meeting title' });
            if (!title) {
                return;
            }

            const description = await vscode.window.showInputBox({ prompt: 'What should the team discuss?' });
            if (!description) {
                return;
            }

            try {
                await vscode.window.withProgress(
                    {
                        location: vscode.ProgressLocation.Notification,
                        title: `CRAM ESSENTIAL Meeting: "${title}"`,
                        cancellable: false,
                    },
                    async (progress) => {
                        const disposable = orchestrator.onEvent((event) => {
                            if (event.type === 'meeting:turn') {
                                const turn = event.data['turn'] as { role: string; turnNumber: number } | undefined;
                                if (turn) {
                                    progress.report({ message: `Turn ${turn.turnNumber}: ${turn.role}` });
                                }
                            }
                        });

                        try {
                            const allRoles = Object.values(CompanyRole);
                            const result = await orchestrator.runMeeting({
                                title,
                                description,
                                type: typePick.value as MeetingType,
                                participants: allRoles.slice(0, 5),
                                leader: CompanyRole.CEO,
                                maxTurns: config.meetingMaxTurns,
                            });

                            await fileManager.saveMeeting(result);
                            void vscode.window.showInformationMessage(
                                `Meeting completed: ${result.turns.length} turns, ${result.decisions.length} decisions`
                            );
                        } finally {
                            disposable.dispose();
                        }
                    }
                );
            } catch (err) {
                handleError(err, logger);
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('cramEssential.setStrategy', async () => {
            const pick = await vscode.window.showQuickPick(
                Object.values(OrchestrationStrategy).map((s) => ({
                    label: s.charAt(0).toUpperCase() + s.slice(1),
                    description: getStrategyDescription(s),
                    value: s,
                })),
                { placeHolder: 'Select orchestration strategy' }
            );
            if (pick) {
                void vscode.window.showInformationMessage(`Strategy set to: ${pick.label}`);
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('cramEssential.assignRoles', async () => {
            const roles = Object.values(CompanyRole).map((r) => ({
                label: r.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
                value: r,
            }));

            const rolePick = await vscode.window.showQuickPick(roles, {
                placeHolder: 'Select role to reassign',
            });
            if (!rolePick) {
                return;
            }

            const providers = orchestrator.getRegistry().listNames();
            if (providers.length === 0) {
                void vscode.window.showWarningMessage('No AI providers configured. Add API keys in settings.');
                return;
            }

            const providerPick = await vscode.window.showQuickPick(
                providers.map((p) => ({ label: p })),
                { placeHolder: `Assign ${rolePick.label} to which provider?` }
            );
            if (!providerPick) {
                return;
            }

            orchestrator.assignRole(rolePick.value as CompanyRole, providerPick.label);
            void vscode.window.showInformationMessage(`${rolePick.label} assigned to ${providerPick.label}`);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('cramEssential.viewDecisions', async () => {
            const decisions = orchestrator.getDecisions();
            if (decisions.length === 0) {
                void vscode.window.showInformationMessage('No decisions recorded yet. Start a project or meeting first.');
                return;
            }

            await fileManager.saveDecisions(decisions);
            void vscode.window.showInformationMessage(
                `${decisions.length} decisions saved to ${config.outputDir}/decisions/`
            );
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('cramEssential.exportSession', async () => {
            const session = orchestrator.getSession();
            if (!session) {
                void vscode.window.showWarningMessage('No active session to export.');
                return;
            }
            await fileManager.saveSession(session);
            void vscode.window.showInformationMessage(
                `Session exported to ${config.outputDir}/sessions/${session.id}.json`
            );
        })
    );

    // Watch for config changes - refresh sidebar and reinitialize orchestrator
    context.subscriptions.push(
        watchConfig((newConfig) => {
            orchestrator.reinitialize(newConfig);
            logger.setLevel(newConfig.logLevel);
            sidebarPanel.refresh();
            logger.info('Configuration reloaded');
        })
    );

    // Persist files on key events
    orchestrator.onEvent(async (event) => {
        try {
            if (event.type === 'meeting:completed') {
                const result = event.data['result'] as MeetingResult | undefined;
                if (result) {
                    await fileManager.saveMeeting(result);
                }
            }
            if (event.type === 'file:generated') {
                const file = event.data['file'] as GeneratedFile | undefined;
                if (file) {
                    await fileManager.saveGeneratedFile(file);
                }
            }
        } catch (err) {
            logger.error('Failed to save file', err instanceof Error ? err : undefined);
        }
    });

    context.subscriptions.push(orchestrator);
    logger.info('CRAM ESSENTIAL activated');
    logger.show();
}

/** Deactivate the extension and dispose shared resources. */
export function deactivate(): void {
    Logger.getInstance().dispose();
}

function getStrategyDescription(strategy: string): string {
    const descriptions: Record<string, string> = {
        collaborative: 'AIs discuss iteratively: Architect designs, Developer implements, Reviewer critiques',
        sequential: 'Pipeline: each AI builds on the previous one\'s output',
        parallel: 'All AIs work independently, then results are synthesized',
        competitive: 'AIs compete, a judge picks the best response',
    };
    return descriptions[strategy] ?? '';
}
