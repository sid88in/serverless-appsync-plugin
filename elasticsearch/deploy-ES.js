// Load the SDK for JavaScript
const AWS = require('aws-sdk');
// Set the region
AWS.config.update({ region: 'us-east-1' });
AWS.config.setPromisesDependency(require('bluebird'));

const appsync = new AWS.AppSync({ apiVersion: '2017-07-25' });

// For creating User Pool: Reference https://serverless-stack.com/chapters/create-a-cognito-user-pool.html
// API key is not recommended for security.
// Can we automate the process of creating cognito user pool

//Todo: how to create this service role via serverless.yml automatically

const graphQLAPIName = 'xxx';
const awsRegion = 'us-east-1';
const userPoolId = 'xxx';
const dataSourceName = 'xxx';
const dataSourceTable = 'xxx';
const serviceRole = 'arn:aws:iam::xxx:role/service-role/xxx';
const MAX_RETRIES = 10;
const esEndpoint = 'https://xxx.xxx.es.amazonaws.com'
let appId;
let graphqlEndpoint;


function wait (timeout) {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve()
        }, timeout)
    })
}

const createGraphQLAPIParams = {
    authenticationType: 'AMAZON_COGNITO_USER_POOLS' /* required */,
    name: graphQLAPIName /* required */,
    userPoolConfig: {
        awsRegion: awsRegion /* required */,
        defaultAction: 'ALLOW' /* required */,
        userPoolId: userPoolId /* required */,
    },
};

/* STEP 1 : Create GRAPHQL EndPoint */
appsync
    .createGraphqlApi(createGraphQLAPIParams)
    .promise()
    .then(function(data) {
        console.log(data); // successful response
        console.log(data['graphqlApi']['apiId']);
        console.log(data['graphqlApi']['uris']['GRAPHQL']);

        appId = data['graphqlApi']['apiId'];
        graphqlEndpoint = data['graphqlApi']['uris']['GRAPHQL'];

        const datasourceParams = {
            apiId: appId /* required */,
            name: dataSourceName /* required */,
            type: 'AMAZON_ELASTICSEARCH' /* required */,
            description: 'my first data source',
            elasticsearchConfig: {
                awsRegion: 'us-east-1' /* required */,
                endpoint: esEndpoint /* required */,
            },
            serviceRoleArn: serviceRole
        };

        /* STEP 2 : Attach DataSources to GRAPHQL EndPoint */
        return appsync.createDataSource(datasourceParams).promise();
    })
    .then(function(data) {
        console.log(data);

        const schemaCreationparams = {
            apiId: appId /* required */,
            definition: '' // Todo: read this schema from text file.
        };

        /* STEP 3 : Create GraphQL Schema */
        return appsync.startSchemaCreation(schemaCreationparams).promise();
    })
    .then(async function(data) {
        console.log(data);

        const schemaCreationparams = {
            apiId: appId /* required */,
        };

        for (let i = 0; i <= MAX_RETRIES; i++) {
            try {

                let success = false;

                await appsync.getSchemaCreationStatus(schemaCreationparams).promise().then(function (data) {
                    console.log(data);
                    if(data['status'] === 'SUCCESS') {
                        success = true;
                    }
                });

                if (success)
                    break;

            } catch (err) {
                const timeout = Math.pow(2, i) * 1000;
                //const timeout = 5000;
                console.log('Waiting', timeout, 'ms');
                await wait(timeout);
                console.log('Retrying', err.message, i);
            }
        }

    })
    .then(function() {

        const getSchemaParams = {
            apiId: appId /* required */,
            format: 'SDL' /* required */,
        };

        /* STEP 4 : GET Schema for GraphQL Endpoint */
        return appsync.getIntrospectionSchema(getSchemaParams).promise();
    })
    .then(function(data) {
        console.log(data); // successful response

        const schema = new Buffer(data.schema, 'base64');
        console.log(schema.toString());
    })
    .then(function() {

        const resolverParams = {
            apiId: appId /* required */,
            dataSourceName: dataSourceName /* required */,
            fieldName: 'getTwitterFeed' /* required */,
            requestMappingTemplate: '', /* Todo: read this template from text file. required */
            typeName: 'Query' /* required */,
            responseMappingTemplate: '', /* Todo: read this template from text file. required */
        };

        /* STEP 5 : Create Resolvers */
        return appsync.createResolver(resolverParams).promise();
    })
    .then(function(data) {
        console.log(data);

        const listParams = {
            apiId: appId /* required */,
            format: 'SDL' /* required */,
        };

        return appsync.listTypes(listParams).promise();
    })
    .then(function(data) {
        console.log(data);
    })
    .catch(function(err) {
        console.log(err);
    });
