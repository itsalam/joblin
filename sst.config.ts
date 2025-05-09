/// <reference path="./.sst/platform/config.d.ts" />

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
    const { sesDomainIdentity } = await createSimpleEmailServiceStack(domain)

    // S3
    sst.Linkable.wrap(aws.s3.BucketV2, (bucket) => ({
      properties: {
        bucketArn: bucket.arn,
        bucketName: bucket.id,
        bucketDomainName: bucket.bucketDomainName,
      },
      include: [
        sst.aws.permission({
          actions: ["s3:*"],
          resources: [bucket.arn.apply((arn) => `${arn}/*`)],
        }),
      ],
    }));

    sst.Linkable.wrap(aws.cloudfront.Distribution, (distribution) => ({
      properties: {
        distributionId: distribution.id,
        distributionDomainName: distribution.domainName,
        distributionOrigins: distribution.origins,
      },
      include: [
        sst.aws.permission({
          actions: ["cloudfront:*"],
          resources: [distribution.arn],
        }),
      ],
    }));

    const { cdnAssetBucket, cdnAssetDistribution } = (await import("./services/cloudfront").then((m) => m.default))(currentAccountId);

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

    const { userPool, userPoolEndpoint } = await UserRegistrationService([emailArchiveBucket, openApiQueue, usersTable, stageConsts])

    const { opensearch, syncOpenSearch } = await createOsStack({accountId: currentAccountId, dynamoTable: categorizedEmailsTable, syncOpenSearchLinks: [
      emailArchiveBucket,
      openApiKey,
      usersTable,
      categorizedEmailsTable,
      stageConsts,
      userPoolEndpoint,
    ]});

    const { categorizeEmailLambda, vpc } = await EmailCategorizationService({link: [
      emailArchiveBucket,
      openApiQueue,
      groupingQueue,
      categorizedEmailsTable,
      opensearch,
      openApiKey,
      stageConsts,
      usersTable,
    ], accountId: currentAccountId, s3BucketArn: emailArchiveBucket.arn});

    const DefaultIamOpenSearchPolicy = await aws.iam.getPolicy({
      name: "AmazonOpenSearchServiceFullAccess",
    });

    const {imgProxyKey, imgProxySalt, imgProxyService, imgProxyApi} = createImgProxyStack(vpc);

    openApiQueue.subscribe(categorizeEmailLambda.arn);
    
    //Cognito User pool

    const syncGroupsToEmails = new sst.aws.Function("sync-groups", {
      handler: "functions/sync-group-to-emails.handler",
      link: [
        emailArchiveBucket,
        stageConsts,
        userPoolEndpoint,
        groupedApplicationsTable,
        opensearch,
        categorizedEmailsTable,
      ],
    });

    const DefaultStreamingPolicy = await aws.iam.getPolicy({
      name: "AWSLambdaInvocation-DynamoDB",
    });

    const attachStreamPermissionsToSyncGroups =
      new aws.iam.RolePolicyAttachment(
        "attach-stream-permissions-to-sync-groups",
        $util
          .all([syncGroupsToEmails.nodes.role.name]) // Use the IAM Role ARN, not the Lambda function ARN
          .apply(([roleName]) => ({
            role: roleName,
            policyArn: DefaultStreamingPolicy.arn,
          }))
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
      handler: "functions/process-email/handler.handler",
      link: [
        emailArchiveBucket,
        openApiQueue,
        userPool,
        userPoolEndpoint,
        usersTable,
        categorizedEmailsTable,
        stageConsts,
        imgProxyKey,
        imgProxySalt,
        imgProxyApi,
        cdnAssetBucket,
        cdnAssetDistribution,
      ],
      url: process.env.SST_STAGE === "dev",
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
        $util
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

    const attachSESEmailPolicy = new aws.ses.IdentityPolicy(
      "attachSesSendEmailPolicy",
      $util
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
        $util
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
      policy: $util
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
      $util.all([emailArchiveBucket.id, processEmailLambda.arn]).apply(([
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

    const myWeb = new sst.aws.Nextjs("MyWeb", {
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
        cdnAssetDistribution,
      ],
      environment: {
        NEXT_PUBLIC_CDN_URL: $util.interpolate`${cdnAssetDistribution.domainName}`,
      },
      permissions: [
        {
          actions: ["dynamodb:*"],
          resources: [
            categorizedEmailsTable.arn.apply(
              (arn) => `${arn}/index/userEmails`
            ),
          ],
        },
      ],
    });
    // queue.subscribe()
  },
});

async function createSimpleEmailServiceStack(domain: string) {
  // Create a Route 53 Hosted Zone
  const hostedZone = await aws.route53.getZone({
      name: domain,
    });
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

  return { sesDomainIdentity }
}

async function UserRegistrationService(link : $util.Input<any>[]) {
  // Create a new OpenSearch domain
  const proccessUserConfirmation = new sst.aws.Function(
    "process-user-confirmation",
    {
      handler: "functions/process-user-confirmation.handler",
      link: link,
    }
  );

  const DefaultIamOpenSearchPolicy = await aws.iam.getPolicy({
    name: "AmazonOpenSearchServiceFullAccess",
  });

  const attachOsPermissionsToUserCreationLambda =
  new aws.iam.RolePolicyAttachment(
    "attach-os-permissions-to-user-creation",
    $util
      .all([
        proccessUserConfirmation.nodes.role.name,
        DefaultIamOpenSearchPolicy.arn,
      ]) // Use the IAM Role ARN, not the Lambda function ARN
      .apply(([roleName, policyArn]) => ({
        role: roleName,
        policyArn: policyArn,
      }))
  );

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


  return { proccessUserConfirmation, userPool, userPoolEndpoint, attachOsPermissionsToUserCreationLambda };
}

type OpenSearchStackArgs = {
  accountId: string;
  syncOpenSearchLinks: $util.Input<any>[];
  dynamoTable: sst.aws.Dynamo;
} 


async function createOsStack({accountId, syncOpenSearchLinks, dynamoTable}: OpenSearchStackArgs): Promise<{
  opensearch: aws.opensearch.Domain;
  syncOpenSearch: sst.aws.Function;
}> {
  // 🔹 Create an OpenSearch domain (Managed Service)
  sst.Linkable.wrap(aws.opensearch.Domain, (domain) => ({
    properties: {
      arn: domain.arn,
      endpoint: domain.endpoint,
    },
  }));

  const region = aws.getRegionOutput().name.apply((region) => region);

  const userPool = new sst.aws.CognitoUserPool("os-user-pool", {});
  const userPoolDomain = new aws.cognito.UserPoolDomain("os-user-pool-domain", {
    domain: "os-dashboards",
    userPoolId: userPool.id,
  });

  const identityPool = new aws.cognito.IdentityPool("os-identity-pool", {
    identityPoolName: "os-identity-pool",
  });

  // Create Policy for access to dashboard
  const openSearchDashboardAccessPolicy = aws.iam.getPolicyDocumentOutput({
    version: "2012-10-17",
    statements: [
      {
        effect: "Allow",
        principals: [
          {
            type: "Federated",
            identifiers: ["cognito-identity.amazonaws.com"],
          },
        ],
        actions: ["sts:AssumeRoleWithWebIdentity", "sts:TagSession"],
        conditions: [
          {
            test: "StringEquals",
            variable: "cognito-identity.amazonaws.com:aud",
            values: [identityPool.id],
          },
          {
            test: "ForAnyValue:StringLike",
            variable: "cognito-identity.amazonaws.com:amr",
            values: ["authenticated"],
          },
        ],
      },
      {
        effect: "Allow",
        principals: [
          {
            type: "AWS",
            identifiers: [
              `arn:aws:iam::${accountId}:role/service-role/CognitoAccessForAmazonOpenSearch`,
            ],
          },
        ],
        actions: ["sts:AssumeRole"],
      },
    ],
  });

  //Create the roles
  const openSearchDashboardAdminRole = new aws.iam.Role(
    "opensearch-dashboard-role-admin",
    {
      assumeRolePolicy: openSearchDashboardAccessPolicy.json,
      inlinePolicies: [
        {
          name: "inline-es-http-get",
          policy: JSON.stringify({
            Version: "2012-10-17",
            Statement: [
              {
                Effect: "Allow",
                Action: ["es:*"],
                Resource: "*",
              },
            ],
          }),
        },
      ],
    }
  );

  const openSearchDashboardTempUserRole = new aws.iam.Role(
    "opensearch-dashboard-role-temp-user",
    {
      assumeRolePolicy: openSearchDashboardAccessPolicy.json,
      inlinePolicies: [
        {
          name: "inline-es-http-get",
          policy: JSON.stringify({
            Version: "2012-10-17",
            Statement: [
              {
                Effect: "Allow",
                Action: ["es:*"],
                Resource: "*",
              },
            ],
          }),
        },
      ],
    }
  );

  const adminRolePolicyAttachment = new aws.iam.RolePolicyAttachment(
    "opensearch-dashboard-admin-role-attachment",
    {
      role: openSearchDashboardAdminRole.name,
      policyArn: "arn:aws:iam::aws:policy/AmazonOpenSearchServiceFullAccess",
    }
  );

  const tempUserRolePolicyAttachment = new aws.iam.RolePolicyAttachment(
    "opensearch-dashboard-temp-user-role-attachment",
    {
      role: openSearchDashboardTempUserRole.name,
      policyArn:
        "arn:aws:iam::aws:policy/AmazonOpenSearchServiceReadOnlyAccess",
    }
  );

  sst.Linkable.wrap(aws.opensearch.Domain, (domain) => ({
    properties: {
      arn: domain.arn,
      endpoint: domain.endpoint,
      domainName: domain.domainName,
      accessPolicies: domain.accessPolicies,
      advancedSecurityOptions: domain.advancedSecurityOptions,
      cognitoOptions: domain.cognitoOptions,
      domainEndpointOptions: domain.domainEndpointOptions,
      ebsOptions: domain.ebsOptions,
      clusterConfig: domain.clusterConfig,
      advancedOptions: domain.advancedOptions,
      vpcOptions: domain.vpcOptions,
    },
    include: [
      sst.aws.permission({
        actions: ["es:*"],
        resources: [domain.arn.apply((arn) => `${arn}/*`)],
      }),
    ],
  }));

  const opensearch = new aws.opensearch.Domain("email-opensearch", {
    engineVersion: "OpenSearch_2.9", // Must be 2.9+ for k-NN search
    clusterConfig: {
      instanceType: "t3.medium.search", // Cost-effective for dev
      instanceCount: 1,
    },
    cognitoOptions: {
      enabled: true,
      identityPoolId: identityPool.id,
      roleArn:
        "arn:aws:iam::423623864572:role/service-role/CognitoAccessForAmazonOpenSearch",
      userPoolId: userPool.id,
    },
    nodeToNodeEncryption: { enabled: true },
    encryptAtRest: { enabled: true },
    domainEndpointOptions: {
      enforceHttps: true,
    },
    ebsOptions: {
      ebsEnabled: true,
      volumeSize: 10, // Storage in GB
    },
    advancedSecurityOptions: {
      enabled: true,
      // anonymousAuthEnabled: true,
      // internalUserDatabaseEnabled: false,
      masterUserOptions: {
        masterUserArn: openSearchDashboardAdminRole.arn,
      },
    },
  });

  const opensearchDomainAccessPolicy = aws.iam.getPolicyDocumentOutput({
    version: "2012-10-17",
    statements: [
      {
        effect: "Allow",
        principals: [
          {
            type: "AWS",
            identifiers: [`arn:aws:iam::${accountId}:root`],
          },
        ],
        actions: ["es:*"],
        resources: $util
          .all([region, opensearch.domainName])
          .apply(([region, domainName]) => [
            `arn:aws:es:${region}:${accountId}:domain/${domainName}/*`,
          ]),
      },
    ],
  });

  const openSearchDomainAccessPolicy = new aws.opensearch.DomainPolicy(
    "opensearch-domain-access-policy",
    {
      domainName: opensearch.domainName,
      accessPolicies: opensearchDomainAccessPolicy.json,
    }
  );
  // refetch IdentityPool and get its provider
  const updatedIdentityPoolProviders = identityPool.identityPoolName
    .apply(
      async (identityPoolName) =>
        await aws.cognito.getIdentityPool({ identityPoolName })
    )
    .cognitoIdentityProviders.apply(
      (cognitoIdentityProviders) => cognitoIdentityProviders[0]
    );
  const cognitoIdentityProvider = identityPool.cognitoIdentityProviders.apply(
    (cognitoIdentityProviders) => cognitoIdentityProviders?.[0]
  );

  const identityPoolRoleAttachmentResource =
    new aws.cognito.IdentityPoolRoleAttachment("os-identity-pool-temp-access", {
      identityPoolId: identityPool.id,
      roles: {
        authenticated: openSearchDashboardTempUserRole.arn,
      },
      roleMappings: [
        {
          identityProvider: cognitoIdentityProvider.apply(
            (cognitoIdentityProvider) =>
              `${cognitoIdentityProvider?.providerName}:${cognitoIdentityProvider?.clientId}`
          ),
          ambiguousRoleResolution: "AuthenticatedRole", // Use authenticated role if multiple matches occur
          type: "Rules",
          mappingRules: [
            {
              claim: "cognito:email",
              matchType: "Contains",
              value: "vincentthanhlam@gmail.com",
              roleArn: openSearchDashboardAdminRole.arn,
            },
            {
              claim: "email",
              matchType: "Contains",
              value: "vincentthanhlam@gmail.com",
              roleArn: openSearchDashboardAdminRole.arn,
            },
          ],
        },
      ],
    });

    const syncOpenSearch = new sst.aws.Function("sync-open-search", {
      handler: "functions/sync-dynamo-to-os.handler",
      link: [...syncOpenSearchLinks, opensearch],
    });

    const DefaultStreamingPolicy = await aws.iam.getPolicy({
      name: "AWSLambdaInvocation-DynamoDB",
    });

    const attachStreamPermissionsToSyncOpenSearch =
      new aws.iam.RolePolicyAttachment(
        "attach-stream-permissions-to-sync-os",
        $util
          .all([syncOpenSearch.nodes.role.name]) // Use the IAM Role ARN, not the Lambda function ARN
          .apply(([roleName]) => ({
            role: roleName,
            policyArn: DefaultStreamingPolicy.arn,
          }))
      );


    const DefaultIamOpenSearchPolicy = await aws.iam.getPolicy({
      name: "AmazonOpenSearchServiceFullAccess",
    });

      const attachOsPermissionsToSyncOpenSearch =
      new aws.iam.RolePolicyAttachment(
        "attach-os-permissions-to-opens-search",
        $util
          .all([syncOpenSearch.nodes.role.name]) // Use the IAM Role ARN, not the Lambda function ARN
          .apply(([roleName]) => ({
            role: roleName,
            policyArn: DefaultIamOpenSearchPolicy.arn,
          }))
      );

      const osSyncToDynamo = new aws.lambda.EventSourceMapping(
        "os-sync-subscribe-to-email-table",
        {
          eventSourceArn: dynamoTable.nodes.table.streamArn,
          functionName: syncOpenSearch.arn,
          startingPosition: "LATEST",
          tags: {
            Name: "dynamodb",
          },
        }
      );

  return { opensearch, syncOpenSearch };
}

type EmailCategorizationServiceArgs = {
  link: $util.Input<any>[];
  accountId: string;
  s3BucketArn: string | $util.Output<string>;
}

async function EmailCategorizationService({link, accountId, s3BucketArn}: EmailCategorizationServiceArgs) {
  // Create a new OpenSearch domain
  const vpc = new sst.aws.Vpc("EmailCategorizationVpc", {nat: "ec2"});
  const categorizeEmailLambda = new sst.aws.Function("categorize-email", {
    handler: "functions/open-api-categorize.handler",
    vpc,
    link,
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
      $util
        .all([categorizeEmailLambda.nodes.role.name]) // Use the IAM Role ARN, not the Lambda function ARN
        .apply(([roleName]) => ({
          role: roleName,
          policyArn: DefaultIamOpenSearchPolicy.arn,
        }))
    );

    const s3PermissionForCategorization = new aws.lambda.Permission(
        "s3LambdaPermissionForCategorization",
        {
          action: "lambda:InvokeFunction",
          function: categorizeEmailLambda.name,
          principal: "s3.amazonaws.com",
          sourceAccount: accountId,
          sourceArn: s3BucketArn,
        }
      );
  return { categorizeEmailLambda, vpc };
}

function createImgProxyStack(vpc = new sst.aws.Vpc("ImgproxyVpc"), cluster = new sst.aws.Cluster("ImgproxyCluster", { vpc })) {
  const imgProxyKey = new sst.Secret("ImgProxyKey");
  const imgProxySalt = new sst.Secret("ImgProxySalt");
  const imgProxyService = $util.all([imgProxySalt.value, imgProxyKey.value]).apply(([imgProxySalt, imgProxyKey]) => new sst.aws.Service("ImgproxyService", {
    cluster,
    cpu: "0.5 vCPU",
    memory: "1 GB",
    loadBalancer: { rules:[{listen: "8080/tcp", forward: "8080/tcp" }]},
    environment: {
        IMGPROXY_KEY: imgProxyKey.value,         // Set securely with secrets
        IMGPROXY_SALT: imgProxySalt.value,       // Set securely with secrets
        IMGPROXY_USE_ETAG: "true",            // Optional: CDN-friendly
        IMGPROXY_ENABLE_WEBP_DETECTION: "true",
        IMGPROXY_USE_S3: "true",              // if accessing S3 directly
        IMGPROXY_USER_AGENT: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.0.0 Safari/537.36"
    },
    image: {
        context: "./services/imgproxy",
        dockerfile: "./services/imgproxy/Dockerfile",
    },
    dev: false,
    serviceRegistry: {
      port: 8080
    }
    // {
    //     // Export the IMGPROXY_KEY and IMGPROXY_SALT before running the container
    //     command: `docker run -e IMGPROXY_SALT=${imgProxySalt} -e IMGPROXY_KEY=${imgProxyKey} -p 8080:8080 imgproxy`,
    //     url: "http://localhost:8080"
    //   }
})); 

  const imgProxyApi = new sst.aws.ApiGatewayV2("ImgProxyApi", {
      vpc,
  });
  imgProxyApi.routePrivate("$default", imgProxyService.nodes.cloudmapService.arn);

  if(process.env.SST_STAGE !== "dev"){
      imgProxyApi.routePrivate("$default", imgProxyService.nodes.cloudmapService.arn);
  }

  return { imgProxyService, imgProxyKey, imgProxySalt, imgProxyApi }
}
