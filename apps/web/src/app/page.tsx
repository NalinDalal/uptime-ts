"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

export default function LandingPage() {
  const router = useRouter();

  return (
    <main className="flex flex-1 flex-col">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <h1 className="text-lg font-semibold tracking-tight">
            Uptime{" "}
            <span className="inline-block h-2 w-2 rounded-full bg-success align-middle" />
          </h1>
          <div className="flex items-center gap-4">
            <Link href="/auth" className="text-sm text-muted hover:text-text">
              Sign in
            </Link>
            <Link
              href="/auth"
              className="rounded-lg bg-success px-4 py-2 text-sm font-medium text-background hover:brightness-110"
            >
              Get started
            </Link>
          </div>
        </div>
      </header>

      <section className="mx-auto w-full max-w-3xl flex-1 px-6 py-20">
        <div className="max-w-2xl">
          <h2 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            Monitor your websites from{" "}
            <span className="text-success">multiple regions</span>
          </h2>
          <p className="mt-6 text-lg text-muted">
            Uptime checks, incident tracking, and status pages — built for developers who want reliable monitoring without the bloat.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/auth"
              className="rounded-lg bg-success px-5 py-2.5 text-sm font-medium text-background hover:brightness-110"
            >
              Start monitoring
            </Link>
            <Link
              href="/auth"
              className="rounded-lg border border-border px-5 py-2.5 text-sm font-medium text-text hover:bg-surface"
            >
              View demo status page
            </Link>
          </div>
        </div>

        <div className="mt-20 grid gap-6 sm:grid-cols-3">
          <FeatureCard
            title="Multi-region checks"
            description="Ping your endpoints from multiple regions to detect outages before your users do."
          />
          <FeatureCard
            title="Incident tracking"
            description="Automatic incident creation and resolution when status changes. No manual bookkeeping."
          />
          <FeatureCard
            title="Public status pages"
            description="Share a branded status page with uptime stats, incident history, and scheduled maintenance."
          />
        </div>
      </section>
    </main>
  );
}

function FeatureCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-5">
      <h3 className="text-sm font-medium text-text">{title}</h3>
      <p className="mt-2 text-xs text-muted">{description}</p>
    </div>
  );
}
