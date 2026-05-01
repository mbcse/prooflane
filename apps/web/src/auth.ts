import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import GitHub from "next-auth/providers/github";

function apiBase() {
  return (
    process.env.INTERNAL_API_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    "http://127.0.0.1:4000"
  );
}

const githubConfigured =
  Boolean(process.env.GITHUB_CLIENT_ID) &&
  Boolean(process.env.GITHUB_CLIENT_SECRET) &&
  Boolean(process.env.INTERNAL_OAUTH_PROVISION_SECRET);

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  secret: process.env.AUTH_SECRET,
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  providers: [
    ...(githubConfigured
      ? [
          GitHub({
            clientId: process.env.GITHUB_CLIENT_ID!,
            clientSecret: process.env.GITHUB_CLIENT_SECRET!,
            authorization: {
              params: {
                scope: "read:user user:email repo",
              },
            },
          }),
        ]
      : []),
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;
        if (!email || !password) return null;

        try {
          const res = await fetch(`${apiBase()}/v1/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password }),
          });
          if (!res.ok) {
            if (process.env.NODE_ENV === "development") {
              const body = await res.text().catch(() => "");
              console.error(
                "[auth] POST /v1/auth/login failed",
                res.status,
                body.slice(0, 500),
              );
            }
            return null;
          }
          const data = (await res.json()) as {
            token: string;
            user: {
              id: string;
              email: string;
              name: string | null;
              organizationId: string | null;
            };
          };
          return {
            id: data.user.id,
            email: data.user.email,
            name: data.user.name,
            organizationId: data.user.organizationId,
            accessToken: data.token,
          };
        } catch (e) {
          console.error("[auth] login fetch failed", e);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, account, profile }) {
      if (account?.provider === "github" && profile && user?.email) {
        const secret = process.env.INTERNAL_OAUTH_PROVISION_SECRET;
        if (!secret) {
          console.error("[auth] INTERNAL_OAUTH_PROVISION_SECRET is not set");
          throw new Error("GitHubSignInDisabled");
        }
        const ghId = String((profile as { id: number | string }).id);
        const res = await fetch(`${apiBase()}/v1/auth/github/provision`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-internal-secret": secret,
          },
          body: JSON.stringify({
            githubId: ghId,
            email: user.email,
            name: user.name ?? undefined,
            githubAccessToken: account?.access_token,
          }),
        });
        if (!res.ok) {
          const t = await res.text().catch(() => "");
          console.error("[auth] github provision failed", res.status, t.slice(0, 500));
          throw new Error("GitHubSignInFailed");
        }
        const data = (await res.json()) as {
          token: string;
          user: {
            id: string;
            email: string;
            name: string | null;
            organizationId: string | null;
          };
        };
        token.accessToken = data.token;
        token.id = data.user.id;
        token.organizationId = data.user.organizationId;
        return token;
      }

      if (user && account?.provider === "credentials") {
        token.id = user.id;
        token.organizationId = user.organizationId ?? null;
        token.accessToken = (user as { accessToken?: string }).accessToken;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.organizationId = (token.organizationId as string | null) ?? null;
      }
      session.accessToken = token.accessToken as string | undefined;
      return session;
    },
  },
});
