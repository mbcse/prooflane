import { randomBytes } from "node:crypto";
import type { Application } from "express";
import type { Prisma } from "@prisma/client";
import multer from "multer";
import { hash, compare } from "bcryptjs";
import { z } from "zod";
import prisma from "./lib/prisma.js";
import coreServer from "@openagents/core/server";

const { queueComplianceRun, storeEvidence } = coreServer;
import { asyncHandler } from "./async-handler.js";
import { signUserToken } from "./lib/jwt.js";
import { assertOrgOwner } from "./lib/org.js";
import type { AuthedRequest } from "./lib/auth-hook.js";
import { requireBearerAuth } from "./lib/auth-hook.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
});

/** Public URL GitHub hits for webhooks (set in production, e.g. https://api.example.com). */
function publicApiBaseForWebhooks(): string {
  const raw =
    process.env.PUBLIC_API_URL ?? process.env.WEBHOOK_PUBLIC_URL ?? "";
  return raw.replace(/\/$/, "");
}

function slugify(s: string) {
  const base = s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  return base || "org";
}

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).max(120),
  organizationName: z.string().min(1).max(120),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const githubProvisionSchema = z.object({
  githubId: z.string().min(1),
  email: z.string().email(),
  name: z.string().min(1).max(120).optional(),
  /** GitHub OAuth access token (repo scope); stored for repo picker and API calls. */
  githubAccessToken: z.string().min(1).optional(),
});

async function fetchGitHubCommitActivity(
  token: string,
  owner: string,
  repo: string,
): Promise<
  { sha: string; message: string; at: string }[] | null
> {
  const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits?per_page=10`;
  const res = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) return null;
  const rows = (await res.json()) as {
    sha: string;
    commit: { message: string; author: { date?: string } | null };
  }[];
  if (!Array.isArray(rows)) return null;
  return rows.map((r) => ({
    sha: r.sha.slice(0, 7),
    message: (r.commit.message ?? "").split("\n")[0]!.slice(0, 160),
    at: r.commit.author?.date ?? "",
  }));
}

type GitHubRepoListItem = {
  id: number;
  fullName: string;
  name: string;
  ownerLogin: string;
  private: boolean;
  defaultBranch: string;
  updatedAt: string;
};

async function listUserGitHubRepos(ghToken: string): Promise<GitHubRepoListItem[]> {
  const out: GitHubRepoListItem[] = [];
  for (let page = 1; page <= 8; page++) {
    const url = new URL("https://api.github.com/user/repos");
    url.searchParams.set("per_page", "100");
    url.searchParams.set("page", String(page));
    url.searchParams.set("affiliation", "owner,collaborator,organization_member");
    url.searchParams.set("sort", "updated");
    const res = await fetch(url, {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${ghToken}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });
    if (!res.ok) {
      throw new Error(`GitHub repos: HTTP ${res.status}`);
    }
    const batch = (await res.json()) as {
      id: number;
      name: string;
      full_name: string;
      owner?: { login?: string };
      private: boolean;
      default_branch?: string;
      updated_at?: string;
    }[];
    if (!Array.isArray(batch) || batch.length === 0) break;
    for (const r of batch) {
      out.push({
        id: r.id,
        fullName: r.full_name,
        name: r.name,
        ownerLogin: r.owner?.login ?? "",
        private: r.private,
        defaultBranch: r.default_branch ?? "main",
        updatedAt: r.updated_at ?? "",
      });
    }
    if (batch.length < 100) break;
  }
  return out;
}

const runBodySchema = z.object({
  organizationId: z.string(),
  agentId: z.enum(["soc2", "gdpr", "pci", "hipaa"]).optional(),
});

const githubSchema = z.object({
  organizationId: z.string(),
  /** If omitted, uses your stored GitHub OAuth token. */
  token: z.string().min(1).optional(),
  owner: z.string().min(1),
  repo: z.string().min(1),
});

const awsSchema = z.object({
  organizationId: z.string(),
  accessKeyId: z.string().min(1),
  secretAccessKey: z.string().min(1),
  region: z.string().min(1),
});

const patchOrgSchema = z.object({
  productSummary: z.string().max(8000).optional().nullable(),
  primaryComplianceGoal: z.string().max(200).optional().nullable(),
  onboardingSkippedAt: z.string().optional().nullable(),
});

export function registerRoutes(app: Application) {
  app.get("/health", (_req, res) => {
    res.json({ ok: true, service: "prooflane-api" });
  });
  app.get("/v1/health", (_req, res) => {
    res.json({ ok: true, service: "prooflane-api" });
  });

  app.post(
    "/v1/auth/register",
    asyncHandler(async (req, res) => {
      const parsed = registerSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Invalid input" });
        return;
      }
      const { email, password, name, organizationName } = parsed.data;

      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) {
        res.status(409).json({ error: "Email already registered" });
        return;
      }

      const passwordHash = await hash(password, 12);
      const baseSlug = slugify(organizationName);
      let slug = baseSlug;
      let n = 0;
      while (await prisma.organization.findUnique({ where: { slug } })) {
        n += 1;
        slug = `${baseSlug}-${n}`;
      }

      await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const user = await tx.user.create({
          data: { email, passwordHash, name },
        });
        await tx.organization.create({
          data: {
            name: organizationName,
            slug,
            ownerUserId: user.id,
          },
        });
      });

      res.json({ ok: true });
    }),
  );

  app.post(
    "/v1/auth/login",
    asyncHandler(async (req, res) => {
      const parsed = loginSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Invalid input" });
        return;
      }
      const { email, password } = parsed.data;
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        res.status(401).json({ error: "Invalid credentials" });
        return;
      }
      if (!user.passwordHash) {
        res
          .status(401)
          .json({ error: "This account uses GitHub sign-in" });
        return;
      }
      const ok = await compare(password, user.passwordHash);
      if (!ok) {
        res.status(401).json({ error: "Invalid credentials" });
        return;
      }
      const org = await prisma.organization.findFirst({
        where: { ownerUserId: user.id },
      });
      const token = await signUserToken({
        sub: user.id,
        orgId: org?.id ?? null,
      });
      res.json({
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          organizationId: org?.id ?? null,
        },
      });
    }),
  );

  app.post(
    "/v1/auth/github/provision",
    asyncHandler(async (req, res) => {
      const internal = String(req.headers["x-internal-secret"] ?? "");
      if (
        !process.env.INTERNAL_OAUTH_PROVISION_SECRET ||
        internal !== process.env.INTERNAL_OAUTH_PROVISION_SECRET
      ) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      const parsed = githubProvisionSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Invalid input" });
        return;
      }
      const { githubId, email, name, githubAccessToken: ghAccess } = parsed.data;
      const saveTok = ghAccess ? { githubAccessToken: ghAccess } : {};

      const byGh = await prisma.user.findUnique({ where: { githubId } });
      if (byGh) {
        if (ghAccess) {
          await prisma.user.update({
            where: { id: byGh.id },
            data: { githubAccessToken: ghAccess },
          });
        }
        const org = await prisma.organization.findFirst({
          where: { ownerUserId: byGh.id },
        });
        const token = await signUserToken({
          sub: byGh.id,
          orgId: org?.id ?? null,
        });
        res.json({
          token,
          user: {
            id: byGh.id,
            email: byGh.email,
            name: byGh.name,
            organizationId: org?.id ?? null,
          },
        });
        return;
      }

      const byEmail = await prisma.user.findUnique({ where: { email } });
      if (byEmail) {
        if (byEmail.githubId && byEmail.githubId !== githubId) {
          res.status(409).json({ error: "Email is linked to another GitHub account" });
          return;
        }
        const updated = await prisma.user.update({
          where: { id: byEmail.id },
          data: { githubId, name: name ?? byEmail.name, ...saveTok },
        });
        const org = await prisma.organization.findFirst({
          where: { ownerUserId: updated.id },
        });
        const token = await signUserToken({
          sub: updated.id,
          orgId: org?.id ?? null,
        });
        res.json({
          token,
          user: {
            id: updated.id,
            email: updated.email,
            name: updated.name,
            organizationId: org?.id ?? null,
          },
        });
        return;
      }

      const baseSlug = slugify(
        (name && name.trim()) || email.split("@")[0] || "org",
      );
      let slug = baseSlug;
      let n = 0;
      while (await prisma.organization.findUnique({ where: { slug } })) {
        n += 1;
        slug = `${baseSlug}-${n}`;
      }
      const orgName = name?.trim() || email.split("@")[0] || "My organization";

      const created = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const u = await tx.user.create({
          data: {
            email,
            passwordHash: null,
            name: name ?? null,
            githubId,
            ...(ghAccess ? { githubAccessToken: ghAccess } : {}),
          },
        });
        await tx.organization.create({
          data: { name: orgName, slug, ownerUserId: u.id },
        });
        return u;
      });

      const org = await prisma.organization.findFirst({
        where: { ownerUserId: created.id },
      });
      const token = await signUserToken({
        sub: created.id,
        orgId: org?.id ?? null,
      });
      res.json({
        token,
        user: {
          id: created.id,
          email: created.email,
          name: created.name,
          organizationId: org?.id ?? null,
        },
      });
    }),
  );

  app.get(
    "/v1/me/dashboard",
    requireBearerAuth,
    asyncHandler(async (req, res) => {
      const userId = (req as AuthedRequest).userId;
      const org = await prisma.organization.findFirst({
        where: { ownerUserId: userId },
        include: { integrations: true },
      });
      if (!org) {
        res.status(404).json({ error: "No organization" });
        return;
      }
      const latestRun = await prisma.complianceRun.findFirst({
        where: { organizationId: org.id, status: "COMPLETED" },
        orderBy: { finishedAt: "desc" },
      });
      const userRow = await prisma.user.findUnique({
        where: { id: userId },
        select: { githubAccessToken: true },
      });
      res.json({
        organization: {
          id: org.id,
          name: org.name,
          slug: org.slug,
          productSummary: org.productSummary,
          primaryComplianceGoal: org.primaryComplianceGoal,
          onboardingSkippedAt: org.onboardingSkippedAt,
          githubOAuthConnected: Boolean(userRow?.githubAccessToken),
          integrations: org.integrations.map((i: (typeof org.integrations)[number]) => ({
            id: i.id,
            type: i.type,
            status: i.status,
            lastSyncedAt: i.lastSyncedAt,
          })),
        },
        latestRun: latestRun
          ? {
              id: latestRun.id,
              overallScore: latestRun.overallScore,
              finishedAt: latestRun.finishedAt,
              status: latestRun.status,
            }
          : null,
      });
    }),
  );

  app.get(
    "/v1/me/onboarding",
    requireBearerAuth,
    asyncHandler(async (req, res) => {
      const userId = (req as AuthedRequest).userId;
      const org = await prisma.organization.findFirst({
        where: { ownerUserId: userId },
        include: { integrations: true },
      });
      if (!org) {
        res.status(404).json({ error: "No organization" });
        return;
      }
      const userRow = await prisma.user.findUnique({
        where: { id: userId },
        select: { githubAccessToken: true },
      });
      type IntRow = (typeof org.integrations)[number];
      const ghInt = org.integrations.find((i: IntRow) => i.type === "GITHUB");
      const awsInt = org.integrations.find((i: IntRow) => i.type === "AWS");
      const ghCfg = ghInt?.config as { owner?: string; repo?: string } | undefined;
      const awsCfg = awsInt?.config as { region?: string } | undefined;

      res.json({
        organization: {
          id: org.id,
          name: org.name,
          slug: org.slug,
          productSummary: org.productSummary,
          primaryComplianceGoal: org.primaryComplianceGoal,
          onboardingSkippedAt: org.onboardingSkippedAt,
          integrations: org.integrations.map((i: (typeof org.integrations)[number]) => ({
            id: i.id,
            type: i.type,
            status: i.status,
            lastSyncedAt: i.lastSyncedAt,
          })),
        },
        githubOAuthConnected: Boolean(userRow?.githubAccessToken),
        githubIntegration: ghInt
          ? {
              status: ghInt.status,
              owner: ghCfg?.owner ?? "",
              repo: ghCfg?.repo ?? "",
            }
          : null,
        awsIntegration: awsInt
          ? {
              status: awsInt.status,
              region: awsCfg?.region ?? "us-east-1",
            }
          : null,
      });
    }),
  );

  app.patch(
    "/v1/me/organization",
    requireBearerAuth,
    asyncHandler(async (req, res) => {
      const userId = (req as AuthedRequest).userId;
      const parsed = patchOrgSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Invalid input" });
        return;
      }
      const org = await prisma.organization.findFirst({
        where: { ownerUserId: userId },
      });
      if (!org) {
        res.status(404).json({ error: "No organization" });
        return;
      }
      const d = parsed.data;
      const update: {
        productSummary?: string | null;
        primaryComplianceGoal?: string | null;
        onboardingSkippedAt?: Date | null;
      } = {};
      if (d.productSummary !== undefined) {
        update.productSummary =
          d.productSummary === null || d.productSummary === "" ? null : d.productSummary;
      }
      if (d.primaryComplianceGoal !== undefined) {
        update.primaryComplianceGoal =
          d.primaryComplianceGoal === null || d.primaryComplianceGoal === ""
            ? null
            : d.primaryComplianceGoal;
      }
      if (d.onboardingSkippedAt !== undefined) {
        if (d.onboardingSkippedAt === null || d.onboardingSkippedAt === "") {
          update.onboardingSkippedAt = null;
        } else {
          update.onboardingSkippedAt = new Date(d.onboardingSkippedAt);
        }
      }
      await prisma.organization.update({
        where: { id: org.id },
        data: update,
      });
      res.json({ ok: true });
    }),
  );

  app.get(
    "/v1/me/compliance-runs",
    requireBearerAuth,
    asyncHandler(async (req, res) => {
      const userId = (req as AuthedRequest).userId;
      const org = await prisma.organization.findFirst({
        where: { ownerUserId: userId },
      });
      if (!org) {
        res.status(404).json({ error: "No organization" });
        return;
      }
      const runs = await prisma.complianceRun.findMany({
        where: { organizationId: org.id },
        orderBy: { startedAt: "desc" },
        take: 50,
      });
      res.json({ runs });
    }),
  );

  app.get(
    "/v1/me/integration/github",
    requireBearerAuth,
    asyncHandler(async (req, res) => {
      const userId = (req as AuthedRequest).userId;
      const org = await prisma.organization.findFirst({
        where: { ownerUserId: userId },
      });
      if (!org) {
        res.status(404).json({ error: "No organization" });
        return;
      }
      const integration = await prisma.integration.findUnique({
        where: {
          organizationId_type: { organizationId: org.id, type: "GITHUB" },
        },
      });
      const userRow = await prisma.user.findUnique({
        where: { id: userId },
        select: { githubAccessToken: true },
      });
      const cfg = integration?.config as
        | {
            owner?: string;
            repo?: string;
            activityPreview?: { sha: string; message: string; at: string }[];
            activitySyncedAt?: string;
            webhookSecret?: string;
          }
        | undefined;
      const base = publicApiBaseForWebhooks();
      const webhookUrl = base ? `${base}/v1/webhooks/github` : "";
      const webhookSecret =
        typeof cfg?.webhookSecret === "string" && cfg.webhookSecret.length >= 16
          ? cfg.webhookSecret
          : null;
      res.json({
        organizationId: org.id,
        githubOAuthConnected: Boolean(userRow?.githubAccessToken),
        webhookUrl,
        webhookSecretConfigured: Boolean(
          webhookSecret ?? process.env.GITHUB_WEBHOOK_SECRET,
        ),
        integration: integration
          ? {
              status: integration.status,
              lastSyncedAt: integration.lastSyncedAt,
              owner: cfg?.owner ?? "",
              repo: cfg?.repo ?? "",
              activityPreview: cfg?.activityPreview ?? null,
              activitySyncedAt: cfg?.activitySyncedAt ?? null,
              /** Copy into GitHub repo webhook “Secret” field (same org only). */
              webhookSecret,
            }
          : null,
      });
    }),
  );

  app.get(
    "/v1/me/github/repos",
    requireBearerAuth,
    asyncHandler(async (req, res) => {
      const userId = (req as AuthedRequest).userId;
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { githubAccessToken: true },
      });
      if (!user?.githubAccessToken) {
        res.status(400).json({
          error:
            "GitHub is not authorized for repository access. Sign in with GitHub (repo scope) or click Connect GitHub on the integration page.",
        });
        return;
      }
      try {
        const repos = await listUserGitHubRepos(user.githubAccessToken);
        res.json({ repos });
      } catch (e) {
        res.status(502).json({
          error: e instanceof Error ? e.message : "Failed to list GitHub repositories",
        });
      }
    }),
  );

  app.get(
    "/v1/me/integration/aws",
    requireBearerAuth,
    asyncHandler(async (req, res) => {
      const userId = (req as AuthedRequest).userId;
      const org = await prisma.organization.findFirst({
        where: { ownerUserId: userId },
      });
      if (!org) {
        res.status(404).json({ error: "No organization" });
        return;
      }
      const integration = await prisma.integration.findUnique({
        where: {
          organizationId_type: { organizationId: org.id, type: "AWS" },
        },
      });
      const cfg = integration?.config as { region?: string } | undefined;
      res.json({
        organizationId: org.id,
        integration: integration
          ? {
              status: integration.status,
              lastSyncedAt: integration.lastSyncedAt,
              region: cfg?.region ?? "us-east-1",
            }
          : null,
      });
    }),
  );

  app.get(
    "/v1/public/trust/:slug",
    asyncHandler(async (req, res) => {
      const slug = req.params.slug;
      const org = await prisma.organization.findUnique({
        where: { slug },
      });
      if (!org) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      const run = await prisma.complianceRun.findFirst({
        where: { organizationId: org.id, status: "COMPLETED" },
        orderBy: { finishedAt: "desc" },
        include: { report: true },
      });
      const integrations = await prisma.integration.findMany({
        where: { organizationId: org.id, status: "CONNECTED" },
      });
      res.json({
        organization: { id: org.id, name: org.name, slug: org.slug },
        run,
        connectedTypes: integrations.map((i: (typeof integrations)[number]) => i.type),
      });
    }),
  );

  app.get(
    "/v1/compliance/runs",
    requireBearerAuth,
    asyncHandler(async (req, res) => {
      const userId = (req as AuthedRequest).userId;
      const organizationId =
        typeof req.query.organizationId === "string"
          ? req.query.organizationId
          : undefined;
      if (!organizationId) {
        res.status(400).json({ error: "organizationId required" });
        return;
      }
      try {
        await assertOrgOwner(userId, organizationId);
      } catch {
        res.status(403).json({ error: "Forbidden" });
        return;
      }
      const runs = await prisma.complianceRun.findMany({
        where: { organizationId },
        orderBy: { startedAt: "desc" },
        take: 50,
        select: {
          id: true,
          status: true,
          overallScore: true,
          startedAt: true,
          finishedAt: true,
          storageTxHash: true,
        },
      });
      res.json({ runs });
    }),
  );

  app.get(
    "/v1/compliance/runs/:id",
    requireBearerAuth,
    asyncHandler(async (req, res) => {
      const userId = (req as AuthedRequest).userId;
      const { id } = req.params;
      const run = await prisma.complianceRun.findUnique({
        where: { id },
        include: {
          controlResults: true,
          report: true,
          organization: true,
        },
      });
      if (!run) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      try {
        await assertOrgOwner(userId, run.organizationId);
      } catch {
        res.status(403).json({ error: "Forbidden" });
        return;
      }
      res.json({
        run: {
          id: run.id,
          organizationId: run.organizationId,
          status: run.status,
          overallScore: run.overallScore,
          startedAt: run.startedAt,
          finishedAt: run.finishedAt,
          storageRootHash: run.storageRootHash,
          storageTxHash: run.storageTxHash,
          ogEvidenceUri: run.ogEvidenceUri,
          ogEvidenceHash: run.ogEvidenceHash,
          routerModel: run.routerModel,
          errorMessage: run.errorMessage,
          agentId: run.agentId,
          progressLog: run.progressLog ?? null,
        },
        controlResults: run.controlResults,
        report: run.report,
      });
    }),
  );

  app.post(
    "/v1/compliance/run",
    requireBearerAuth,
    asyncHandler(async (req, res) => {
      const userId = (req as AuthedRequest).userId;
      const parsed = runBodySchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Invalid body" });
        return;
      }
      const { organizationId, agentId } = parsed.data;
      try {
        await assertOrgOwner(userId, organizationId);
      } catch {
        res.status(403).json({ error: "Forbidden" });
        return;
      }
      try {
        const result = await queueComplianceRun(organizationId, userId, { agentId });
        res.status(202).json({
          runId: result.runId,
          status: "RUNNING",
          message: "Compliance run started — poll GET /v1/compliance/runs/:id for progressLog.",
        });
      } catch (e) {
        console.error(e);
        res.status(500).json({
          error: e instanceof Error ? e.message : "Run failed",
        });
      }
    }),
  );

  app.post(
    "/v1/integrations/github",
    requireBearerAuth,
    asyncHandler(async (req, res) => {
      const userId = (req as AuthedRequest).userId;
      const parsed = githubSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Invalid body" });
        return;
      }
      const { organizationId, token: bodyToken, owner, repo } = parsed.data;
      try {
        await assertOrgOwner(userId, organizationId);
      } catch {
        res.status(403).json({ error: "Forbidden" });
        return;
      }
      const u = await prisma.user.findUnique({
        where: { id: userId },
        select: { githubAccessToken: true },
      });
      const token = bodyToken ?? u?.githubAccessToken;
      if (!token) {
        res.status(400).json({
          error:
            "No GitHub credentials. Use Connect GitHub to authorize, or provide a personal access token in the advanced section.",
        });
        return;
      }
      const activity = await fetchGitHubCommitActivity(token, owner, repo);
      const now = new Date().toISOString();

      const existingGh = await prisma.integration.findUnique({
        where: {
          organizationId_type: { organizationId, type: "GITHUB" },
        },
      });
      const prevCfg = (existingGh?.config as Record<string, unknown>) ?? {};
      const prevSecret = prevCfg.webhookSecret;
      const webhookSecret =
        typeof prevSecret === "string" && prevSecret.length >= 16
          ? prevSecret
          : randomBytes(32).toString("hex");

      const config: Record<string, unknown> = {
        token,
        owner,
        repo,
        activitySyncedAt: now,
        webhookSecret,
      };
      if (activity) config.activityPreview = activity;

      await prisma.integration.upsert({
        where: {
          organizationId_type: { organizationId, type: "GITHUB" },
        },
        create: {
          organizationId,
          type: "GITHUB",
          status: "CONNECTED",
          config,
          lastSyncedAt: new Date(),
        },
        update: {
          status: "CONNECTED",
          config,
          lastSyncedAt: new Date(),
        },
      });
      res.json({ ok: true, commitActivityCount: activity?.length ?? 0 });
    }),
  );

  app.post(
    "/v1/integrations/aws",
    requireBearerAuth,
    asyncHandler(async (req, res) => {
      const userId = (req as AuthedRequest).userId;
      const parsed = awsSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Invalid body" });
        return;
      }
      const { organizationId, accessKeyId, secretAccessKey, region } =
        parsed.data;
      try {
        await assertOrgOwner(userId, organizationId);
      } catch {
        res.status(403).json({ error: "Forbidden" });
        return;
      }
      await prisma.integration.upsert({
        where: {
          organizationId_type: { organizationId, type: "AWS" },
        },
        create: {
          organizationId,
          type: "AWS",
          status: "CONNECTED",
          config: { accessKeyId, secretAccessKey, region },
          lastSyncedAt: new Date(),
        },
        update: {
          status: "CONNECTED",
          config: { accessKeyId, secretAccessKey, region },
          lastSyncedAt: new Date(),
        },
      });
      res.json({ ok: true });
    }),
  );

  app.post(
    "/v1/policy/upload",
    requireBearerAuth,
    upload.single("file"),
    asyncHandler(async (req, res) => {
      const userId = (req as AuthedRequest).userId;
      const organizationId = String(req.body.organizationId ?? "");
      const kindRaw = String(req.body.kind ?? "");
      const file = req.file;

      const kindSchema = z.enum(["SECURITY", "IR"]);
      const kind = kindSchema.safeParse(kindRaw);
      if (!organizationId || !kind.success || !file?.buffer) {
        res.status(400).json({ error: "Missing fields" });
        return;
      }

      try {
        await assertOrgOwner(userId, organizationId);
      } catch {
        res.status(403).json({ error: "Forbidden" });
        return;
      }

      const fileName = file.originalname || "upload";
      let mime = file.mimetype || "application/octet-stream";
      const fileBuffer = file.buffer;

      let textExtract: string | null = null;
      if (
        mime.startsWith("text/") ||
        mime === "application/json" ||
        fileName.endsWith(".md")
      ) {
        textExtract = fileBuffer.toString("utf8");
      } else if (mime === "application/pdf") {
        res.status(400).json({
          error:
            "PDF not parsed in MVP — upload .txt or .md for policy text extraction, or paste text into a .md file.",
        });
        return;
      } else {
        try {
          textExtract = fileBuffer.toString("utf8");
        } catch {
          res.status(400).json({ error: "Unsupported file type" });
          return;
        }
      }

      const payload = {
        type: "policy_document",
        kind: kind.data,
        fileName,
        organizationId,
        textLength: textExtract?.length ?? 0,
        excerpt: textExtract?.slice(0, 4000) ?? "",
      };

      const stored = await storeEvidence(payload);

      await prisma.policyDocument.create({
        data: {
          organizationId,
          kind: kind.data,
          fileName,
          mimeType: mime,
          storageRootHash: stored.rootHash,
          storageTxHash: stored.txHash,
          textExtract: textExtract?.slice(0, 100_000) ?? null,
        },
      });

      res.json({
        ok: true,
        storageRootHash: stored.rootHash,
        storagescanUrl: stored.storagescanUrl,
      });
    }),
  );
}
