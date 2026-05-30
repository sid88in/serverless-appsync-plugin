export function request(ctx) {
  // ctx.env.LOG_LEVEL would be 'info' at runtime
  console.log('Log level:', ctx.env?.LOG_LEVEL);
  return { payload: null };
}

export function response(ctx) {
  return { id: ctx.args.id, name: 'Mock User' };
}
