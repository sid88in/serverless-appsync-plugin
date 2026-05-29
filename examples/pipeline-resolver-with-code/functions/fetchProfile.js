import { util } from '@aws-appsync/utils';

export function request(ctx) {
  return {
    operation: 'GetItem',
    key: util.dynamodb.toMapValues({ userId: ctx.prev.result.id }),
  };
}

export function response(ctx) {
  return { ...ctx.prev.result, profile: ctx.result };
}
