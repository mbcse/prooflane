import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { logout } from "@/app/(app)/actions";
import { Button } from "@/components/ui/button";
import { PRODUCT_NAME } from "@/lib/brand";
import { ClipboardList, LayoutDashboard, Link2, LogOut, Server, Shield } from "lucide-react";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen flex flex-col bg-[oklch(0.11_0.022_265)] text-foreground">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-[oklch(0.11_0.022_265)]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-[3.25rem] max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-8">
            <Link href="/dashboard" className="flex shrink-0 items-center gap-2">
              <span className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-teal-500 to-emerald-600 shadow-lg shadow-teal-500/20">
                <Shield className="size-4 text-white" aria-hidden />
              </span>
              <span className="hidden flex-col sm:flex">
                <span className="font-[family-name:var(--font-heading)] text-sm font-semibold leading-tight text-white">
                  {PRODUCT_NAME}
                </span>
                <span className="text-[10px] font-medium uppercase tracking-wider text-teal-400/90">
                  Compliance OS
                </span>
              </span>
            </Link>
            <nav className="hidden items-center gap-1 md:flex">
              <Link
                href="/dashboard"
                className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-white/70 transition-colors hover:bg-white/5 hover:text-white"
              >
                <LayoutDashboard className="size-4 opacity-70" aria-hidden />
                Overview
              </Link>
              <Link
                href="/integrations/github"
                className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-white/70 transition-colors hover:bg-white/5 hover:text-white"
              >
                <Link2 className="size-4 opacity-70" aria-hidden />
                GitHub
              </Link>
              <Link
                href="/integrations/aws"
                className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-white/70 transition-colors hover:bg-white/5 hover:text-white"
              >
                <Server className="size-4 opacity-70" aria-hidden />
                AWS
              </Link>
              <Link
                href="/compliance/runs"
                className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-white/70 transition-colors hover:bg-white/5 hover:text-white"
              >
                <Shield className="size-4 opacity-70" aria-hidden />
                Runs
              </Link>
              <Link
                href="/onboarding"
                className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-white/70 transition-colors hover:bg-white/5 hover:text-white"
              >
                <ClipboardList className="size-4 opacity-70" aria-hidden />
                Program setup
              </Link>
            </nav>
          </div>
          <form action={logout} className="shrink-0">
            <Button
              type="submit"
              variant="ghost"
              size="sm"
              className="gap-2 text-white/65 hover:bg-white/10 hover:text-white"
            >
              <LogOut className="size-4" aria-hidden />
              <span className="hidden sm:inline">Sign out</span>
            </Button>
          </form>
        </div>
      </header>
      <main className="flex-1 bg-gradient-to-b from-[oklch(0.11_0.022_265)] via-[oklch(0.1_0.025_265)] to-[oklch(0.08_0.03_265)]">
        <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-10">{children}</div>
      </main>
    </div>
  );
}
