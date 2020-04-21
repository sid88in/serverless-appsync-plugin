import axios from 'axios';

export default class HttpDataLoader {
  constructor(config) {
    this.config = config;
  }

  async load(req) {
    try {
      const { data, status, headers } = await axios.request({
        baseURL: this.config.endpoint,
        url: req.resourcePath,
        headers: req.params.headers,
        params: req.params.query,
        method: req.method.toLowerCase(),
        data: req.params.body,
      });

      return {
        headers,
        statusCode: status,
        body: JSON.stringify(data),
      };
    } catch (err) {
      console.log(err);
    }

    return null;
  }
}
