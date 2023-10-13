import { AppSyncConfig } from '../types';

export const basicConfig: AppSyncConfig = {
  name: 'My Api',
  authentication: {
    type: 'API_KEY',
  },
  dataSources: {},
  resolvers: {},
};
