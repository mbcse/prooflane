import { LoginForm } from "./login-form";

type Props = { searchParams: Promise<{ callbackUrl?: string | string[] }> };

export default async function LoginPage({ searchParams }: Props) {
  const sp = await searchParams;
  const raw = sp.callbackUrl;
  const callbackUrl = Array.isArray(raw) ? raw[0] : raw;
  const githubEnabled = Boolean(
    process.env.GITHUB_CLIENT_ID &&
      process.env.GITHUB_CLIENT_SECRET &&
      process.env.INTERNAL_OAUTH_PROVISION_SECRET,
  );
  return <LoginForm githubEnabled={githubEnabled} callbackUrl={callbackUrl} />;
}
