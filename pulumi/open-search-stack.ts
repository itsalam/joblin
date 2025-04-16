/// <reference path="../.sst/platform/config.d.ts" />
import * as pulumi from "@pulumi/pulumi";

export default function createOsStack(accountId: string): {
  opensearch: aws.opensearch.Domain;
} {
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
        resources: pulumi
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

  return { opensearch };
}
