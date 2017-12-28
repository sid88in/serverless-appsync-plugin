# serverless-appsync-plugin
serverless plugin for appsync

# DynamoDB Integration

## Schema:

```
type Query {
  getTwitterFeed(handle: String!): Tweets
}

type Subscription {
  subscribeToTweeterUser(handle: String!): Tweets
    @aws_subscribe(mutations: ["createUserRecord"])
}

type Tweet {
  tweet: String
}

type Mutation {
  # Create a single tweet.
  createUserRecord(
    name: String!,
    screen_name: String!,
    location: String!,
    description: String!,
    followers_count: Int!,
    friends_count: Int!,
    favourites_count: Int!,
    posts: [String]
  ): Tweets
}

type Tweets {
  name: String!
  screen_name: String!
  location: String!
  description: String!
  followers_count: Int!
  friends_count: Int!
  favourites_count: Int!
  posts: [Tweet]
}

schema {
  query: Query
  mutation: Mutation
  subscription: Subscription
}

```

## Query:

```
query{
    getTwitterFeed(handle: "Charles.Hills"){
        name
        location
        description
        screen_name
        followers_count
        friends_count
        favourites_count
        posts {
            tweet
        }
    }
}
```

## Mutation:

```
mutation add {
  createUserRecord(
    name:"Siddharth",
    screen_name:"sidg_sid",
    description:"cool guy",
    location: "new delhi",
    favourites_count: 100,
    friends_count: 100,
    followers_count: 50,
    posts: ["hello", "girl", "im good"]
  ){
    name
    screen_name
    description
    location
    favourites_count
    friends_count
    followers_count
    posts{
      tweet
    }
  }
}
```

## Resolver for Mutation - createUserRecord

```
## Request mapping template

{
    "version": "2017-02-28",
    "operation": "PutItem",
    "key": {
        "screen_name": { "S": "$context.arguments.screen_name"}
    },
    "attributeValues": {
        "name": { "S": "$context.arguments.name" },
        "location": { "S": "$context.arguments.location" },
        "description": { "S": "$context.arguments.description" },
        "followers_count": { "N": $context.arguments.followers_count },
        "friends_count": { "N": $context.arguments.friends_count },
        "favourites_count": { "N": $context.arguments.favourites_count },
        #set($tweetList = [])
        #set($temp = [])
        #foreach ( $post in $context.arguments.posts )
          #set( $element =
          ${tweetList.add(
          { "M" : {
                "tweet" : { "S"  : $post }
             }
          })}
          )
        #end
        "posts": { "L" : $utils.toJson($tweetList) }
    }
}

## Response mapping template
$util.toJson($context.result)

```

## Resolver for Query : getTwitterFeed

```
##Request mapping template

{
    "version": "2017-02-28",
    "operation": "GetItem",
    "key": {
        "screen_name": { "S": "$context.arguments.handle" }
    }
}

##Response mapping template

$util.toJson($context.result)
```
