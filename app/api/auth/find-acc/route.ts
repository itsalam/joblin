import { cognitoClient } from "@/lib/clients";
import { handlerFactory } from "@/lib/utils";
import { ListUsersCommand } from "@aws-sdk/client-cognito-identity-provider";
import { Resource } from "sst";

async function handler(req: Request) {
  const body = await req.json();
  const { email } = body;
  const findUser = new ListUsersCommand({
    UserPoolId: Resource["user-pool-endpoint"].id,
    Filter: `user_email = "${email}"`,
  });

  const listUsersCommandOutput = await cognitoClient.send(findUser);
  return new Response(
    JSON.stringify({
      user: listUsersCommandOutput?.Users?.[0],
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    }
  );
}

const POST = handlerFactory({ methods: ["POST"], handler });
export { POST };
