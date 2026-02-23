import { BaseProvider } from '../../ai-providers/BaseProvider';
import {
    OrchestrationRequest,
    OrchestrationResult,
    StrategyConfig,
    OrchestratorEvent,
} from '../../types';

/** Interface that all orchestration strategies must implement */
export interface IStrategy {
    readonly name: string;

    execute(
        request: OrchestrationRequest,
        providers: ReadonlyMap<string, BaseProvider>,
        config: StrategyConfig,
        onEvent: (event: OrchestratorEvent) => void
    ): Promise<OrchestrationResult>;
}
