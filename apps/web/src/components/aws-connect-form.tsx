"use client";

import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useState } from "react";
import { getApiUrl } from "@/lib/api-url";
import { formatApiErrorText } from "@/lib/api-response";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield } from "lucide-react";

export function AwsConnectForm({
  organizationId,
  initialRegion,
  variant = "default",
}: {
  organizationId: string;
  initialRegion: string;
  variant?: "default" | "onboarding";
}) {
  const router = useRouter();
  const { data: session } = useSession();
  const [accessKeyId, setAccessKeyId] = useState("");
  const [secretAccessKey, setSecretAccessKey] = useState("");
  const [region, setRegion] = useState(initialRegion);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputClass =
    variant === "onboarding"
      ? "border-white/10 bg-black/30 text-white placeholder:text-white/35"
      : "";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const tok = session?.accessToken;
    if (!tok) {
      setError("Not signed in");
      return;
    }
    setPending(true);
    const res = await fetch(`${getApiUrl()}/v1/integrations/aws`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tok}`,
      },
      body: JSON.stringify({
        organizationId,
        accessKeyId,
        secretAccessKey,
        region,
      }),
    });
    const text = await res.text();
    setPending(false);
    if (!res.ok) {
      setError(formatApiErrorText(res.status, text));
      return;
    }
    setAccessKeyId("");
    setSecretAccessKey("");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {variant === "onboarding" && (
        <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.06] p-4 text-sm text-amber-100/90">
          <div className="flex gap-3">
            <Shield className="mt-0.5 size-5 shrink-0 text-amber-400/90" aria-hidden />
            <div className="space-y-2">
              <p className="font-medium text-white">Secure connection (recommended pattern)</p>
              <p className="text-white/70 leading-relaxed">
                Create an IAM user used only for this integration. Attach a custom policy limited to
                read APIs your compliance checks need (CloudTrail, IAM read, S3 list where relevant).
                Rotate keys if they are ever exposed. For production, many teams replace static keys
                with IAM roles and OIDC from your CI or identity provider.
              </p>
              <a
                href="https://docs.aws.amazon.com/IAM/latest/UserGuide/id_users_create.html"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block text-teal-400 underline underline-offset-4 hover:text-teal-300"
              >
                AWS docs: create IAM users
              </a>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="ak">Access key ID</Label>
          <Input
            id="ak"
            value={accessKeyId}
            onChange={(e) => setAccessKeyId(e.target.value)}
            autoComplete="off"
            required
            className={inputClass}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="sk">Secret access key</Label>
          <Input
            id="sk"
            type="password"
            value={secretAccessKey}
            onChange={(e) => setSecretAccessKey(e.target.value)}
            autoComplete="off"
            required
            className={inputClass}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="region">Default region</Label>
          <Input
            id="region"
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            required
            className={inputClass}
            placeholder="us-east-1"
          />
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <Button
          type="submit"
          disabled={pending}
          className={
            variant === "onboarding"
              ? "bg-gradient-to-r from-amber-700/90 to-orange-700/90 text-white hover:from-amber-600 hover:to-orange-600"
              : ""
          }
        >
          {pending ? "Connecting…" : "Save & connect AWS"}
        </Button>
      </form>
    </div>
  );
}
