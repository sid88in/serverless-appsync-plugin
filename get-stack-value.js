function getServerlessStackName(service, provider) {
  return `${service.getServiceName()}-${provider.getStage()}`;
}

function getValue(service, provider, value, name) {
  if (typeof value === "string") {
    return Promise.resolve(value);
  } else if (typeof value.Ref === "string") {
    return provider
      .request(
        "CloudFormation",
        "listStackResources",
        {
          StackName: getServerlessStackName(service, provider)
        },
        provider.getStage(),
        provider.getRegion()
      )
      .then(result => {
        const resource = result.StackResourceSummaries.find(
          r => r.LogicalResourceId === value.Ref
        );
        if (!resource) {
          throw new Error(`${name}: Ref "${value.Ref} not found`);
        }

        return resource.PhysicalResourceId;
      });
  } else {
    return Promise.reject(`${value} is not a valid ${name}`);
  }
}

module.exports = {
  getServerlessStackName,
  getValue,
};