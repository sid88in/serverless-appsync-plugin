import { AppSyncConfigInput } from '../getAppSyncConfig';

export const basicConfig: AppSyncConfigInput = {
  name: 'My Api',
  authentication: {
    type: 'API_KEY',
  },
  dataSources: {},
  resolvers: {},
};
