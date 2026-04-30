import crypto from "node:crypto";
import type { Request, Response } from "express";
import coreServer from "@openagents/core/server";
import prisma from "../lib/prisma.js";

const { queueComplianceRun } = coreServer;

function verifyGitHubSignature(
  raw: Buffer,
  signatureHeader: string | undefined,
  secret: string,
): boolean {
  if (!signatureHeader?.startsWith("sha256=")) return false;
  const receivedHex = signatureHeader.slice(7);
  const expectedHex = crypto.createHmac("sha256", secret).update(raw).digest("hex");
  const a = Buffer.from(expectedHex, "hex");
  const b = Buffer.from(receivedHex, "hex");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

type GitHubConfig = {
  owner?: string;
  repo?: string;
  webhookSecret?: string;
  [key: string]: unknown;
};

/**
 * GitHub `push` webhooks: verify HMAC, map repo → org, run compliance async (202).
 * Expects `express.raw` body (Buffer) on this route only.
 */
export async function handleGitHubPushWebhook(req: Request, res: Response): Promise<void> {
  const raw = req.body;
  if (!Buffer.isBuffer(raw) || raw.length === 0) {
    res.status(400).json({ error: "Expected application/json body" });
    return;
  }

  const event = req.get("X-GitHub-Event");
  const delivery = req.get("X-GitHub-Delivery") ?? "unknown";

  if (event === "ping") {
    res.status(200).json({ ok: true, message: "pong" });
    return;
  }

  if (event !== "push") {
    res.status(202).json({ ignored: true, event: event ?? null });
    return;
  }

  let payload: {
    repository?: { full_name?: string; default_branch?: string };
    ref?: string;
  };
  try {
    payload = JSON.parse(raw.toString("utf8")) as typeof payload;
  } catch {
    res.status(400).json({ error: "Invalid JSON" });
    return;
  }

  const fullName = payload.repository?.full_name;
  if (!fullName) {
    res.status(400).json({ error: "Missing repository" });
    return;
  }

  const parts = fullName.split("/");
  const owner = parts[0];
  const repo = parts.slice(1).join("/");
  if (!owner || !repo) {
    res.status(400).json({ error: "Invalid repository full_name" });
    return;
  }

  const defaultBranch = payload.repository?.default_branch ?? "main";
  const ref = payload.ref ?? "";
  if (ref !== `refs/heads/${defaultBranch}`) {
    res.status(202).json({
      skipped: true,
      reason: "not_default_branch",
      ref,
      defaultBranch,
    });
    return;
  }

  const integrations = await prisma.integration.findMany({
    where: { type: "GITHUB", status: "CONNECTED" },
  });

  const ownerL = owner.toLowerCase();
  const repoL = repo.toLowerCase();
  const matches = integrations.filter((i: { config: unknown }) => {
    const c = i.config as GitHubConfig;
    return (
      String(c.owner ?? "").toLowerCase() === ownerL &&
      String(c.repo ?? "").toLowerCase() === repoL
    );
  });

  if (matches.length === 0) {
    res.status(404).json({ error: "No connected integration for this repository" });
    return;
  }

  const sigHeader = req.get("X-Hub-Signature-256");
  const globalSecret = process.env.GITHUB_WEBHOOK_SECRET;

  const verified: (typeof matches)[number][] = [];
  for (const i of matches) {
    const c = i.config as GitHubConfig;
    const secret = typeof c.webhookSecret === "string" ? c.webhookSecret : globalSecret;
    if (!secret) continue;
    if (verifyGitHubSignature(raw, sigHeader, secret)) {
      verified.push(i);
    }
  }

  if (verified.length === 0) {
    res.status(401).json({
      error:
        "Invalid webhook signature. Use the secret from Program → GitHub (or set GITHUB_WEBHOOK_SECRET).",
    });
    return;
  }

  const orgIds: string[] = [];
  for (const vi of verified) {
    const org = await prisma.organization.findUnique({
      where: { id: vi.organizationId },
      select: { id: true, ownerUserId: true },
    });
    if (!org) continue;
    orgIds.push(org.id);
    void queueComplianceRun(org.id, org.ownerUserId, {})
      .then((r) => {
        console.log(`[github webhook] delivery=${delivery} org=${org.id} runId=${r.runId}`);
      })
      .catch((e) => {
        console.error(`[github webhook] delivery=${delivery} org=${org.id}`, e);
      });
  }

  res.status(202).json({
    accepted: true,
    delivery,
    organizationIds: orgIds,
    repository: fullName,
    message: "Compliance run(s) started in the background",
  });
}
