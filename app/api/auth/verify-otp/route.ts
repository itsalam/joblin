import { cognitoClient } from "@/lib/clients";
import { handlerFactory } from "@/lib/utils";
import { ConfirmSignUpCommand } from "@aws-sdk/client-cognito-identity-provider";
import { Resource } from "sst";

async function handler(req: Request) {
  const { username, otp } = await req.json(); // OTP entered by user
  console.log(username, otp);
  const command = new ConfirmSignUpCommand({
    ClientId: Resource["user-pool-client"].id!,
    Username: username,
    ConfirmationCode: otp,
  });

  const res = await cognitoClient.send(command);
  return new Response(
    JSON.stringify({
      Session: res.Session,
      message: "Account verified successfully! You can now log in.",
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
