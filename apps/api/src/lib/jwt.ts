import { SignJWT, jwtVerify } from "jose";

function getSecret() {
  const raw = process.env.JWT_SECRET ?? process.env.AUTH_SECRET;
  if (!raw) {
    throw new Error("JWT_SECRET or AUTH_SECRET must be set for the API");
  }
  return new TextEncoder().encode(raw);
}

export async function signUserToken(payload: {
  sub: string;
  orgId: string | null;
}): Promise<string> {
  return new SignJWT({ orgId: payload.orgId })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(getSecret());
}

export async function verifyUserToken(token: string): Promise<{
  userId: string;
  organizationId: string | null;
}> {
  const { payload } = await jwtVerify(token, getSecret());
  return {
    userId: payload.sub as string,
    organizationId: (payload.orgId as string | null | undefined) ?? null,
  };
}
