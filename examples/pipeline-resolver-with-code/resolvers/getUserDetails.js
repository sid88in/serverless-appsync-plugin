// Top-level pipeline resolver: runs BEFORE the function chain in
// `request()` and AFTER all functions complete in `response()`.

import { util } from '@aws-appsync/utils';

export function request(ctx) {
  // Pre-flight validation: reject empty IDs before the pipeline runs
  if (!ctx.args.id) {
    util.error('Missing required argument: id');
  }
  return {};
}

export function response(ctx) {
  // ctx.prev.result is the output of the last function (fetchProfile)
  // which itself wove together the user and profile data.
  return ctx.prev.result;
}
