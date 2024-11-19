import { AppSyncConfig } from '../types/index.js';

export const basicConfig: AppSyncConfig = {
  name: 'My Api',
  authentication: {
    type: 'API_KEY',
  },
  dataSources: {},
  resolvers: {},
};
