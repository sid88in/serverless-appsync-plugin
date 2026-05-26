exports.authorize = async (event) => {
  return {
    isAuthorized: event.authorizationToken?.startsWith('Bearer '),
    resolverContext: {},
    deniedFields: [],
    ttlOverride: 0,
  };
};
