import { ProviderConfig, CustomProviderConfig, ExtensionConfig } from '../types';
import { BaseProvider } from './BaseProvider';
import { ClaudeProvider } from './ClaudeProvider';
import { GPTProvider } from './GPTProvider';
import { GeminiProvider } from './GeminiProvider';
import { CustomProvider } from './CustomProvider';
import { ProviderRegistry } from './ProviderRegistry';
import { Logger } from '../utils/logger';

/**
 * Factory that creates provider instances and registers them in the registry.
 * Handles both built-in providers (Claude, GPT, Gemini) and custom providers.
 */
export class ProviderFactory {
    private static readonly logger = Logger.getInstance();

    /** Initialize all providers from extension config and register them */
    static initializeFromConfig(config: ExtensionConfig): ProviderRegistry {
        const registry = ProviderRegistry.getInstance();
        registry.clear();

        // Built-in providers — only register if API key is configured
        if (config.claude.apiKey) {
            registry.register(ProviderFactory.createClaude(config.claude));
        }
        if (config.gpt.apiKey) {
            registry.register(ProviderFactory.createGPT(config.gpt));
        }
        if (config.gemini.apiKey) {
            registry.register(ProviderFactory.createGemini(config.gemini));
        }

        // Custom providers
        for (const customConfig of config.customProviders) {
            try {
                registry.register(ProviderFactory.createCustom(customConfig));
            } catch (err) {
                ProviderFactory.logger.error(
                    `Failed to create custom provider "${customConfig.name}"`,
                    err instanceof Error ? err : undefined
                );
            }
        }

        ProviderFactory.logger.info(
            `Initialized ${registry.listNames().length} providers: ${registry.listNames().join(', ')}`
        );

        return registry;
    }

    static createClaude(config: ProviderConfig): BaseProvider {
        return new ClaudeProvider(config);
    }

    static createGPT(config: ProviderConfig): BaseProvider {
        return new GPTProvider(config);
    }

    static createGemini(config: ProviderConfig): BaseProvider {
        return new GeminiProvider(config);
    }

    static createCustom(config: CustomProviderConfig): BaseProvider {
        if (!config.name || !config.baseUrl || !config.model) {
            throw new Error(
                `Custom provider config invalid: name="${config.name}", baseUrl="${config.baseUrl}", model="${config.model}"`
            );
        }
        return new CustomProvider(config);
    }
}
