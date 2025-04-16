import { cognitoClient } from "@/lib/clients";
import {
  GetUserCommand,
  InitiateAuthCommand,
  type InitiateAuthRequest,
} from "@aws-sdk/client-cognito-identity-provider";
import { CognitoToken, Session, SessionStrategy, User } from "next-auth";
import { JWT } from "next-auth/jwt";
import CredentialsProvider from "next-auth/providers/credentials";
import { Resource } from "sst";

const refreshToken = async (
  authParams: NonNullable<InitiateAuthRequest["AuthParameters"]>
): Promise<CognitoToken> => {
  const command = new InitiateAuthCommand({
    AuthFlow: "USER_PASSWORD_AUTH",
    ClientId: Resource["user-pool-client"].id!,
    AuthParameters: authParams,
  });
  console.log(authParams);
  const response = await cognitoClient.send(command);
  if (!response.AuthenticationResult) {
    throw new Error("Authentication failed: ", response.AuthenticationResult);
  }

  return {
    accessToken: response.AuthenticationResult.AccessToken,
    refreshToken: response.AuthenticationResult.RefreshToken,
    idToken: response.AuthenticationResult.IdToken,
    expiresIn: response.AuthenticationResult.ExpiresIn,
  };
};

export const authOptions = {
  providers: [
    CredentialsProvider({
      name: "Cognito",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        console.log("🔹 Running authorize()");
        try {
          if (!credentials) {
            throw new Error("No credentials provided");
          }

          const cognitoJwt = await refreshToken({
            USERNAME: credentials.email,
            PASSWORD: credentials.password,
          });

          // Fetch user attributes from Cognito
          const userCommand = new GetUserCommand({
            AccessToken: cognitoJwt.accessToken,
          });

          const userResponse = await cognitoClient.send(userCommand);

          const username =
            userResponse.UserAttributes?.find(
              (v) => v.Name === "preferred_username"
            )?.Value || userResponse.Username;
          return {
            id: credentials.email, // Required by NextAuth
            email: credentials.email,
            name: userResponse.UserAttributes?.find((v) => v.Name === "name")
              ?.Value,
            username: username,
            cognitoJwt,
          };
        } catch (error: any) {
          console.error("❌ Error in authorize():", error);
          throw new Error(error.message || "Invalid credentials");
        }
      },
    }),
  ],
  session: {
    strategy: "jwt" as SessionStrategy,
  },
  callbacks: {
    async jwt({ token, user }: { token: JWT; user?: User }) {
      if (user?.username) {
        token.username = user.username;
      }

      if (user?.cognitoJwt) {
        token = { ...token, ...user.cognitoJwt };
      }

      if (token?.expiresIn && Date.now() > token.expiresIn) {
        return token;
      }

      if (!token.refreshToken || !user?.email) {
        throw "User not authenticated with a valid session.";
      }

      const cognitoJwt = await refreshToken({
        USERNAME: user.email,
        REFRESH_TOKEN: token.refreshToken,
      });

      if (cognitoJwt) {
        token = { ...token, ...cognitoJwt };
      }

      // Access token has expired, try to update it
      return token;
    },
    async session({ session, token }: { session: Session; token: JWT }) {
      session.accessToken = token.accessToken as string;
      session.refreshToken = token.refreshToken as string;
      session.idToken = token.idToken as string;
      if (session.user) {
        session.user.username = token.username as string;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET, // Required for JWT signing
};
