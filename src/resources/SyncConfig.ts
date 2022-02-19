import { O } from 'ts-toolbelt';
import { PipelineFunctionConfig, ResolverConfig } from '../types/plugin';
import { Api } from './Api';

export class SyncConfig {
  constructor(
    private api: Api,
    private config: ResolverConfig | PipelineFunctionConfig,
  ) {}

  compile() {
    if (!this.config.sync) {
      return undefined;
    }

    const {
      conflictDetection = 'VERSION',
      conflictHandler = 'OPTIMISTIC_CONCURRENCY',
    } = this.config.sync;
    return {
      ConflictDetection: conflictDetection,
      ...(conflictDetection === 'VERSION'
        ? {
            ConflictHandler: conflictHandler,
            ...(conflictHandler === 'LAMBDA'
              ? {
                  LambdaConflictHandlerConfig: {
                    LambdaConflictHandlerArn: this.api.getLambdaArn(
                      this.config.sync,
                      this.api.naming.getResolverEmbeddedSyncLambdaName(
                        this.config,
                      ),
                    ),
                  },
                }
              : {}),
          }
        : {}),
    };
  }
}
