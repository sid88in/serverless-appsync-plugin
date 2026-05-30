import { util } from '@aws-appsync/utils';

export function request(ctx) {
  return {
    operation: 'Query',
    query: {
      expression: 'userId = :userId',
      expressionValues: util.dynamodb.toMapValues({
        ':userId': ctx.prev.result.id,
      }),
    },
  };
}

export function response(ctx) {
  return { ...ctx.prev.result, posts: ctx.result.items };
}
