const DataLoader = require('dataloader');

const batchLoaders = {};

const getBatchDataResolver = (loaderName, resolver) => {
  if (batchLoaders[loaderName] === undefined) {
    batchLoaders[loaderName] = new DataLoader(resolver, { cache: false });
  }
  return batchLoaders[loaderName];
};

export default class LambdaDataLoader {
  constructor(config) {
    this.config = config;
  }

  async load(req) {
    try {
      let result;
      if (req.operation === 'BatchInvoke') {
        const dataLoader = getBatchDataResolver(this.config.name, this.config.invoke);
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
