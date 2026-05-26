exports.handler = async (event) => {
  return {
    id: 'mock-id',
    name: event.arguments.name,
    email: event.arguments.email,
  };
};
