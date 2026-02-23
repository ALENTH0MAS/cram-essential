import * as vscode from 'vscode';
import {
    ExtensionConfig,
    ProviderConfig,
    CustomProviderConfig,
    OrchestrationStrategy,
    LogLevel,
} from '../types';

/** Read extension configuration from VS Code settings */
export function readConfig(): ExtensionConfig {
    const config = vscode.workspace.getConfiguration('cramEssential');

    const maxTokens = config.get<number>('maxTokensPerRequest', 4096);
    const timeoutMs = config.get<number>('timeoutMs', 120000);

    return {
        claude: readProviderConfig(config, 'claude', maxTokens, timeoutMs),
        gpt: readProviderConfig(config, 'gpt', maxTokens, timeoutMs),
        gemini: readProviderConfig(config, 'gemini', maxTokens, timeoutMs),
        customProviders: readCustomProviders(config, maxTokens),
        defaultStrategy: config.get<OrchestrationStrategy>(
            'defaultStrategy',
            OrchestrationStrategy.Collaborative
        ),
        outputDir: config.get<string>('outputDir', '.cram-essential'),
        meetingMaxTurns: config.get<number>('meetingMaxTurns', 8),
        logLevel: config.get<LogLevel>('logLevel', LogLevel.Info),
    };
}

/** Watch for config changes and invoke callback */
export function watchConfig(callback: (config: ExtensionConfig) => void): vscode.Disposable {
    return vscode.workspace.onDidChangeConfiguration((event) => {
        if (event.affectsConfiguration('cramEssential')) {
            callback(readConfig());
        }
    });
}

function readProviderConfig(
    config: vscode.WorkspaceConfiguration,
    prefix: string,
    maxTokens: number,
    timeoutMs: number
): ProviderConfig {
    return {
        apiKey: config.get<string>(`${prefix}.apiKey`, ''),
        model: config.get<string>(`${prefix}.model`, ''),
        maxTokens,
        timeoutMs,
    };
}

function readCustomProviders(
    config: vscode.WorkspaceConfiguration,
    defaultMaxTokens: number
): readonly CustomProviderConfig[] {
    const raw = config.get<ReadonlyArray<Record<string, unknown>>>('customProviders', []);
    return raw.map((entry) => ({
        name: String(entry['name'] ?? ''),
        displayName: entry['displayName'] ? String(entry['displayName']) : undefined,
        baseUrl: String(entry['baseUrl'] ?? ''),
        apiKey: String(entry['apiKey'] ?? ''),
        model: String(entry['model'] ?? ''),
        maxTokens: typeof entry['maxTokens'] === 'number' ? entry['maxTokens'] : defaultMaxTokens,
    }));
}
