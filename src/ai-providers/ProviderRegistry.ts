import { BaseProvider } from './BaseProvider';
import { ProviderStatus } from '../types';
import { Logger } from '../utils/logger';

/**
 * Singleton registry for all AI providers (built-in + custom).
 * Central place to register, retrieve, and manage provider instances.
 */
export class ProviderRegistry {
    private static instance: ProviderRegistry | undefined;
    private readonly providers: Map<string, BaseProvider> = new Map();
    private readonly logger = Logger.getInstance();

    private constructor() {}

    static getInstance(): ProviderRegistry {
        if (!ProviderRegistry.instance) {
            ProviderRegistry.instance = new ProviderRegistry();
        }
        return ProviderRegistry.instance;
    }

    /** Register a provider instance by name */
    register(provider: BaseProvider): void {
        if (this.providers.has(provider.name)) {
            this.logger.warn(`Provider "${provider.name}" is being replaced in registry`);
        }
        this.providers.set(provider.name, provider);
        this.logger.info(`Provider registered: ${provider.name} (${provider.type})`);
    }

    /** Remove a provider from the registry */
    unregister(name: string): boolean {
        const removed = this.providers.delete(name);
        if (removed) {
            this.logger.info(`Provider unregistered: ${name}`);
        }
        return removed;
    }

    /** Get a provider by name */
    get(name: string): BaseProvider | undefined {
        return this.providers.get(name);
    }

    /** Get a provider by name, throws if not found */
    getOrThrow(name: string): BaseProvider {
        const provider = this.providers.get(name);
        if (!provider) {
            throw new Error(`Provider "${name}" not found in registry. Available: ${this.listNames().join(', ')}`);
        }
        return provider;
    }

    /** Check if a provider is registered */
    has(name: string): boolean {
        return this.providers.has(name);
    }

    /** List all registered provider names */
    listNames(): readonly string[] {
        return Array.from(this.providers.keys());
    }

    /** List all registered providers */
    listAll(): readonly BaseProvider[] {
        return Array.from(this.providers.values());
    }

    /** Get status of all providers */
    getAllStatuses(): readonly ProviderStatus[] {
        return this.listAll().map((p) => p.getStatus());
    }

    /** Get the provider map (readonly view) */
    getProviderMap(): ReadonlyMap<string, BaseProvider> {
        return this.providers;
    }

    /** Clear all providers */
    clear(): void {
        this.providers.clear();
        this.logger.info('All providers cleared from registry');
    }

    /** Run health checks on all providers */
    async healthCheckAll(): Promise<ReadonlyMap<string, boolean>> {
        const results = new Map<string, boolean>();
        const checks = this.listAll().map(async (provider) => {
            const healthy = await provider.healthCheck();
            results.set(provider.name, healthy);
        });
        await Promise.allSettled(checks);
        return results;
    }

    /** Reset the singleton (for testing) */
    static reset(): void {
        ProviderRegistry.instance = undefined;
    }
}
