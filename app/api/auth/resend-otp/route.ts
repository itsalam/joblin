import { cognitoClient } from "@/lib/clients";
import { handlerFactory } from "@/lib/utils";
import {
  ResendConfirmationCodeCommand,
  UserType,
} from "@aws-sdk/client-cognito-identity-provider";
import { Resource } from "sst";

async function handler(req: Request) {
  const body = await new Response(req.body).json();
  const { user } = body; // Email to resend OTP
  const command = new ResendConfirmationCodeCommand({
    ClientId: Resource["user-pool-client"].id!,
    Username: (user as UserType).Username,
  });

  const resendRes = await cognitoClient.send(command);
  return new Response(
    JSON.stringify({
      message: "New OTP sent to your email.",
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
