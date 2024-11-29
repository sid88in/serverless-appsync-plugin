import {
  isSharedApiConfig,
  PipelineFunctionConfig,
  ResolverConfig,
} from '../types/plugin.js';
import { Api } from './Api.js';

export class SyncConfig {
  constructor(
    private api: Api,
    private config: ResolverConfig | PipelineFunctionConfig,
  ) {}

  compile() {
    if (isSharedApiConfig(this.api.config)) {
      throw new this.api.plugin.serverless.classes.Error(
        'Unable to set the sync config for a Shared AppsyncApi',
      );
    }
    if (!this.api.naming) {
      throw new this.api.plugin.serverless.classes.Error(
        'Unable to Load the naming module',
      );
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
