"use client";

import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useState } from "react";
import { getApiUrl } from "@/lib/api-url";
import { formatApiErrorText } from "@/lib/api-response";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function PolicyUploadForm({ organizationId }: { organizationId: string }) {
  const router = useRouter();
  const { data: session } = useSession();
  const [kind, setKind] = useState<"SECURITY" | "IR">("SECURITY");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage(null);
    const token = session?.accessToken;
    if (!token) {
      setMessage("Not signed in");
      return;
    }
    const form = e.currentTarget;
    const fd = new FormData(form);
    fd.set("organizationId", organizationId);
    fd.set("kind", kind);
    setPending(true);
    const res = await fetch(`${getApiUrl()}/v1/policy/upload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: fd,
    });
    const text = await res.text();
    setPending(false);
    if (!res.ok) {
      setMessage(formatApiErrorText(res.status, text));
      return;
    }
    setMessage("Uploaded to 0G Storage.");
    form.reset();
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 max-w-md">
      <div className="flex gap-2">
        <Button
          type="button"
          variant={kind === "SECURITY" ? "default" : "outline"}
          size="sm"
          onClick={() => setKind("SECURITY")}
        >
          Security policy
        </Button>
        <Button
          type="button"
          variant={kind === "IR" ? "default" : "outline"}
          size="sm"
          onClick={() => setKind("IR")}
        >
          Incident response
        </Button>
      </div>
      <div className="space-y-2">
        <Label htmlFor="policy-file">File (.md / .txt)</Label>
        <Input id="policy-file" name="file" type="file" accept=".md,.txt,text/*" required />
      </div>
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Uploading…" : "Upload & anchor on 0G"}
      </Button>
      {message && <p className="text-sm text-muted-foreground">{message}</p>}
    </form>
  );
}
