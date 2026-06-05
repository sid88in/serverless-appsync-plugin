import { invokeModel } from '@aws-appsync/utils/ai';

export function request(ctx) {
  return invokeModel({
    modelId: 'eu.amazon.nova-micro-v1:0',
    body: {
      messages: [
        {
          role: 'user',
          content: [{ text: ctx.args.text }],
        },
      ],
    },
  });
}

export function response(ctx) {
  return ctx.result.output.message.content[0].text;
}
