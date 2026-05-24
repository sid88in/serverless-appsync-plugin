export function request() {
  return { operation: 'Scan' };
}

export function response(ctx) {
  return ctx.result.items;
}
