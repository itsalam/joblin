// import { cognitoClient } from "@/lib/clients";
// import { handlerFactory } from "@/lib/utils";
// import { InitiateAuthCommand } from "@aws-sdk/client-cognito-identity-provider";
// import { getServerSession } from "next-auth";
// import { cookies } from "next/headers";
// import { Resource } from "sst";
// import { authOptions } from "../[...nextauth]/route";

// async function handler(req: Request) {
//   const { email, password } = await req.json();

//   const command = new InitiateAuthCommand({
//     AuthFlow: "USER_PASSWORD_AUTH",
//     ClientId: Resource["user-pool-client"].id!,
//     AuthParameters: {
//       USERNAME: email,
//       PASSWORD: password,
//     },
//   });

//   const response = await cognitoClient.send(command);

//   if (!response.AuthenticationResult) {
//     return new Response(JSON.stringify({ error: "Authentication failed." }), {
//       status: 401,
//     });
//   }

//   const { AccessToken, RefreshToken } = response.AuthenticationResult;
//   const cookieStore = await cookies();
//   if (AccessToken) {
//     cookieStore.set("accessToken", AccessToken, {
//       httpOnly: true, // Prevents JavaScript access
//       secure: process.env.NODE_ENV === "production", // Only use Secure in production
//       sameSite: "strict",
//       path: "/",
//       maxAge: 60 * 60, // 1 hour
//     });
//   }

//   if (RefreshToken) {
//     cookieStore.set("refreshToken", RefreshToken, {
//       httpOnly: true,
//       secure: process.env.NODE_ENV === "production",
//       sameSite: "strict",
//       path: "/",
//       maxAge: 60 * 60 * 24 * 7, // 7 days
//     });
//   }
//   // Store session in NextAuth
//   console.log(response);
//   const session = await getServerSession({ req, ...authOptions });
//   if (session) {
//     session.user = { email };
//     session.accessToken = response.AuthenticationResult.AccessToken;
//   }

//   return new Response(
//     JSON.stringify({ message: "Login successful", session }),
//     { status: 200 }
//   );
// }

// const POST = handlerFactory({ methods: ["POST"], handler });
// export { POST };

import { GET, POST } from "../[...nextauth]/route";

export { GET, POST };
