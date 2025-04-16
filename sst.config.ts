/// <reference path="./.sst/platform/config.d.ts" />
import * as pulumi from "@pulumi/pulumi";
import createOsStack from "./pulumi/open-search-stack";

export default $config({
  app: (input) => {
    return {
      name: "hireable",
      removal: input?.stage === "production" ? "retain" : "remove",
      protect: ["production"].includes(input?.stage),
      home: "aws",
      providers: {
        aws: {
          profile:
            input.stage === "production"
              ? "hireable_production"
              : "hireable_dev",
        },
      },
    };
  },
  async run() {
    //Consts
    const openApiKey = new sst.Secret("OpenApiKey");
    const logoDevSearchToken = new sst.Secret("LogoDevSK");
    const logoDevFetchToken = new sst.Secret("LogoDevPK");

    const domain = "hireable.now";

    const stageConsts = new sst.Linkable("consts", {
      properties: {
        domain,
        region: aws.getRegionOutput().name,
        assistantId: "asst_oUvnV2d0qfR9IaiQUehoLQZT",
      },
    });

    const currentAccountId = await aws
      .getCallerIdentity()
      .then((id) => id.accountId);

    // Create a Route 53 Hosted Zone
    const hostedZone = await aws.route53.getZone({
      name: domain,
    });

    // S3
    sst.Linkable.wrap(aws.s3.BucketV2, (bucket) => ({
      properties: {
        bucketArn: bucket.arn,
        bucketName: bucket.id,
        bucketDomainName: bucket.bucketDomainName,
      },
    }));

    const emailArchiveBucket = new aws.s3.BucketV2("email-archive-s3", {
      bucket: `email-archive-${currentAccountId}`, // Unique name
    });

    //Tables
    const usersTable = new sst.aws.Dynamo("users-table", {
      fields: {
        user_name: "string",
        user_email: "string",
        app_email: "string",
      },
      primaryIndex: { hashKey: "user_name" },
      globalIndexes: {
        userEmailIndex: { hashKey: "user_email" },
        appEmailIndex: { hashKey: "app_email" },
      },
    });

    const categorizedEmailsTable = new sst.aws.Dynamo(
      "categorized-emails-table",
      {
        fields: {
          user_name: "string",
          id: "string",
          group_id: "string",
        },
        stream: "new-and-old-images",
        primaryIndex: { hashKey: "id" },
        globalIndexes: {
          userEmails: { hashKey: "user_name" },
          groupIdIndex: { hashKey: "group_id", rangeKey: "user_name" },
        },
      }
    );

    //Grouped Applications
    const groupedApplicationsTable = new sst.aws.Dynamo(
      "grouped-applications-table",
      {
        fields: {
          id: "string",
          company_title: "string",
          user_name: "string",
        },
        primaryIndex: { hashKey: "id" },
        stream: "new-image",
        globalIndexes: {
          companyTitleIndex: {
            hashKey: "user_name",
            rangeKey: "company_title",
          },
          companyIdIndex: { hashKey: "id", rangeKey: "user_name" },
        },
      }
    );

    //SQS
    const openApiQueueDLQ = new sst.aws.Queue(
      "open-api-processing-queue-DLQ",
      {}
    );
    const openApiQueue = new sst.aws.Queue("open-api-processing-queue", {
      dlq: {
        queue: openApiQueueDLQ.arn,
        retry: 3,
      },
    });
    const groupingDLQ = new sst.aws.Queue("grouping-DLQ", {});
    const groupingQueue = new sst.aws.Queue("grouping-queue", {
      dlq: {
        queue: groupingDLQ.arn,
        retry: 3,
      },
    });

    // Lambda

    const { opensearch } = createOsStack(currentAccountId);

    const categorizeEmailLambda = new sst.aws.Function("categorize-email", {
      handler: "functions/open-api-categorize.handler",
      link: [
        emailArchiveBucket,
        openApiQueue,
        groupingQueue,
        categorizedEmailsTable,
        opensearch,
        openApiKey,
        stageConsts,
      ],
      environment: {
        DRY_RUN: "0",
      },
    });

    const DefaultIamOpenSearchPolicy = await aws.iam.getPolicy({
      name: "AmazonOpenSearchServiceFullAccess",
    });

    const attachOsPermissionsToCategorizeLambda =
      new aws.iam.RolePolicyAttachment(
        "attach-os-permissions-to-categorize",
        pulumi
          .all([categorizeEmailLambda.nodes.role.name]) // Use the IAM Role ARN, not the Lambda function ARN
          .apply(([roleName]) => ({
            role: roleName,
            policyArn: DefaultIamOpenSearchPolicy.arn,
          }))
      );

    const proccessUserConfirmation = new sst.aws.Function(
      "process-user-confirmation",
      {
        handler: "functions/process-user-confirmation.handler",
        link: [emailArchiveBucket, openApiQueue, usersTable, stageConsts],
      }
    );

    const attachOsPermissionsToUserCreationLambda =
      new aws.iam.RolePolicyAttachment(
        "attach-os-permissions-to-user-creation",
        pulumi
          .all([
            proccessUserConfirmation.nodes.role.name,
            DefaultIamOpenSearchPolicy.arn,
          ]) // Use the IAM Role ARN, not the Lambda function ARN
          .apply(([roleName, policyArn]) => ({
            role: roleName,
            policyArn: policyArn,
          }))
      );

    openApiQueue.subscribe(categorizeEmailLambda.arn);

    //Cognito User pool

    const userPool = new sst.aws.CognitoUserPool("user-pool", {
      usernames: ["email"],
      triggers: {
        postConfirmation: proccessUserConfirmation.arn,
      },
    });

    const userPoolEndpoint = new sst.Linkable("user-pool-endpoint", {
      properties: userPool.nodes.userPool.apply((userPool) => ({
        id: userPool.id,
        endpoint: userPool.endpoint,
        region: aws.getRegionOutput().name,
      })),
    });

    const syncOpenSearch = new sst.aws.Function("sync-open-search", {
      handler: "functions/sync-dynamo-to-os.handler",
      link: [
        emailArchiveBucket,
        openApiKey,
        usersTable,
        stageConsts,
        userPoolEndpoint,
        opensearch,
      ],
    });

    const syncGroupsToEmails = new sst.aws.Function("sync-groups", {
      handler: "functions/sync-group-to-emails.handler",
      link: [
        emailArchiveBucket,
        stageConsts,
        userPoolEndpoint,
        opensearch,
        categorizedEmailsTable,
      ],
    });

    const DefaultStreamingPolicy = await aws.iam.getPolicy({
      name: "AWSLambdaInvocation-DynamoDB",
    });

    const attachStreamPermissionsToSyncOpenSearch =
      new aws.iam.RolePolicyAttachment(
        "attach-stream-permissions-to-sync-os",
        pulumi
          .all([syncOpenSearch.nodes.role.name]) // Use the IAM Role ARN, not the Lambda function ARN
          .apply(([roleName]) => ({
            role: roleName,
            policyArn: DefaultStreamingPolicy.arn,
          }))
      );

    const attachStreamPermissionsToSyncGroups =
      new aws.iam.RolePolicyAttachment(
        "attach-stream-permissions-to-sync-groups",
        pulumi
          .all([syncGroupsToEmails.nodes.role.name]) // Use the IAM Role ARN, not the Lambda function ARN
          .apply(([roleName]) => ({
            role: roleName,
            policyArn: DefaultStreamingPolicy.arn,
          }))
      );

    const attachOsPermissionsToSyncOpenSearch =
      new aws.iam.RolePolicyAttachment(
        "attach-os-permissions-to-opens-search",
        pulumi
          .all([syncOpenSearch.nodes.role.name]) // Use the IAM Role ARN, not the Lambda function ARN
          .apply(([roleName]) => ({
            role: roleName,
            policyArn: DefaultIamOpenSearchPolicy.arn,
          }))
      );

    const osSyncToDynamo = new aws.lambda.EventSourceMapping(
      "os-sync-subscribe-to-email-table",
      {
        eventSourceArn: categorizedEmailsTable.nodes.table.streamArn,
        functionName: syncOpenSearch.arn,
        startingPosition: "LATEST",
        tags: {
          Name: "dynamodb",
        },
      }
    );

    const groupSyncEmails = new aws.lambda.EventSourceMapping(
      "group-sync-emails",
      {
        eventSourceArn: groupedApplicationsTable.nodes.table.streamArn,
        functionName: syncGroupsToEmails.arn,
        startingPosition: "LATEST",
        tags: {
          Name: "dynamodb",
        },
      }
    );

    const processEmailLambda = new sst.aws.Function("process-email", {
      handler: "functions/process-email.handler",
      link: [
        emailArchiveBucket,
        openApiQueue,
        userPool,
        userPoolEndpoint,
        usersTable,
        categorizedEmailsTable,
        stageConsts,
      ],
    });

    const populateFromBucket = new sst.aws.Function("populate-from-s3", {
      handler: "functions/populate-from-s3.handler",
      link: [
        emailArchiveBucket,
        usersTable,
        openApiQueue,
        userPool,
        userPoolEndpoint,
      ],
      url: process.env.SST_STAGE === "dev",
    });

    const groupEmailsFromOpenSearch = new sst.aws.Function(
      "group-from-open-search",
      {
        handler: "functions/group-from-open-search.handler",
        link: [
          userPoolEndpoint,
          groupingQueue,
          opensearch,
          categorizedEmailsTable,
          groupedApplicationsTable,
        ],
        url: process.env.SST_STAGE === "dev",
      }
    );

    groupingQueue.subscribe(groupEmailsFromOpenSearch.arn);

    const attachOsPermissionsToGroupCategorization =
      new aws.iam.RolePolicyAttachment(
        "attach-os-permissions-to-grouping-lambda",
        pulumi
          .all([groupEmailsFromOpenSearch.nodes.role.name]) // Use the IAM Role ARN, not the Lambda function ARN
          .apply(([roleName]) => ({
            role: roleName,
            policyArn: DefaultIamOpenSearchPolicy.arn,
          }))
      );

    sst.Linkable.wrap(aws.cognito.UserPoolClient, (userPoolClient) => ({
      properties: {
        id: userPoolClient.id,
        secret: userPoolClient.clientSecret,
      },
    }));

    const webUserPoolClient = new aws.cognito.UserPoolClient(
      "user-pool-client",
      {
        name: "user-pool-client",
        userPoolId: userPool.id,
        allowedOauthFlows: ["code"],
        allowedOauthScopes: ["email", "openid", "profile"],
        allowedOauthFlowsUserPoolClient: true,
        explicitAuthFlows: [
          "ALLOW_USER_PASSWORD_AUTH",
          "ALLOW_REFRESH_TOKEN_AUTH",
          "ALLOW_USER_SRP_AUTH",
        ],
        callbackUrls: [
          `${
            process.env.SST_STAGE !== "dev"
              ? `https://${domain}`
              : "http://localhost:3000"
          }/api/auth/callback/cognito`,
        ],
        logoutUrls: [
          `${
            process.env.SST_STAGE !== "dev"
              ? `https://${domain}`
              : "http://localhost:3000"
          }`,
        ],
        supportedIdentityProviders: ["COGNITO"],
      }
    );

    // Create SES Domain Identity
    const sesDomainIdentity = new aws.ses.DomainIdentity("sesDomainIdentity", {
      domain,
    });

    // Create DKIM Identity
    const sesDkim = new aws.ses.DomainDkim("sesDkim", {
      domain: sesDomainIdentity.domain,
    });

    sesDkim.dkimTokens.apply((tokens) =>
      tokens.map((token, i) => {
        return new aws.route53.Record(`dkimRecord${i + 1}`, {
          zoneId: hostedZone.id,
          name: `${token}._domainkey.${domain}`,
          type: "CNAME",
          records: [`${token}.dkim.amazonses.com`],
          ttl: 300,
        });
      }));

    const mxRecord = new aws.route53.Record("sesMXRecord", {
      zoneId: hostedZone.id,
      name: domain,
      type: "MX",
      ttl: 300,
      records: ["10 inbound-smtp.us-east-1.amazonaws.com"],
    });

    // Add a TXT Record for SES Domain Verification
    const txtRecord = new aws.route53.Record("sesTxtRecord", {
      zoneId: hostedZone.id,
      name: `_amazonses.${domain}`,
      type: "TXT",
      ttl: 300,
      records: [sesDomainIdentity.verificationToken], // Get this from AWS SES
    });

    new aws.route53.Record("spfRecord", {
      zoneId: hostedZone.id,
      name: domain,
      type: "TXT",
      records: ["v=spf1 include:amazonses.com -all"],
      ttl: 300,
    });

    //Permissions
    const s3PermissionForProcessing = new aws.lambda.Permission(
      "s3LambdaPermissionForProcessing",
      {
        action: "lambda:InvokeFunction",
        function: processEmailLambda.name,
        principal: "s3.amazonaws.com",
        sourceAccount: currentAccountId,
        sourceArn: emailArchiveBucket.arn,
      }
    );

    const s3PermissionForCategorization = new aws.lambda.Permission(
      "s3LambdaPermissionForCategorization",
      {
        action: "lambda:InvokeFunction",
        function: categorizeEmailLambda.name,
        principal: "s3.amazonaws.com",
        sourceAccount: currentAccountId,
        sourceArn: emailArchiveBucket.arn,
      }
    );

    const exampleIdentityPolicy = new aws.ses.IdentityPolicy(
      "attachSesSendEmailPolicy",
      pulumi
        .all([processEmailLambda.nodes.role.arn, sesDomainIdentity.arn])
        .apply(([roleIdentity, domainIdentity]) => ({
          identity: domainIdentity,
          name: "attachSesSendEmailPolicy",

          policy: JSON.stringify({
            Version: "2012-10-17",
            Statement: [
              {
                Effect: "Allow",
                Action: "ses:SendRawEmail",
                Resource: domainIdentity,
                Principal: {
                  AWS: roleIdentity,
                },
              },
            ],
          }),
        }))
    );

    if (process.env.SST_STAGE === "dev") {
      // Attach my email and allow contact
      const emailIdentity = await aws.ses.getEmailIdentity({
        email: "vincentthanhlam@gmail.com",
      });

      new aws.ses.IdentityPolicy(
        "attachPersonalEmailPolicy",
        pulumi
          .all([processEmailLambda.nodes.role.arn, emailIdentity.arn])
          .apply(([roleIdentity, domainIdentity]) => ({
            identity: domainIdentity,
            name: "attachSesSendEmailPolicy",

            policy: JSON.stringify({
              Version: "2012-10-17",
              Statement: [
                {
                  Effect: "Allow",
                  Action: "ses:SendRawEmail",
                  Resource: domainIdentity,
                  Principal: {
                    AWS: roleIdentity,
                  },
                },
              ],
            }),
          }))
      );
    }

    const SESAccessToS3 = new aws.s3.BucketPolicy("allow_access_from_SES", {
      bucket: emailArchiveBucket.id,
      policy: pulumi
        .all([
          emailArchiveBucket.arn,
          processEmailLambda.nodes.role.arn,
          categorizeEmailLambda.nodes.role.arn,
          populateFromBucket.nodes.role.arn,
          syncOpenSearch.nodes.role.arn,
        ])
        .apply(([
          arn,
          processEmailLambdaRole,
          categorizeEmailLambdaRole,
          populateFromBucketRole,
          syncOpenSearchRole,
        ]) =>
          JSON.stringify({
            Version: "2012-10-17",
            Statement: [
              {
                Effect: "Allow",
                Principal: {
                  Service: "ses.amazonaws.com",
                },
                Action: "s3:PutObject",
                Resource: `${arn}/*`, // Must allow object writes
                Condition: {
                  StringEquals: {
                    "aws:SourceAccount": currentAccountId, // Restricts access
                  },
                },
              },
              {
                Effect: "Allow",
                Principal: {
                  AWS: processEmailLambdaRole,
                },
                Action: ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"],
                Resource: `${arn}/*`, // Allows Lambda to write and delete objects in the bucket
              },
              {
                Effect: "Allow",
                Principal: {
                  AWS: categorizeEmailLambdaRole,
                },
                Action: ["s3:PutObject", "s3:GetObject"],
                Resource: `${arn}/*`, // Allows Lambda to write objects to the bucket
              },
              {
                Effect: "Allow",
                Principal: {
                  AWS: processEmailLambdaRole,
                },
                Action: ["s3:ListBucket"],
                Resource: `${arn}`, // Allows Lambda to write and delete objects in the bucket
              },
              {
                Effect: "Allow",
                Principal: {
                  AWS: populateFromBucketRole,
                },
                Action: ["s3:*"],
                Resource: `${arn}`, // Allows Lambda to write and delete objects in the bucket
              },
              {
                Effect: "Allow",
                Principal: {
                  AWS: syncOpenSearchRole,
                },
                Action: ["s3:*"],
                Resource: `${arn}/*`, // Allows Lambda to write and delete objects in the bucket
              },
            ],
          })),
    });

    const bucketNotification = new aws.s3.BucketNotification(
      "bucket_notification",
      pulumi.all([emailArchiveBucket.id, processEmailLambda.arn]).apply(([
        emailArchiveBucketId,
        processEmailLambdaArn,
      ]) => ({
        bucket: emailArchiveBucketId,
        lambdaFunctions: [
          {
            events: ["s3:ObjectCreated:Put"],
            lambdaFunctionArn: processEmailLambdaArn,
            filterPrefix: "emails/",
          },
        ],
      }))
    );

    sst.Linkable.wrap(aws.ses.ReceiptRuleSet, (ruleset) => {
      return {
        properties: { ...ruleset },
        include: [
          sst.aws.permission({
            actions: ["s3:*"], //restrict this
            resources: [emailArchiveBucket.arn],
          }),
        ],
      };
    });

    //SES
    const ruleset = new aws.ses.ReceiptRuleSet("incoming-rules", {
      ruleSetName: "incoming-rules",
    });

    const writeToBucketRule = new aws.ses.ReceiptRule("writeToBucket", {
      // name: "parseWithLambda",
      ruleSetName: ruleset.ruleSetName,
      enabled: true,
      scanEnabled: true, // Enable spam and virus scanning
      // lambdaActions: [
      //   {
      //     functionArn: processEmailLambda.arn,
      //     position: 1,
      //     invocationType: "Event", // Event means async execution
      //   },
      // ],
      s3Actions: [
        {
          bucketName: emailArchiveBucket.id,
          objectKeyPrefix: "emails/",
          position: 1,
        },
      ],
    });

    const activeRuleSet = new aws.ses.ActiveReceiptRuleSet(
      "active-incoming-rules",
      { ruleSetName: ruleset.ruleSetName }
    );

    new sst.aws.Nextjs("MyWeb", {
      link: [
        userPoolEndpoint,
        webUserPoolClient,
        userPool,
        usersTable,
        categorizedEmailsTable,
        groupedApplicationsTable,
        emailArchiveBucket,
        logoDevSearchToken,
        logoDevFetchToken,
        opensearch,
      ],
    });
    // queue.subscribe()
  },
});
