import { cognitoClient } from "@/lib/clients";
import { handlerFactory } from "@/lib/utils";
import { SignUpCommand } from "@aws-sdk/client-cognito-identity-provider";
import { Resource } from "sst";

async function handler(req: Request) {
  if (req.method !== "POST")
    return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
      status: 405,
    });
  const body = await req.json();
  const { email, password, name } = body;
  const signUpCommand = new SignUpCommand({
    ClientId: Resource["user-pool-client"].id!,
    Username: email,
    Password: password,
    UserAttributes: [
      { Name: "email", Value: email },
      { Name: "name", Value: name },
    ],
  });

  const response = await cognitoClient.send(signUpCommand);

  return new Response(
    JSON.stringify({
      user: response.UserSub,
      message:
        "User registered successfully! Please check your email for verification.",
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
