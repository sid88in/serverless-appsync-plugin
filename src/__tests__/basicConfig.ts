import { AppSyncConfigInput } from '../get-config';

export const config: AppSyncConfigInput = {
  name: 'My Api',
  authentication: {
    type: 'API_KEY',
  },
  dataSources: [],
  mappingTemplates: [],
};
