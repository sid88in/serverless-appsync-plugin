import { util } from '@aws-appsync/utils';

export function request() {
  return { payload: null };
}

export function response(ctx) {
  return {
    id: util.autoId(),
    text: ctx.args.text,
  };
}
