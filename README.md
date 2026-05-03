# Prooflane

*A blockchain-backed compliance transparency layer for companies: autonomous agents continuously verify controls, score readiness, and anchor evidence on 0G.*

---

## The problem

Modern companies change constantly: new services, refactors, repo settings, policies, vendors, and cloud configurations land every week. Traditional compliance snapshots go stale the moment something ships. A passing audit last quarter does not prove today’s access controls, change-management posture, logging, encryption, or policy coverage. **Drift is normal.** What teams lack is a repeatable way to re-measure controls against live systems and to show *what was checked, when, and with what evidence*, especially when customers and partners ask whether they are interacting with a security-conscious vendor.

Prooflane addresses that gap with **policy-aligned compliance agents** that inspect operational systems, cloud posture, source-control governance, and uploaded policy evidence, then publish a transparent record of what happened. GitHub and AWS are the first live integration surfaces, but the product is built around a broader principle: companies should be able to prove their current security posture with fresh checks, structured findings, and verifiable evidence instead of static claims.

The blockchain layer makes the system more transparent. Evidence bundles can be content-addressed and anchored through **0G**, creating references that buyers, partners, and internal reviewers can inspect when they want confidence that a company’s published posture maps to real artifacts. Outputs support customer trust pages, internal governance, and security questionnaires. They complement qualified audits and counsel; they are not a substitute for formal certification.

---

## What Prooflane delivers

| Capability | Description |
|------------|-------------|
| **Agents that track reality** | Compliance agents map framework lenses (SOC 2-oriented, GDPR, PCI DSS, HIPAA) to concrete checks on your operating environment so reassessment reflects current configuration, not last month's spreadsheet. |
| **Transparent runs** | Each assessment logs phases (integrations loaded, controls executed, evidence packaged, report generated) and stores per-control PASS, FAIL, or UNKNOWN with messages and structured evidence. Stakeholders see what the engine did, not a black-box score. |
| **Verifiable evidence** | Evidence bundles can be anchored with content-derived hashes and **0G** chain references so independent parties can correlate published posture with tamper-evident artifacts. |
| **Multi-lens assessments** | Run scoring passes against the same underlying control library; each lens activates controls tagged for that program. |
| **Live integrations** | Uses connected systems as evidence sources. Current checks cover GitHub repository governance, AWS IAM, CloudTrail and S3 posture, plus uploaded policy documents. |
| **Weighted readiness score** | Aggregates PASS, FAIL, and UNKNOWN results into a single 0-100 score with category breakdowns. |
| **Evidence and reporting** | Persists per-control results, structured JSON evidence, and an executive narrative grounded in actual findings. |
| **Progress visibility** | Server-side activity logs show phases, integration status, per-control outcomes, and report generation for operators running assessments. |
| **Public trust surface** | Organization-scoped pages summarize posture so buyers and partners can quickly understand how your company proves security readiness. |
| **Webhooks** | GitHub push events can trigger compliance runs so evaluations stay aligned with changes to protected branches and repository configuration. |

---

## Architecture

Prooflane is an **npm workspaces monorepo**: a Next.js product surface, a Node API, and a shared core library that runs compliance agents, stores evidence, and integrates with 0G infrastructure.

```mermaid
flowchart LR
  subgraph clients [Clients]
    Browser[Browser]
  end
  subgraph apps [Applications]
    Web[apps/web Next.js]
    API[apps/api Express]
  end
  subgraph core [packages/core]
    Agents[Compliance agents]
    Eval[Control evaluators]
    Reports[Narrative and grounding]
    OG[0G Storage and compute clients]
    DB[Prisma data access]
  end
  subgraph data [Data and chain]
    PG[(PostgreSQL)]
    ZG[0G Galileo testnet Storage and Compute]
  end
  Browser --> Web
  Web --> API
  API --> core
  core --> PG
  core --> ZG
```

- **`apps/web`:** Dashboard, onboarding, GitHub and AWS connection flows, compliance run launcher with live activity, run history and detail views, authentication (NextAuth-style session), public trust pages.
- **`apps/api`:** REST API for organizations, integrations, compliance runs, reports, and GitHub webhook ingestion.
- **`packages/core`:** Control definitions, evaluators (GitHub API, AWS SDK, policy document analysis), scoring, compliance orchestration, Prisma access, **0G Storage** uploads for evidence bundles, optional **0G Compute** (or compatible router) for narrative generation, report grounding so prose matches measured results.

**Database:** PostgreSQL via Prisma (managed Neon or self-hosted). The schema covers users, organizations, integrations, compliance runs with optional progress logs, control results, policy uploads, and structured reports.

---

## How an assessment run works

1. **Organization context.** Prooflane loads company context, linked integrations, and policy artifacts. GitHub and AWS provide the current live system signals. Missing scopes surface as UNKNOWN where evidence cannot be collected.
2. **Lens selection.** You choose a framework lens (`soc2`, `gdpr`, `pci`, `hipaa`). The engine filters to controls that apply to that lens.
3. **Evaluation.** For each control, evaluators call GitHub or AWS APIs or analyze uploaded policy text. Results are PASS, FAIL, or UNKNOWN with human-readable messages and structured evidence payloads.
4. **Evidence bundle.** Results are serialized into a single bundle (run metadata, timestamps, per-control outcomes). The bundle is uploaded through **0G Storage** when Galileo RPC, indexer, and wallet keys are configured. Uploads are content-addressed; a root hash and transaction hash tie the bundle to chain activity. If the network path does not complete within policy timeouts, the run still records a content fingerprint so scoring and reporting are never blocked.
5. **Scoring.** A weighted formula produces an overall readiness score and category-level statistics.
6. **Report.** A structured narrative is produced using configured **0G Compute** (quickstart) or an OpenAI-compatible router. Output is **grounded**: model copy is merged with live metrics so scores and remediation items stay faithful to evaluation results.
7. **Persistence.** Reports, scores, hashes, and explorer links are stored on the compliance run for audit trails and UI display.

---

## Control library (overview)

The product ships **twelve technical controls** across three domains:

- **GitHub and change management:** Branch protection, required reviews, status checks, CODEOWNERS, secret-pattern heuristics on tracked files.
- **AWS and infrastructure:** CloudTrail enablement, S3 encryption and public access posture, root account MFA and access keys, IAM password policy.
- **Policies and governance:** Presence and content signals for uploaded security and incident-response documents.

Controls carry framework tags (for example SOC 2, ISO 27001 themes, GDPR, PCI, HIPAA) so each agent lens maps measurable checks to the narrative customers, partners, and internal reviewers expect.

---

## 0G (decentralized infrastructure)

Prooflane integrates with **0G** on **Galileo testnet** to make compliance evidence more transparent and independently inspectable:

1. **0G Storage.** Evidence bundles are written through the official TypeScript SDK and indexer. Successful uploads yield a root hash and transaction hash used as tamper-evident references and explorer links (Galileo transaction URLs).
2. **0G Compute.** Optional narrative generation uses the published compute quickstart (OpenAI-compatible proxy). Router credentials are supported as an alternative deployment pattern.

The result is a product experience where a company can present compliance posture with the underlying evidence trail, not just marketing language.

Environment variables and operational notes live in **`.env.example`**. Funding testnet wallets through the public faucet is required for storage fees and compute ledger usage.

---

## Repository layout

```
apps/web/          Next.js UI and API routes for auth
apps/api/          Express API (routes, webhooks)
packages/core/     Domain logic, agents, evaluators, 0G clients, Prisma client output
prisma/            Schema and SQL migrations
scripts/           Operational helpers (for example 0G compute setup)
docker-compose.yml Local PostgreSQL and optional containerized app wiring
```

---

## Requirements

- **Node.js** 20+
- **PostgreSQL** (local Docker or hosted)
- Optional: **0G** RPC URLs, indexer URL, and funded wallet keys for Storage and Compute on Galileo testnet

---

## Quick start (development)

```bash
npm install
cp .env.example .env
# Set DATABASE_URL, AUTH_SECRET, NEXTAUTH_URL, API URLs as in .env.example

npx prisma migrate deploy
# or: npm run db:push

npm run dev:all
```

The web app and API start together (`dev:all`). Point `NEXT_PUBLIC_API_URL` (or your internal proxy) at the API port your stack uses.

---

## Production and Docker

`docker-compose.yml` provides PostgreSQL and a build path for a containerized web stack. Set secrets and 0G-related variables from your orchestration layer. Run database migrations as part of deploy (`npm run db:migrate`).

---

## Security and compliance posture

- Store **secrets** (database URLs, `AUTH_SECRET`, GitHub OAuth, AWS keys, 0G private keys) in a secrets manager. Never commit `.env`.
- Prooflane surfaces **readiness** and **technical evidence** for company trust workflows. Customers remain responsible for scope, policies, agreements, and formal attestations.
- **UNKNOWN** results indicate inconclusive or missing evidence (for example disconnected integrations). Treat them as open items until remediated or rescanned.

---

## License and support

This repository is private to your organization unless otherwise published. For partnerships, deployment architecture, or custom control packs, contact your team lead.

---

**Prooflane:** company compliance readiness, transparent agents, anchored evidence, and narratives your buyers can verify.
