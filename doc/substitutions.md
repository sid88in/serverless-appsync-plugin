# Substitutions

Substitutions is a feature that allows you to replace some variables in your VTL mapping templates with dynamic values.

They are usually useful to replace parts of the template with resource names or ARNs coming from your IaC, such as a DynamoDB table names, for example; or the stage name, region name, etc.

## Quick start

```yaml
appSync:
  name: my-api
  substitutions: #global substitutions
    postsTable: !Ref Posts
    region: ${AWS::Region}
    foo: bar

  resolvers:
    Query.user:
      dataSource: my-table
      substitutions: #resolver substitutions
        someVariable: someValue
```

```vtl
#set($postsdata = [])
#foreach($item in ${ctx.args.posts})
    $util.qr($postsdata.add($util.dynamodb.toMapValues($item)))
#end
{
    "version" : "2018-05-29",
    "operation" : "BatchPutItem",
    "tables" : {
        "${postsTable}": $utils.toJson($postsdata)
    }
}
```

## Usage

Substutitions are defined as key-value pairs under the `appSync.substitutions`, `appSync.resolvers.[resolverName].substitutions` or `appSync.pipelineFunctions.[functionName].substitutions` attributes.

Global substitutions are available globally to all mapping templates. Resovler and Pipeline funciton substitutions are only available where they are defined. Resolver and Pipeline function substitutions take precedence over global substitutions (values will be overwritten).

Once defined, you can then use them within the mapping templates as if they were VTL variables. At deployment time, variables will be substituted with their corresponding value.

```yaml
appSync:
  name: my-api
  substitutions:
    postsTable: !Ref Posts
```

In the mapping template:

```vtl
{
    "version" : "2018-05-29",
    "operation" : "BatchPutItem",
    "tables" : {
        "${postsTable}": [...]
    }
}
```
