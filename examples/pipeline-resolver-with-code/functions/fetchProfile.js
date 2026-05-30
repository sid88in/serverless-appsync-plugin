import { util, runtime } from '@aws-appsync/utils';

export function request(ctx) {
  // fetchUser returns null when the user isn't found; short-circuit the
  // pipeline function instead of dereferencing a null result.
  if (ctx.prev.result == null) {
    runtime.earlyReturn(null);
  }
  return {
    operation: 'GetItem',
    key: util.dynamodb.toMapValues({ userId: ctx.prev.result.id }),
  };
}

export function response(ctx) {
  if (ctx.prev.result == null) {
    return null;
  }
  return { ...ctx.prev.result, profile: ctx.result };
}
