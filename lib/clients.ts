import { CognitoIdentityProviderClient } from "@aws-sdk/client-cognito-identity-provider";
import { Resource } from "sst";

import { fromNodeProviderChain } from "@aws-sdk/credential-providers";
import { Client as OpenSearchClient } from "@opensearch-project/opensearch";
import { AwsSigv4Signer } from "@opensearch-project/opensearch/aws";

const getCredentials = async () => {
  const credentialsProvider = fromNodeProviderChain();
  return await credentialsProvider();
};

export const cognitoClient = new CognitoIdentityProviderClient({
  region: Resource["user-pool-endpoint"].region,
});

export const openSearchClient = async () =>
  new OpenSearchClient({
    ...AwsSigv4Signer({
      region: process.env.SST_REGION ?? "us-east-1",
      service: "es",
      ...(await getCredentials()),
    }),
    node: `https://${Resource["email-opensearch"].endpoint}`,
  });
