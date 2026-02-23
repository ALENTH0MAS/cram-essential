import * as vscode from 'vscode';
import { ProviderAuthError, ProviderRateLimitError } from '../types/errors';
import { Logger } from './logger';

/**
 * Handle user-facing and log-facing error reporting consistently across commands and webviews.
 * Returns the user-visible message so callers can forward it to webview logs if needed.
 */
export function handleError(
    err: unknown,
    logger: Logger,
    productName: string = 'CRAM ESSENTIAL'
): string {
    let userMessage: string;

    if (err instanceof ProviderAuthError) {
        userMessage = `Authentication failed for ${err.provider}. Check your API key in settings.`;
        void vscode.window.showErrorMessage(userMessage);
    } else if (err instanceof ProviderRateLimitError) {
        userMessage = `Rate limited by ${err.provider}. Try again in ${Math.round(err.retryAfterMs / 1000)}s.`;
        void vscode.window.showWarningMessage(userMessage);
    } else {
        const message = err instanceof Error ? err.message : String(err);
        userMessage = `${productName} Error: ${message}`;
        void vscode.window.showErrorMessage(userMessage);
    }

    logger.error('Command failed', err instanceof Error ? err : undefined);
    return userMessage;
}

