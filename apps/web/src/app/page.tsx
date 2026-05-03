import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { PRODUCT_NAME } from "@/lib/brand";
import { cn } from "@/lib/utils";
import {
  ArrowRight,
  Blocks,
  Building2,
  CheckCircle2,
  FileCheck2,
  LineChart,
  Shield,
  Sparkles,
  Zap,
} from "lucide-react";

const FRAMEWORKS = ["SOC 2", "HIPAA", "GDPR", "PCI DSS", "ISO 27001", "ISO 42001"] as const;

export default async function HomePage() {
  return (
    <div className="min-h-screen flex flex-col bg-[oklch(0.12_0.02_260)] text-foreground">
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[oklch(0.12_0.02_260)]/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link
            href="/"
            className="font-[family-name:var(--font-heading)] text-lg font-semibold tracking-tight text-white"
          >
            {PRODUCT_NAME}
          </Link>
          <nav className="hidden items-center gap-8 text-sm text-white/65 sm:flex">
            <a href="#product" className="transition-colors hover:text-white">
              Product
            </a>
            <a href="#frameworks" className="transition-colors hover:text-white">
              Frameworks
            </a>
            <a href="#evidence" className="transition-colors hover:text-white">
              Evidence layer
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className={cn(
                buttonVariants({ variant: "ghost", size: "sm" }),
                "hidden text-white/80 hover:bg-white/10 hover:text-white sm:inline-flex",
              )}
            >
              Log in
            </Link>
            <Link
              href="/register"
              className={cn(
                buttonVariants({ size: "sm" }),
                "border-0 bg-gradient-to-r from-teal-500 to-emerald-500 text-white shadow-lg shadow-teal-500/25 hover:from-teal-400 hover:to-emerald-400",
              )}
            >
              Get compliant
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero: compliance-first (Delve-style arc) */}
        <section className="relative overflow-hidden border-b border-white/10">
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_90%_60%_at_50%_-30%,oklch(0.45_0.14_195/0.45),transparent_55%)]"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_80%_60%,oklch(0.55_0.12_45/0.15),transparent)]"
            aria-hidden
          />
          <div className="relative mx-auto max-w-6xl px-4 pb-24 pt-20 sm:px-6 sm:pb-32 sm:pt-28">
            <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-teal-300/90 backdrop-blur-sm">
              <Shield className="size-3.5" aria-hidden />
              SOC 2 programs · continuous controls · AI narratives · proof you can share
            </p>
            <h1 className="max-w-4xl font-[family-name:var(--font-heading)] text-4xl font-semibold leading-[1.05] tracking-tight text-white sm:text-5xl md:text-6xl md:leading-[1.02]">
              Compliance that closes deals.
              <span className="mt-2 block bg-gradient-to-r from-teal-200 via-white to-amber-200/90 bg-clip-text text-transparent">
                Security that survives audits.
              </span>
            </h1>
            <p className="mt-8 max-w-2xl text-lg leading-relaxed text-white/70 sm:text-xl">
              Stop drowning in screenshots and spreadsheets. {PRODUCT_NAME} runs SOC 2-style
              controls, pulls evidence from GitHub and AWS, and uses AI to summarize gaps. Your
              receipts can be anchored on{" "}
              <span className="text-white/90">0G decentralized storage</span> so evidence is
              harder to dispute in buyer and auditor reviews.
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-3">
              <Link
                href="/register"
                className={cn(
                  buttonVariants({ size: "lg" }),
                  "gap-2 border-0 bg-gradient-to-r from-teal-500 to-emerald-500 px-8 text-base text-white shadow-xl shadow-teal-500/30 hover:from-teal-400 hover:to-emerald-400",
                )}
              >
                Start free
                <ArrowRight className="size-4" aria-hidden />
              </Link>
              <Link
                href="/login"
                className={cn(
                  buttonVariants({ variant: "outline", size: "lg" }),
                  "border-white/20 bg-white/5 text-white backdrop-blur-sm hover:bg-white/10",
                )}
              >
                Sign in
              </Link>
            </div>
            <ul className="mt-14 flex flex-wrap gap-x-10 gap-y-3 text-sm text-white/55">
              {[
                "Continuous control monitoring",
                "AI-generated readiness reports",
                "Public trust pages for prospects",
              ].map((t) => (
                <li key={t} className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 shrink-0 text-teal-400" aria-hidden />
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Readiness strip */}
        <section className="border-b border-white/10 bg-black/20 py-10">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <p className="text-center text-xs font-medium uppercase tracking-[0.2em] text-white/45">
              Program readiness
            </p>
            <div className="mx-auto mt-6 max-w-3xl">
              <div className="mb-3 flex justify-between text-sm text-white/70">
                <span>Controls · Evidence · Policies · Audit · Ship</span>
                <span className="font-mono text-teal-400/90">Live sync</span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full w-[72%] rounded-full bg-gradient-to-r from-teal-500 via-emerald-400 to-amber-400/90 shadow-[0_0_24px_oklch(0.72_0.15_175/0.4)]"
                  aria-hidden
                />
              </div>
              <p className="mt-3 text-center text-xs text-white/40">
                Illustrative bar. Your score updates whenever you run a compliance check.
              </p>
            </div>
          </div>
        </section>

        {/* Problem */}
        <section className="border-b border-white/10 py-20 sm:py-28">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="mx-auto max-w-3xl text-center">
              <h2 className="font-[family-name:var(--font-heading)] text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                Compliance busywork kills momentum.
              </h2>
              <p className="mt-5 text-lg text-white/65">
                Manual prep. Screenshots. Version chaos. Your team checks boxes instead of closing
                enterprise deals. Every delay is ARR left on the table, or a security review that
                never starts.
              </p>
            </div>
            <div className="mt-14 grid gap-6 sm:grid-cols-3">
              {[
                {
                  icon: LineChart,
                  title: "Revenue at risk",
                  body: "Buyers stall when you cannot produce credible SOC 2 or data-handling proof on time.",
                },
                {
                  icon: FileCheck2,
                  title: "Audit drag",
                  body: "Evidence scattered across drives and Slack threads does not survive scrutiny.",
                },
                {
                  icon: Building2,
                  title: "Team overload",
                  body: "Engineers shouldn’t be full-time compliance clerks. Automate the grind.",
                },
              ].map(({ icon: Icon, title, body }) => (
                <div
                  key={title}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-sm transition-colors hover:border-teal-500/30"
                >
                  <Icon className="size-9 text-teal-400/90" aria-hidden />
                  <h3 className="mt-4 font-[family-name:var(--font-heading)] text-lg font-semibold text-white">
                    {title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-white/55">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="frameworks" className="border-b border-white/10 py-14">
          <div className="mx-auto max-w-6xl px-4 text-center sm:px-6">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-white/45">
              Framework lenses
            </p>
            <p className="mt-3 text-white/70">
              Run controls mapped to what your customers ask for, starting with SOC 2, plus GDPR,
              HIPAA, PCI, and ISO-style lenses in product.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-2">
              {FRAMEWORKS.map((f) => (
                <span
                  key={f}
                  className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm text-white/85"
                >
                  {f}
                </span>
              ))}
            </div>
          </div>
        </section>

        <section id="product" className="py-20 sm:py-28">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="font-[family-name:var(--font-heading)] text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                Agentic compliance, built for how you ship.
              </h2>
              <p className="mt-4 text-white/60">
                Connect real infrastructure, run repeatable checks, export narratives your sales
                team can share. Not a slide deck from last quarter.
              </p>
            </div>
            <div className="mt-14 grid gap-6 lg:grid-cols-3">
              {[
                {
                  icon: Zap,
                  title: "Automate evidence collection",
                  body: "Pull signals from GitHub and AWS so your control story matches production, not a policy PDF.",
                },
                {
                  icon: Sparkles,
                  title: "AI that speaks auditor",
                  body: "Each run produces structured results and an executive-ready summary of strengths and gaps.",
                },
                {
                  icon: Blocks,
                  title: "Blockchain-backed proof",
                  body: "Anchor hashes on 0G decentralized storage so evidence carries an immutable receipt buyers can verify.",
                },
              ].map(({ icon: Icon, title, body }) => (
                <div
                  key={title}
                  className="group rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-transparent p-6 transition-all hover:border-teal-500/40"
                >
                  <div className="mb-4 inline-flex size-12 items-center justify-center rounded-2xl bg-teal-500/15 text-teal-300">
                    <Icon className="size-6" aria-hidden />
                  </div>
                  <h3 className="font-[family-name:var(--font-heading)] text-lg font-semibold text-white">
                    {title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-white/55">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section
          id="evidence"
          className="border-y border-white/10 bg-gradient-to-br from-teal-950/40 via-[oklch(0.14_0.03_260)] to-amber-950/20 py-20 sm:py-24"
        >
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-teal-400/80">
                  When proof needs to hold up
                </p>
                <h2 className="mt-3 font-[family-name:var(--font-heading)] text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                  Trust isn’t a folder on a drive.
                </h2>
                <p className="mt-5 text-white/65 leading-relaxed">
                  {PRODUCT_NAME} can pin compliance artifacts and run summaries using{" "}
                  <a
                    href="https://docs.0g.ai/"
                    className="font-medium text-teal-300 underline decoration-teal-500/50 underline-offset-4 hover:text-teal-200"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    0G Storage &amp; Compute
                  </a>
                  . Your evidence trail is harder to repudiate and easier to share under NDA with
                  serious buyers.
                </p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-black/30 p-8 font-mono text-xs text-white/50">
                <p className="text-[10px] uppercase tracking-wider text-teal-500/80">Anchored run</p>
                <p className="mt-4 break-all text-white/70">
                  storageRootHash · tx · public trust URL
                </p>
                <p className="mt-6 text-sm text-white/40">
                  Your dashboard surfaces hashes and links after each run. The same signals power
                  your public <span className="text-white/60">/trust/&lt;slug&gt;</span> page.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="py-20 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.07] to-transparent px-8 py-12 sm:px-12">
              <h2 className="font-[family-name:var(--font-heading)] text-2xl font-semibold text-white sm:text-3xl">
                Pick your frameworks. Connect your stack. Prove you’re ready.
              </h2>
              <p className="mt-4 max-w-xl text-white/60">
                Whether you are chasing your first SOC 2 or tightening controls before Series B
                diligence, one workspace for monitoring, evidence, and AI-written narratives.
              </p>
              <Link
                href="/register"
                className={cn(
                  buttonVariants({ size: "lg" }),
                  "mt-8 gap-2 border-0 bg-gradient-to-r from-teal-500 to-emerald-500 text-white shadow-lg shadow-teal-500/25 hover:from-teal-400 hover:to-emerald-400",
                )}
              >
                Get started free
                <ArrowRight className="size-4" aria-hidden />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 py-12">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 sm:flex-row sm:items-start sm:justify-between sm:px-6">
          <div>
            <p className="font-[family-name:var(--font-heading)] text-sm font-semibold text-white">
              {PRODUCT_NAME}
            </p>
            <p className="mt-2 max-w-xs text-sm text-white/45">
              Compliance automation with AI and durable evidence for teams who sell to the
              enterprise.
            </p>
          </div>
          <div className="flex flex-wrap gap-8 text-sm text-white/55">
            <Link href="/login" className="hover:text-white">
              Log in
            </Link>
            <Link href="/register" className="hover:text-white">
              Create account
            </Link>
            <a
              href="https://docs.0g.ai/"
              className="hover:text-white"
              target="_blank"
              rel="noopener noreferrer"
            >
              0G docs
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
