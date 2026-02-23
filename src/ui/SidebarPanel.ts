import * as vscode from 'vscode';
import {
    DashboardState,
    ExtensionToWebviewMessage,
    WebviewToExtensionMessage,
    OrchestrationStrategy,
    SDLCStage,
    MeetingTurn,
    Decision,
    LogLevel,
    MeetingAgenda,
    CompanyRole,
} from '../types';
import { Orchestrator } from '../orchestrator/Orchestrator';
import { handleError } from '../utils/errorHandler';
import { Logger } from '../utils/logger';
import { readConfig } from '../utils/configReader';
import { WelcomePanel } from './WelcomePanel';

/**
 * Sidebar WebView panel with dual-mode rendering:
 * - Onboarding: When no providers are configured, shows setup UI
 * - Dashboard: When providers exist, shows full meeting/pipeline dashboard
 */
export class SidebarPanel implements vscode.WebviewViewProvider {
    public static readonly viewType = 'cramEssential.sidebar';
    private view?: vscode.WebviewView;
    private readonly logger = Logger.getInstance();

    constructor(
        private readonly extensionUri: vscode.Uri,
        private readonly orchestrator: Orchestrator,
        _context: vscode.ExtensionContext
    ) {
        void _context;
        this.orchestrator.onEvent((event) => {
            if (event.type === 'meeting:turn') {
                const turn = event.data['turn'] as MeetingTurn | undefined;
                if (turn) {
                    this.postMessage({ type: 'meetingTurn', turn });
                }
            }
            if (event.type === 'meeting:decision') {
                const decision = event.data['decision'] as Decision | undefined;
                if (decision) {
                    this.postMessage({ type: 'decision', decision });
                }
            }
            if (event.type === 'pipeline:stageStarted') {
                const stage = event.data['stage'] as SDLCStage | undefined;
                if (stage) {
                    this.postMessage({ type: 'pipelineProgress', stage, progress: 0 });
                }
            }
            if (event.type === 'pipeline:stageCompleted') {
                const stage = event.data['stage'] as SDLCStage | undefined;
                if (stage) {
                    this.postMessage({ type: 'pipelineProgress', stage, progress: 100 });
                }
            }
            this.sendStateUpdate();
        });
    }

    /** Resolve and initialize the sidebar webview. */
    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        _context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ): void {
        this.view = webviewView;
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this.extensionUri],
        };
        this.updateContent();
        webviewView.webview.onDidReceiveMessage(
            (message: WebviewToExtensionMessage & Record<string, unknown>) => this.handleMessage(message)
        );
    }

    /** Refresh the sidebar content (call when config changes). */
    public refresh(): void {
        this.updateContent();
    }

    private updateContent(): void {
        if (!this.view) {
            return;
        }
        const config = readConfig();
        const hasAnyProvider = config.claude.apiKey.length > 0
            || config.gpt.apiKey.length > 0
            || config.gemini.apiKey.length > 0
            || config.customProviders.length > 0;

        this.view.webview.html = hasAnyProvider
            ? this.getDashboardHtml()
            : this.getOnboardingHtml();
    }

    private async handleMessage(message: WebviewToExtensionMessage & Record<string, unknown>): Promise<void> {
        try {
            switch (message.type) {
                case 'startProject': {
                    const msg = message as WebviewToExtensionMessage & {
                        name: string;
                        description: string;
                        strategy: OrchestrationStrategy;
                    };
                    this.orchestrator.startSession(msg.name, msg.strategy);
                    await this.orchestrator.runProject(msg.name, msg.description);
                    break;
                }
                case 'stopProject':
                    this.orchestrator.stopSession();
                    break;
                case 'startMeeting':
                    await this.orchestrator.runMeeting((message as WebviewToExtensionMessage & { agenda: MeetingAgenda }).agenda);
                    break;
                case 'changeStrategy':
                    this.logger.info(`Strategy changed to: ${(message as WebviewToExtensionMessage & { strategy: OrchestrationStrategy }).strategy}`);
                    break;
                case 'assignRole': {
                    const assignMsg = message as WebviewToExtensionMessage & { role: CompanyRole; providerName: string };
                    this.orchestrator.assignRole(assignMsg.role, assignMsg.providerName);
                    break;
                }
                case 'sendPrompt': {
                    const promptMsg = message as WebviewToExtensionMessage & { prompt: string };
                    await this.orchestrator.execute({
                        prompt: promptMsg.prompt,
                        strategy: OrchestrationStrategy.Collaborative,
                    });
                    break;
                }
                case 'ready':
                    this.sendStateUpdate();
                    break;
                default: {
                    // Handle onboarding messages
                    const raw = message as Record<string, unknown>;
                    if (raw['type'] === 'openProviderSettings') {
                        void vscode.commands.executeCommand(
                            'workbench.action.openSettings',
                            `cramEssential.${raw['provider']}.apiKey`
                        );
                    } else if (raw['type'] === 'openExternalLink') {
                        void vscode.env.openExternal(vscode.Uri.parse(String(raw['url'])));
                    } else if (raw['type'] === 'addCustomProvider') {
                        void vscode.commands.executeCommand(
                            'workbench.action.openSettings',
                            'cramEssential.customProviders'
                        );
                    } else if (raw['type'] === 'startFirstProject') {
                        void vscode.commands.executeCommand('cramEssential.startProject');
                    } else if (raw['type'] === 'openWelcome') {
                        WelcomePanel.show(this.extensionUri);
                    }
                }
            }
        } catch (err) {
            const errorMsg = handleError(err, this.logger, 'CRAM ESSENTIAL');
            this.postMessage({ type: 'log', level: LogLevel.Error, message: errorMsg });
        }
    }

    private sendStateUpdate(): void {
        const state = this.buildState();
        this.postMessage({ type: 'stateUpdate', state });
    }

    private buildState(): DashboardState {
        return {
            session: this.orchestrator.getSession(),
            providerStatuses: this.orchestrator.getProviderStatuses(),
            currentStrategy: OrchestrationStrategy.Collaborative,
            currentStage: null,
            meetingInProgress: false,
            recentDecisions: this.orchestrator.getDecisions().slice(-10),
            activeMeeting: null,
        };
    }

    private postMessage(message: ExtensionToWebviewMessage): void {
        void this.view?.webview.postMessage(message);
    }

    /** Onboarding HTML shown when no providers are configured. */
    private getOnboardingHtml(): string {
        return /*html*/ `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>CRAM ESSENTIAL Setup</title>
<style>
    :root {
        --bg: var(--vscode-editor-background);
        --fg: var(--vscode-editor-foreground);
        --border: var(--vscode-panel-border);
        --accent: var(--vscode-focusBorder);
        --input-bg: var(--vscode-input-background);
        --btn-bg: var(--vscode-button-background);
        --btn-fg: var(--vscode-button-foreground);
        --btn-hover: var(--vscode-button-hoverBackground);
        --muted: var(--vscode-descriptionForeground);
        --role-architect: var(--vscode-charts-blue);
        --role-developer: var(--vscode-charts-green);
        --role-reviewer: var(--vscode-charts-yellow);
        --success: var(--role-developer);
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: var(--vscode-font-family); color: var(--fg); background: var(--bg); padding: 12px; font-size: 13px; }

    .brand { text-align: center; padding: 16px 0 12px; }
    .brand h2 { font-size: 18px; letter-spacing: 2px; }
    .brand p { font-size: 11px; color: var(--muted); margin-top: 4px; }

    .subtitle { font-size: 14px; font-weight: bold; margin: 16px 0 10px; padding-bottom: 6px; border-bottom: 1px solid var(--border); }

    .provider-card { border: 1px solid var(--border); border-radius: 6px; padding: 12px; margin-bottom: 10px; }
    .provider-header { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
    .provider-icon { width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 14px; color: #fff; }
    .provider-icon.architect { background: var(--role-architect); }
    .provider-icon.developer { background: var(--role-developer); }
    .provider-icon.reviewer { background: var(--role-reviewer); }
    .provider-name { font-weight: bold; flex: 1; }
    .status-badge { font-size: 10px; padding: 2px 8px; border-radius: 10px; background: var(--input-bg); color: var(--muted); }
    .status-badge.configured { background: var(--vscode-editor-inactiveSelectionBackground); color: var(--success); }

    .provider-actions { display: flex; gap: 8px; align-items: center; }
    .provider-actions button {
        background: var(--btn-bg); color: var(--btn-fg); border: none; border-radius: 4px;
        padding: 5px 12px; font-size: 11px; cursor: pointer;
    }
    .provider-actions button:hover { background: var(--btn-hover); }
    .provider-actions a {
        font-size: 11px; color: var(--accent); cursor: pointer; text-decoration: none;
    }
    .provider-actions a:hover { text-decoration: underline; }

    .custom-card { border: 1px dashed var(--border); border-radius: 6px; padding: 12px; margin-bottom: 10px; text-align: center; cursor: pointer; }
    .custom-card:hover { background: var(--input-bg); }
    .custom-card .plus { font-size: 24px; color: var(--accent); }
    .custom-card p { font-size: 11px; color: var(--muted); margin-top: 4px; }

    .start-section { text-align: center; padding: 16px 0; }
    .start-section button {
        background: var(--btn-bg); color: var(--btn-fg); border: none; border-radius: 6px;
        padding: 10px 24px; font-size: 13px; cursor: pointer;
    }
    .start-section button:hover { background: var(--btn-hover); }

    .welcome-link { text-align: center; padding: 8px 0; }
    .welcome-link a { font-size: 11px; color: var(--accent); cursor: pointer; text-decoration: none; }
    .welcome-link a:hover { text-decoration: underline; }
</style>
</head>
<body>
    <div class="brand">
        <h2>CRAM ESSENTIAL</h2>
        <p>A Software Development Building Companions</p>
    </div>

    <div class="subtitle">Setup Your AI Team</div>

    <!-- Claude -->
    <div class="provider-card">
        <div class="provider-header">
            <div class="provider-icon architect">C</div>
            <span class="provider-name">Claude</span>
            <span class="status-badge" id="claude-status">Not configured</span>
        </div>
        <div class="provider-actions">
            <button onclick="addKey('claude')">+ Add API Key</button>
            <a onclick="openLink('https://console.anthropic.com/')">Get key &#x2197;</a>
        </div>
    </div>

    <!-- GPT-4 -->
    <div class="provider-card">
        <div class="provider-header">
            <div class="provider-icon developer">G</div>
            <span class="provider-name">GPT-4</span>
            <span class="status-badge" id="gpt-status">Not configured</span>
        </div>
        <div class="provider-actions">
            <button onclick="addKey('gpt')">+ Add API Key</button>
            <a onclick="openLink('https://platform.openai.com/api-keys')">Get key &#x2197;</a>
        </div>
    </div>

    <!-- Gemini -->
    <div class="provider-card">
        <div class="provider-header">
            <div class="provider-icon reviewer">G</div>
            <span class="provider-name">Gemini</span>
            <span class="status-badge" id="gemini-status">Not configured</span>
        </div>
        <div class="provider-actions">
            <button onclick="addKey('gemini')">+ Add API Key</button>
            <a onclick="openLink('https://aistudio.google.dev/apikey')">Get key &#x2197;</a>
        </div>
    </div>

    <!-- Custom Provider -->
    <div class="custom-card" onclick="addCustom()">
        <div class="plus">+</div>
        <strong>Add Custom Provider</strong>
        <p>Ollama, Mistral, Cohere, LM Studio, or any OpenAI-compatible API</p>
    </div>

    <div class="start-section" id="startSection" style="display:none;">
        <button onclick="startFirst()">Start Your First Project</button>
    </div>

    <div class="welcome-link">
        <a onclick="showWelcome()">View Welcome Guide</a>
    </div>

    <script>
        const vscode = acquireVsCodeApi();

        function addKey(provider) { vscode.postMessage({ type: 'openProviderSettings', provider }); }
        function openLink(url) { vscode.postMessage({ type: 'openExternalLink', url }); }
        function addCustom() { vscode.postMessage({ type: 'addCustomProvider' }); }
        function startFirst() { vscode.postMessage({ type: 'startFirstProject' }); }
        function showWelcome() { vscode.postMessage({ type: 'openWelcome' }); }

        window.addEventListener('message', (event) => {
            const msg = event.data;
            if (msg.type === 'stateUpdate' && msg.state) {
                const statuses = msg.state.providerStatuses || [];
                let anyConfigured = false;
                for (const s of statuses) {
                    if (s.isConfigured) { anyConfigured = true; }
                    const el = document.getElementById(s.name + '-status');
                    if (el) {
                        el.textContent = s.isConfigured ? 'Configured' : 'Not configured';
                        el.className = 'status-badge' + (s.isConfigured ? ' configured' : '');
                    }
                }
                document.getElementById('startSection').style.display = anyConfigured ? 'block' : 'none';
            }
        });

        vscode.postMessage({ type: 'ready' });
    </script>
</body>
</html>`;
    }

    /** Dashboard HTML shown when at least one provider is configured. */
    private getDashboardHtml(): string {
        return /*html*/ `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CRAM ESSENTIAL</title>
    <style>
        :root {
            --bg: var(--vscode-editor-background);
            --fg: var(--vscode-editor-foreground);
            --border: var(--vscode-panel-border);
            --accent: var(--vscode-focusBorder);
            --input-bg: var(--vscode-input-background);
            --input-fg: var(--vscode-input-foreground);
            --btn-bg: var(--vscode-button-background);
            --btn-fg: var(--vscode-button-foreground);
            --btn-hover: var(--vscode-button-hoverBackground);
            --badge-bg: var(--vscode-badge-background);
            --badge-fg: var(--vscode-badge-foreground);
            --role-architect: var(--vscode-charts-blue);
            --role-developer: var(--vscode-charts-green);
            --role-reviewer: var(--vscode-charts-yellow);
            --role-other: var(--vscode-charts-purple);
            --success: var(--role-developer);
            --warning: var(--role-reviewer);
            --error: var(--vscode-charts-red);
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: var(--vscode-font-family); color: var(--fg); background: var(--bg); padding: 8px; font-size: 13px; }
        .section { margin-bottom: 16px; border: 1px solid var(--border); border-radius: 4px; overflow: hidden; }
        .section-header { padding: 8px 12px; background: var(--input-bg); font-weight: bold; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; display: flex; justify-content: space-between; align-items: center; }
        .providers { display: flex; gap: 8px; padding: 8px; flex-wrap: wrap; }
        .provider-card { display: flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 12px; background: var(--input-bg); font-size: 12px; }
        .status-dot { width: 8px; height: 8px; border-radius: 50%; }
        .status-dot.ok { background: var(--success); }
        .status-dot.err { background: var(--error); }
        .status-dot.off { background: var(--border); }
        .pipeline { padding: 8px; }
        .pipeline-stages { display: flex; gap: 4px; }
        .stage { flex: 1; text-align: center; padding: 6px 4px; border-radius: 4px; background: var(--input-bg); font-size: 10px; position: relative; }
        .stage.active { background: var(--accent); color: var(--btn-fg); }
        .stage.done { background: var(--success); color: #000; }
        .chat { padding: 0; max-height: 400px; overflow-y: auto; }
        .chat-msg { padding: 8px 12px; border-bottom: 1px solid var(--border); }
        .chat-role { font-weight: bold; font-size: 11px; margin-bottom: 2px; }
        .chat-role.architect { color: var(--role-architect); }
        .chat-role.developer { color: var(--success); }
        .chat-role.reviewer { color: var(--warning); }
        .chat-role.other { color: var(--role-other); }
        .chat-content { font-size: 12px; line-height: 1.5; white-space: pre-wrap; }
        .input-area { padding: 8px; }
        .input-row { display: flex; gap: 6px; margin-bottom: 6px; }
        textarea { width: 100%; min-height: 60px; background: var(--input-bg); color: var(--input-fg); border: 1px solid var(--border); border-radius: 4px; padding: 8px; font-family: inherit; font-size: 12px; resize: vertical; }
        input[type="text"] { flex: 1; background: var(--input-bg); color: var(--input-fg); border: 1px solid var(--border); border-radius: 4px; padding: 6px 8px; font-size: 12px; }
        select { background: var(--input-bg); color: var(--input-fg); border: 1px solid var(--border); border-radius: 4px; padding: 6px 8px; font-size: 12px; }
        button { background: var(--btn-bg); color: var(--btn-fg); border: none; border-radius: 4px; padding: 6px 14px; font-size: 12px; cursor: pointer; }
        button:hover { background: var(--btn-hover); }
        button.secondary { background: var(--input-bg); color: var(--fg); border: 1px solid var(--border); }
        .decision-list { padding: 8px; }
        .decision-item { padding: 6px 0; border-bottom: 1px solid var(--border); font-size: 12px; }
        .decision-title { font-weight: bold; }
        .decision-meta { color: var(--vscode-descriptionForeground); font-size: 11px; }
        .team-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; padding: 8px; }
        .team-member { display: flex; justify-content: space-between; padding: 4px 8px; background: var(--input-bg); border-radius: 4px; font-size: 11px; }
        .empty { padding: 16px; text-align: center; color: var(--vscode-descriptionForeground); font-size: 12px; }
    </style>
</head>
<body>
    <div class="section">
        <div class="section-header">AI Providers</div>
        <div class="providers" id="providers"></div>
    </div>
    <div class="section">
        <div class="section-header">SDLC Pipeline</div>
        <div class="pipeline">
            <div class="pipeline-stages" id="pipeline">
                <div class="stage" data-stage="discovery">Discovery</div>
                <div class="stage" data-stage="architecture">Architecture</div>
                <div class="stage" data-stage="implementation">Implementation</div>
                <div class="stage" data-stage="quality_assurance">QA</div>
                <div class="stage" data-stage="seo_marketing">SEO</div>
                <div class="stage" data-stage="deployment">Deploy</div>
            </div>
        </div>
    </div>
    <div class="section">
        <div class="section-header">Start Project</div>
        <div class="input-area">
            <div class="input-row">
                <input type="text" id="projectName" placeholder="Project name..." />
                <select id="strategy">
                    <option value="collaborative">Collaborative</option>
                    <option value="sequential">Sequential</option>
                    <option value="parallel">Parallel</option>
                    <option value="competitive">Competitive</option>
                </select>
            </div>
            <textarea id="projectDesc" placeholder="Describe your project... (e.g., 'Build an e-commerce site with user auth, product catalog, and payment processing')"></textarea>
            <div class="input-row" style="margin-top:6px">
                <button id="btnStart">Start Company Project</button>
                <button id="btnStop" class="secondary">Stop</button>
            </div>
        </div>
    </div>
    <div class="section">
        <div class="section-header">
            <span>Meeting Chat</span>
            <span id="meetingStatus" style="font-size:11px;font-weight:normal"></span>
        </div>
        <div class="chat" id="chat">
            <div class="empty">Start a project to see AI team discussions here...</div>
        </div>
    </div>
    <div class="section">
        <div class="section-header">Decisions</div>
        <div class="decision-list" id="decisions">
            <div class="empty">No decisions yet</div>
        </div>
    </div>
    <div class="section">
        <div class="section-header">Company Team</div>
        <div class="team-grid" id="team"></div>
    </div>
    <script>
        const vscode = acquireVsCodeApi();
        let state = null;
        vscode.postMessage({ type: 'ready' });
        document.getElementById('btnStart').addEventListener('click', () => {
            const name = document.getElementById('projectName').value;
            const desc = document.getElementById('projectDesc').value;
            const strategy = document.getElementById('strategy').value;
            if (!name || !desc) { return; }
            clearChat();
            vscode.postMessage({ type: 'startProject', name, description: desc, strategy });
        });
        document.getElementById('btnStop').addEventListener('click', () => {
            vscode.postMessage({ type: 'stopProject' });
        });
        window.addEventListener('message', (event) => {
            const msg = event.data;
            switch (msg.type) {
                case 'stateUpdate':
                    state = msg.state;
                    renderProviders(state.providerStatuses);
                    renderTeam(state);
                    renderDecisions(state.recentDecisions);
                    break;
                case 'meetingTurn': appendChatMessage(msg.turn); break;
                case 'pipelineProgress': updatePipelineStage(msg.stage, msg.progress); break;
                case 'decision': appendDecision(msg.decision); break;
                case 'log': console.log('[' + msg.level + ']', msg.message); break;
            }
        });
        function renderProviders(statuses) {
            const el = document.getElementById('providers');
            if (!statuses || statuses.length === 0) { el.innerHTML = '<div class="empty">No providers configured</div>'; return; }
            el.innerHTML = statuses.map(s =>
                '<div class="provider-card"><div class="status-dot ' + (s.isConfigured ? (s.isHealthy ? 'ok' : 'err') : 'off') + '"></div><span>' + escapeHtml(s.name) + '</span></div>'
            ).join('');
        }
        function renderTeam(state) {
            const el = document.getElementById('team');
            if (!state || !state.session || !state.session.team) { el.innerHTML = '<div class="empty" style="grid-column:1/-1">No team assigned</div>'; return; }
            const assignments = state.session.team.assignments || [];
            el.innerHTML = assignments.map(a => '<div class="team-member"><span>' + escapeHtml(formatRole(a.role)) + '</span><span>' + escapeHtml(a.providerName) + '</span></div>').join('');
        }
        function renderDecisions(decisions) {
            const el = document.getElementById('decisions');
            if (!decisions || decisions.length === 0) { el.innerHTML = '<div class="empty">No decisions yet</div>'; return; }
            el.innerHTML = decisions.map(d => '<div class="decision-item"><div class="decision-title">' + escapeHtml(d.title) + '</div><div class="decision-meta">' + escapeHtml(formatRole(d.madeBy)) + ' | ' + escapeHtml(d.stage) + '</div></div>').join('');
        }
        function appendDecision(decision) {
            const el = document.getElementById('decisions');
            if (el.querySelector('.empty')) { el.innerHTML = ''; }
            el.insertAdjacentHTML('afterbegin', '<div class="decision-item"><div class="decision-title">' + escapeHtml(decision.title) + '</div><div class="decision-meta">' + escapeHtml(formatRole(decision.madeBy)) + ' | ' + escapeHtml(decision.stage) + '</div></div>');
        }
        function clearChat() {
            document.getElementById('chat').innerHTML = '';
            document.querySelectorAll('.stage').forEach(s => s.classList.remove('active', 'done'));
        }
        function appendChatMessage(turn) {
            const el = document.getElementById('chat');
            if (el.querySelector('.empty')) { el.innerHTML = ''; }
            const roleClass = getRoleClass(turn.role);
            const div = document.createElement('div');
            div.className = 'chat-msg';
            div.innerHTML = '<div class="chat-role ' + roleClass + '">' + escapeHtml(formatRole(turn.role)) + ' (' + escapeHtml(turn.providerName) + ') - Turn ' + escapeHtml(String(turn.turnNumber)) + '</div><div class="chat-content">' + escapeHtml(turn.message) + '</div>';
            el.appendChild(div);
            el.scrollTop = el.scrollHeight;
        }
        function updatePipelineStage(stage, progress) {
            const el = document.querySelector('[data-stage="' + stage + '"]');
            if (!el) return;
            if (progress >= 100) { el.classList.remove('active'); el.classList.add('done'); }
            else { el.classList.add('active'); }
        }
        function getRoleClass(role) {
            if (['ceo','cto','lead_architect'].includes(role)) return 'architect';
            if (['senior_developer','frontend_developer','backend_developer'].includes(role)) return 'developer';
            if (['qa_engineer','security_auditor','performance_engineer'].includes(role)) return 'reviewer';
            return 'other';
        }
        function formatRole(role) { return role.replace(/_/g, ' ').replace(/\\b\\w/g, c => c.toUpperCase()); }
        function escapeHtml(text) { const d = document.createElement('div'); d.textContent = text == null ? '' : String(text); return d.innerHTML; }
    </script>
</body>
</html>`;
    }
}
