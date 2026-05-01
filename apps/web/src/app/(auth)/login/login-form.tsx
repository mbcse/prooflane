"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PRODUCT_NAME } from "@/lib/brand";

function safeCallbackUrl(url: string | undefined): string {
  if (!url || typeof url !== "string") return "/dashboard";
  const t = url.trim();
  if (!t.startsWith("/") || t.startsWith("//")) return "/dashboard";
  return t;
}

export function LoginForm({
  githubEnabled,
  callbackUrl,
}: {
  githubEnabled: boolean;
  callbackUrl?: string;
}) {
  const router = useRouter();
  const afterLogin = safeCallbackUrl(callbackUrl);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    setPending(false);
    if (res?.error) {
      setError("Invalid email or password.");
      return;
    }
    router.push(afterLogin);
    router.refresh();
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[radial-gradient(ellipse_120%_80%_at_50%_-20%,oklch(0.35_0.08_195/0.35),oklch(0.14_0.03_260))] p-6">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,transparent,oklch(0.12_0.02_260_/_0.92))]" />
      <Card className="relative w-full max-w-md border-white/10 bg-white/[0.04] shadow-2xl shadow-black/40 backdrop-blur-xl">
        <CardHeader className="space-y-1">
          <CardTitle className="font-[family-name:var(--font-heading)] text-2xl tracking-tight">
            Sign in to {PRODUCT_NAME}
          </CardTitle>
          <CardDescription className="text-white/50">
            Email and password, or continue with GitHub to connect repositories with OAuth.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {githubEnabled && (
            <div className="space-y-3">
              <Button
                type="button"
                variant="outline"
                className="w-full border-white/15 bg-white/5 text-white hover:bg-white/10"
                onClick={() => signIn("github", { callbackUrl: afterLogin })}
              >
                <svg className="mr-2 size-4" viewBox="0 0 24 24" aria-hidden>
                  <path
                    fill="currentColor"
                    d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"
                  />
                </svg>
                Continue with GitHub
              </Button>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-white/10" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-[oklch(0.14_0.03_260)] px-2 text-white/35">or</span>
                </div>
              </div>
            </div>
          )}
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="border-white/10 bg-white/5"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="border-white/10 bg-white/5"
              />
            </div>
            {error && <p className="text-sm text-red-400">{error}</p>}
            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-teal-600 to-emerald-600 text-white hover:from-teal-500 hover:to-emerald-500"
              disabled={pending}
            >
              {pending ? "Signing in…" : "Sign in"}
            </Button>
            <p className="text-center text-sm text-white/45">
              No account?{" "}
              <Link href="/register" className="font-medium text-teal-400 underline underline-offset-4 hover:text-teal-300">
                Register
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
