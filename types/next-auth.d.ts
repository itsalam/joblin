import "next-auth";

interface BaseCognitoToken {
  accessToken?: string;
  refreshToken?: string;
  idToken?: string;
  expiresIn?: number;
}

declare module "next-auth/jwt" {
  interface DefaultJWT extends BaseCognitoToken {
    username: string;
  }
}

declare module "next-auth" {
  interface User {
    cognitoJwt?: CognitoToken;
    username?: string;
  }

  interface Session {
    accessToken?: string;
    user?: {
      email?: string;
      username?: string;
    };
    refreshToken: string;
    idToken: string;
  }

  interface DefaultJWT extends CognitoToken {
    username: string;
  }

  interface CognitoToken extends BaseCognitoToken {}
}
