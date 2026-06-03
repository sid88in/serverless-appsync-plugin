import { invokeModel } from '@aws-appsync/utils/ai';

export function request(ctx) {
  return invokeModel({
    modelId: 'amazon.nova-micro-v1:0',
    body: {
      inputText: `Summarize this text in less than 100 words:\n<text>${ctx.args.text}</text>`,
    },
  });
}

export function response(ctx) {
  return ctx.result.results;
}
