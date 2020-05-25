const DataLoader = require('dataloader');

const batchLoaders = {};

const getBatchDataResolver = (loaderName, resolver) => {
  if (batchLoaders[loaderName] === undefined) {
    batchLoaders[loaderName] = new DataLoader(resolver, { cache: false });
  }
  return batchLoaders[loaderName];
};

const getLoaderName = (payload, config) => {
  const parts = [config.name];
  if (payload?.info?.parentTypeName) {
    parts.push(payload.info.parentTypeName);
  }
  if (payload?.info?.fieldName) {
    parts.push(payload.info.fieldName);
  }
  return parts.join('.');
};

export default class LambdaDataLoader {
  constructor(config) {
    this.config = config;
  }

  async load(req) {
    try {
      let result;
      if (req.operation === 'BatchInvoke') {
        const dataLoader = getBatchDataResolver(
          getLoaderName(req.payload, this.config),
          this.config.invoke,
        );
        result = await dataLoader.load(req.payload);
      } else {
        result = await this.config.invoke(req.payload);
      }
      return result;
    } catch (e) {
      console.log('Lambda Data source failed with the following error');
      console.log(e);
      throw e;
    }
  }
}
