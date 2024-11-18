import {
  isSharedApiConfig,
  PipelineFunctionConfig,
  ResolverConfig,
} from '../types/plugin';
import { Api } from './Api';

export class SyncConfig {
  constructor(
    private api: Api,
    private config: ResolverConfig | PipelineFunctionConfig,
  ) {}

  compile() {
    if (isSharedApiConfig(this.api.config)) {
      throw Error('Unable to set the sync config for a Shared AppsyncApi');
    }
    if (!this.api.naming) {
      throw Error('Unable to Load the naming module');
    }
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
