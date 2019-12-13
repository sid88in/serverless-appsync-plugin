import axios from 'axios';

export default class ElasticDataLoader {
  constructor(config) {
    this.config = config;
  }

  async load(req) {
    try {
      const { data } = await axios.request({
        baseURL: this.config.endpoint,
        url: req.path,
        headers: req.params.headers,
        params: req.params.queryString,
        method: req.operation.toLowerCase(),
        data: req.params.body,
      });

      return data;
    } catch (err) {
      console.log(err);
    }

    return null;
  }
}
