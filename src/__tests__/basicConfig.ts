import { AppSyncConfigInput } from '../get-config';

export const basicConfig: AppSyncConfigInput = {
  name: 'My Api',
  authentication: {
    type: 'API_KEY',
  },
  dataSources: [],
  resolvers: [],
};
