import * as vscode from 'vscode';
import { LogLevel } from '../types';

const LOG_LEVEL_PRIORITY: Readonly<Record<LogLevel, number>> = {
    [LogLevel.Debug]: 0,
    [LogLevel.Info]: 1,
    [LogLevel.Warn]: 2,
    [LogLevel.Error]: 3,
};

/** Singleton logger that writes to a VS Code OutputChannel */
export class Logger {
    private static instance: Logger | undefined;
    private readonly outputChannel: vscode.OutputChannel;
    private level: LogLevel;

    private constructor() {
        this.outputChannel = vscode.window.createOutputChannel('CRAM ESSENTIAL');
        this.level = LogLevel.Info;
    }

    static getInstance(): Logger {
        if (!Logger.instance) {
            Logger.instance = new Logger();
        }
        return Logger.instance;
    }

    setLevel(level: LogLevel): void {
        this.level = level;
    }

    debug(message: string, context?: Record<string, unknown>): void {
        this.log(LogLevel.Debug, message, context);
    }

    info(message: string, context?: Record<string, unknown>): void {
        this.log(LogLevel.Info, message, context);
    }

    warn(message: string, context?: Record<string, unknown>): void {
        this.log(LogLevel.Warn, message, context);
    }

    error(message: string, error?: Error, context?: Record<string, unknown>): void {
        const errorDetails = error
            ? ` | Error: ${error.message}${error.stack ? `\n${error.stack}` : ''}`
            : '';
        this.log(LogLevel.Error, `${message}${errorDetails}`, context);
    }

    show(): void {
        this.outputChannel.show();
    }

    dispose(): void {
        this.outputChannel.dispose();
        Logger.instance = undefined;
    }

    private log(level: LogLevel, message: string, context?: Record<string, unknown>): void {
        if (LOG_LEVEL_PRIORITY[level] < LOG_LEVEL_PRIORITY[this.level]) {
            return;
        }

        const timestamp = new Date().toISOString();
        const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
        const contextStr = context ? ` ${JSON.stringify(context)}` : '';
        this.outputChannel.appendLine(`${prefix} ${message}${contextStr}`);
    }
}
