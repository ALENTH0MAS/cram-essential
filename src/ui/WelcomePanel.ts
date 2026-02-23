import * as vscode from 'vscode';

/**
 * Welcome/Landing page shown on first install.
 * Opens as a full editor tab with branding, feature overview, and setup links.
 */
export class WelcomePanel {
    public static readonly viewType = 'cramEssential.welcome';
    private static currentPanel: WelcomePanel | undefined;
    private readonly panel: vscode.WebviewPanel;
    private readonly disposables: vscode.Disposable[] = [];

    /** Open (or reveal) the welcome panel. */
    public static show(extensionUri: vscode.Uri): void {
        if (WelcomePanel.currentPanel) {
            WelcomePanel.currentPanel.panel.reveal(vscode.ViewColumn.One);
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            WelcomePanel.viewType,
            'Welcome to CRAM ESSENTIAL',
            vscode.ViewColumn.One,
            { enableScripts: true, localResourceRoots: [extensionUri] }
        );

        WelcomePanel.currentPanel = new WelcomePanel(panel, extensionUri);
    }

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
        void extensionUri;
        this.panel = panel;
        this.panel.webview.html = this.getHtml();

        this.panel.onDidDispose(() => {
            WelcomePanel.currentPanel = undefined;
            this.disposables.forEach((d) => d.dispose());
        }, null, this.disposables);

        this.panel.webview.onDidReceiveMessage(
            (msg) => {
                switch (msg.type) {
                    case 'openSettings':
                        vscode.commands.executeCommand(
                            'workbench.action.openSettings',
                            `cramEssential.${msg.provider}.apiKey`
                        );
                        break;
                    case 'getStarted':
                        vscode.commands.executeCommand('cramEssential.sidebar.focus');
                        break;
                    case 'openExternal':
                        vscode.env.openExternal(vscode.Uri.parse(msg.url));
                        break;
                }
            },
            null,
            this.disposables
        );
    }

    private getHtml(): string {
        return /*html*/ `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Welcome to CRAM ESSENTIAL</title>
<style>
    :root {
        --bg: var(--vscode-editor-background);
        --fg: var(--vscode-editor-foreground);
        --border: var(--vscode-panel-border);
        --accent: var(--vscode-focusBorder);
        --muted: var(--vscode-descriptionForeground);
        --input-bg: var(--vscode-input-background);
        --btn-bg: var(--vscode-button-background);
        --btn-fg: var(--vscode-button-foreground);
        --btn-hover: var(--vscode-button-hoverBackground);
        --role-architect: var(--vscode-charts-blue);
        --role-developer: var(--vscode-charts-green);
        --role-reviewer: var(--vscode-charts-yellow);
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: var(--vscode-font-family); color: var(--fg); background: var(--bg); line-height: 1.6; }
    .container { max-width: 820px; margin: 0 auto; padding: 48px 32px; }

    /* Hero */
    .hero { text-align: center; padding-bottom: 40px; border-bottom: 1px solid var(--border); margin-bottom: 40px; }
    .hero-icon { font-size: 64px; margin-bottom: 8px; }
    .hero h1 { font-size: 36px; letter-spacing: 3px; margin-bottom: 8px; }
    .hero .tagline { font-size: 16px; color: var(--muted); font-style: italic; margin-bottom: 16px; }
    .hero p { font-size: 14px; color: var(--muted); max-width: 600px; margin: 0 auto; }

    /* Sections */
    section { margin-bottom: 40px; }
    section h2 { font-size: 22px; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 1px solid var(--border); }

    /* Team cards */
    .team-cards { display: flex; gap: 20px; justify-content: center; flex-wrap: wrap; }
    .team-card { flex: 1; min-width: 200px; max-width: 240px; border: 1px solid var(--border); border-radius: 8px; padding: 20px; text-align: center; }
    .team-card .icon { font-size: 32px; margin-bottom: 8px; }
    .team-card h3 { margin-bottom: 4px; font-size: 16px; }
    .team-card p { font-size: 12px; color: var(--muted); }
    .team-card .provider-tag { display: inline-block; margin-top: 8px; padding: 2px 10px; border-radius: 10px; font-size: 11px; }
    .team-card.architect { border-top: 3px solid var(--role-architect); }
    .team-card.architect .provider-tag { background: var(--vscode-editor-inactiveSelectionBackground); color: var(--role-architect); }
    .team-card.developer { border-top: 3px solid var(--role-developer); }
    .team-card.developer .provider-tag { background: var(--vscode-editor-inactiveSelectionBackground); color: var(--role-developer); }
    .team-card.reviewer { border-top: 3px solid var(--role-reviewer); }
    .team-card.reviewer .provider-tag { background: var(--vscode-editor-inactiveSelectionBackground); color: var(--role-reviewer); }

    /* Strategy grid */
    .strategy-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .strategy-card { border: 1px solid var(--border); border-radius: 8px; padding: 16px; }
    .strategy-card h4 { margin-bottom: 4px; color: var(--accent); }
    .strategy-card p { font-size: 12px; color: var(--muted); }

    /* Pipeline */
    .pipeline-flow { display: flex; align-items: center; justify-content: center; gap: 0; flex-wrap: wrap; padding: 16px 0; }
    .pipeline-stage { padding: 10px 14px; border-radius: 6px; background: var(--input-bg); text-align: center; font-size: 12px; font-weight: bold; }
    .pipeline-arrow { padding: 0 6px; color: var(--muted); font-size: 18px; }

    /* Setup cards */
    .setup-cards { display: flex; gap: 16px; justify-content: center; flex-wrap: wrap; }
    .setup-card { border: 1px solid var(--border); border-radius: 8px; padding: 20px; min-width: 180px; text-align: center; cursor: pointer; transition: background 0.15s; }
    .setup-card:hover { background: var(--vscode-list-hoverBackground); }
    .setup-card .icon { font-size: 28px; margin-bottom: 6px; }
    .setup-card .icon.architect { color: var(--role-architect); }
    .setup-card .icon.developer { color: var(--role-developer); }
    .setup-card .icon.reviewer { color: var(--role-reviewer); }
    .setup-card h4 { margin-bottom: 2px; }
    .setup-card .url { font-size: 11px; color: var(--muted); margin-bottom: 8px; }

    /* Buttons */
    .btn { display: inline-block; padding: 12px 32px; border-radius: 6px; font-size: 14px; cursor: pointer; border: none; }
    .btn-primary { background: var(--btn-bg); color: var(--btn-fg); }
    .btn-primary:hover { background: var(--btn-hover); }
    .btn-outline { background: transparent; color: var(--fg); border: 1px solid var(--border); padding: 8px 20px; font-size: 12px; border-radius: 4px; cursor: pointer; }
    .btn-outline:hover { background: var(--input-bg); }

    .center { text-align: center; }
    .mt-16 { margin-top: 16px; }
    .note { font-size: 12px; color: var(--muted); text-align: center; margin-top: 12px; }

    /* Roles section */
    .roles-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-top: 12px; }
    .role-chip { padding: 6px 10px; border-radius: 4px; background: var(--input-bg); font-size: 11px; text-align: center; }
</style>
</head>
<body>
<div class="container">
    <!-- HERO -->
    <section class="hero">
        <div class="hero-icon">&#x1F3D7;&#xFE0F;</div>
        <h1>CRAM ESSENTIAL</h1>
        <p class="tagline">A Software Development Building Companions</p>
        <p>Orchestrate multiple AI models as a virtual software development company. Your AI team designs, codes, reviews, tests, and deploys - all inside VS Code.</p>
        <div class="mt-16">
            <button class="btn btn-primary" onclick="scrollTo('setup')">Get Started</button>
        </div>
    </section>

    <!-- YOUR AI TEAM -->
    <section>
        <h2>Your AI Team</h2>
        <div class="team-cards">
            <div class="team-card architect">
                <div class="icon">&#x1F3D7;&#xFE0F;</div>
                <h3>Architect</h3>
                <p>Designs system architecture, makes technical decisions, plans components</p>
                <span class="provider-tag">Claude</span>
            </div>
            <div class="team-card developer">
                <div class="icon">&#x1F4BB;</div>
                <h3>Developer</h3>
                <p>Implements features, writes production code, optimizes algorithms</p>
                <span class="provider-tag">GPT-4</span>
            </div>
            <div class="team-card reviewer">
                <div class="icon">&#x1F50D;</div>
                <h3>Reviewer</h3>
                <p>Reviews code quality, finds security issues, tests edge cases</p>
                <span class="provider-tag">Gemini</span>
            </div>
        </div>
        <div class="note">12 company roles total: CEO, CTO, Lead Architect, Senior Developer, Frontend Dev, Backend Dev, QA Engineer, Security Auditor, DevOps, SEO Specialist, Marketing Strategist, Performance Engineer</div>
        <div class="roles-grid">
            <div class="role-chip">CEO</div>
            <div class="role-chip">CTO</div>
            <div class="role-chip">Lead Architect</div>
            <div class="role-chip">Senior Dev</div>
            <div class="role-chip">Frontend Dev</div>
            <div class="role-chip">Backend Dev</div>
            <div class="role-chip">QA Engineer</div>
            <div class="role-chip">Security</div>
            <div class="role-chip">DevOps</div>
            <div class="role-chip">SEO</div>
            <div class="role-chip">Marketing</div>
            <div class="role-chip">Performance</div>
        </div>
    </section>

    <!-- STRATEGIES -->
    <section>
        <h2>4 Orchestration Strategies</h2>
        <div class="strategy-grid">
            <div class="strategy-card">
                <h4>Collaborative</h4>
                <p>Architect designs &#x2192; Developer implements &#x2192; Reviewer critiques &#x2192; Developer refines. Iterates until consensus.</p>
            </div>
            <div class="strategy-card">
                <h4>Sequential</h4>
                <p>Pipeline: each AI builds on the previous one's output, producing progressively refined results.</p>
            </div>
            <div class="strategy-card">
                <h4>Parallel</h4>
                <p>All AIs work independently in parallel, then one AI synthesizes the best elements into a unified answer.</p>
            </div>
            <div class="strategy-card">
                <h4>Competitive</h4>
                <p>AIs compete independently, then a judge scores each on correctness, quality, and creativity. Best wins.</p>
            </div>
        </div>
    </section>

    <!-- SDLC PIPELINE -->
    <section>
        <h2>Full SDLC Pipeline</h2>
        <div class="pipeline-flow">
            <div class="pipeline-stage">Discovery</div>
            <span class="pipeline-arrow">&#x2192;</span>
            <div class="pipeline-stage">Architecture</div>
            <span class="pipeline-arrow">&#x2192;</span>
            <div class="pipeline-stage">Implementation</div>
            <span class="pipeline-arrow">&#x2192;</span>
            <div class="pipeline-stage">QA</div>
            <span class="pipeline-arrow">&#x2192;</span>
            <div class="pipeline-stage">SEO / Marketing</div>
            <span class="pipeline-arrow">&#x2192;</span>
            <div class="pipeline-stage">Deployment</div>
        </div>
        <p class="note">Each stage runs a meeting with your AI team. They debate, @mention each other, make decisions, and produce artifacts.</p>
    </section>

    <!-- SETUP -->
    <section id="setup">
        <h2>Setup Your AI Team</h2>
        <div class="setup-cards">
            <div class="setup-card" onclick="openSettings('claude')">
                <div class="icon architect">C</div>
                <h4>Claude</h4>
                <div class="url">console.anthropic.com</div>
                <button class="btn-outline">Add API Key</button>
            </div>
            <div class="setup-card" onclick="openSettings('gpt')">
                <div class="icon developer">G</div>
                <h4>GPT-4</h4>
                <div class="url">platform.openai.com</div>
                <button class="btn-outline">Add API Key</button>
            </div>
            <div class="setup-card" onclick="openSettings('gemini')">
                <div class="icon reviewer">G</div>
                <h4>Gemini</h4>
                <div class="url">aistudio.google.dev</div>
                <button class="btn-outline">Add API Key</button>
            </div>
        </div>
        <p class="note">You only need ONE provider to get started. Add more for multi-AI collaboration.</p>
    </section>

    <div class="center" style="padding: 32px 0;">
        <button class="btn btn-primary" onclick="getStarted()">Open CRAM ESSENTIAL Sidebar</button>
    </div>
</div>

<script>
    const vscode = acquireVsCodeApi();
    function scrollTo(id) { document.getElementById(id).scrollIntoView({ behavior: 'smooth' }); }
    function openSettings(provider) { vscode.postMessage({ type: 'openSettings', provider }); }
    function getStarted() { vscode.postMessage({ type: 'getStarted' }); }
</script>
</body>
</html>`;
    }
}
