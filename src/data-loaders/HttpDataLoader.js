import axios from 'axios';
import { isObject, forEach } from 'lodash';

const paramsSerializer = (params) => {
  const parts = [];

  forEach(params, (value, key) => {
    if (value === null || typeof value === 'undefined') {
      return;
    }

    let k = key;
    let v = value;
    if (Array.isArray(v)) {
      k += '[]';
    } else {
      v = [v];
    }

    forEach(v, (val) => {
      let finalValue = val;
      if (isObject(finalValue)) {
        finalValue = JSON.stringify(finalValue);
      }
      parts.push(`${k}=${finalValue}`);
    });
  });

  return parts.join('&');
};

export default class HttpDataLoader {
  constructor(config) {
    this.config = config;
  }

  async load(req) {
    try {
      const { data, status, headers } = await axios.request({
        baseURL: this.config.endpoint,
        validateStatus: false,
        url: req.resourcePath,
        headers: req.params.headers,
        params: req.params.query,
        paramsSerializer,
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
