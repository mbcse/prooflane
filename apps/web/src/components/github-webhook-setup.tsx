"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function GitHubWebhookSetup({
  webhookUrl,
  webhookSecret,
  connected,
}: {
  webhookUrl: string;
  webhookSecret: string | null;
  connected: boolean;
}) {
  const [done, setDone] = useState<string | null>(null);

  async function copy(label: string, text: string) {
    await navigator.clipboard.writeText(text);
    setDone(label);
    setTimeout(() => setDone(null), 2000);
  }

  if (!connected) {
    return (
      <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-white/55">
        Connect a repository above to get a webhook secret and payload URL. Each push to the
        repository&apos;s <span className="text-white/80">default branch</span> can trigger a
        compliance run.
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-xl border border-white/10 bg-black/20 p-4">
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-teal-400/90">
          Push-triggered compliance
        </p>
        <p className="mt-2 text-sm leading-relaxed text-white/55">
          In your GitHub repo go to <span className="text-white/80">Settings → Webhooks → Add
          webhook</span>. Use the payload URL and secret below. We verify each delivery with
          HMAC-SHA256 and only react to <span className="text-white/80">push</span> events on the{" "}
          <span className="text-white/80">default branch</span>.
        </p>
      </div>

      {!webhookUrl && (
        <p className="text-sm text-amber-200/90">
          Set <code className="rounded bg-white/10 px-1">PUBLIC_API_URL</code> on the API server to
          your public base URL (e.g. production API or an ngrok tunnel in development). Otherwise we
          cannot show the webhook URL.
        </p>
      )}

      {webhookUrl && (
        <div className="space-y-2">
          <p className="text-[11px] uppercase tracking-wide text-white/40">Payload URL</p>
          <div className="flex flex-wrap items-center gap-2">
            <code className="break-all rounded-lg bg-black/40 px-3 py-2 text-xs text-teal-300/95">
              {webhookUrl}
            </code>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-white/15 text-white"
              onClick={() => copy("url", webhookUrl)}
            >
              {done === "url" ? "Copied" : "Copy"}
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <p className="text-[11px] uppercase tracking-wide text-white/40">Secret</p>
        {webhookSecret ? (
          <div className="flex flex-wrap items-center gap-2">
            <code className="max-w-full break-all rounded-lg bg-black/40 px-3 py-2 text-xs text-white/75">
              {webhookSecret}
            </code>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-white/15 text-white"
              onClick={() => copy("secret", webhookSecret)}
            >
              {done === "secret" ? "Copied" : "Copy"}
            </Button>
          </div>
        ) : (
          <p className="text-sm text-white/45">
            Save the repository connection once to generate a webhook secret.
          </p>
        )}
      </div>

      <ul className="list-disc space-y-1 pl-5 text-xs text-white/45">
        <li>Content type: application/json</li>
        <li>Events: Let me select individual events → enable Push events only (disable Send everything).</li>
        <li>
          Local development: GitHub cannot reach localhost. Expose the API with ngrok (or similar)
          and set PUBLIC_API_URL to that HTTPS origin.
        </li>
      </ul>
    </div>
  );
}
