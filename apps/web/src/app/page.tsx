"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";

const regions = [
  { name: "US-East", status: "up", latency: 42 },
  { name: "EU-West", status: "up", latency: 78 },
  { name: "AP-South", status: "degraded", latency: 340 },
];

const statusColor = {
  up: "bg-success",
  degraded: "bg-warning",
  down: "bg-error",
} as const;

function RegionPulseStrip() {
  return (
    <div className="flex flex-wrap gap-3">
      {regions.map((r, i) => (
        <motion.div
          key={r.name}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.08, duration: 0.3, ease: [0.2, 0, 0, 1] }}
          className="flex items-center gap-2 rounded border border-border bg-surface px-3 py-2"
        >
          <span className="relative flex h-2 w-2">
            <motion.span
              className={`absolute inline-flex h-full w-full rounded-full ${statusColor[r.status as keyof typeof statusColor]}`}
              animate={{ scale: [1, 2.2], opacity: [0.6, 0] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: "easeOut" }}
            />
            <span
              className={`relative inline-flex h-2 w-2 rounded-full ${statusColor[r.status as keyof typeof statusColor]}`}
            />
          </span>
          <span className="font-mono text-xs text-text">{r.name}</span>
          <span className="font-mono text-xs text-muted">{r.latency}ms</span>
        </motion.div>
      ))}
    </div>
  );
}

export default function LandingPage() {
  const router = useRouter();

  return (
    <main className="flex flex-1 flex-col">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <h1 className="text-lg font-semibold tracking-tight font-mono">
            Uptime
          </h1>
          <div className="flex items-center gap-4">
            <Link href="/auth" className="text-sm text-muted hover:text-text">
              Sign in
            </Link>
            <Link
              href="/auth"
              className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-background hover:brightness-110 transition-all duration-150"
            >
              Get started
            </Link>
          </div>
        </div>
      </header>

      <section className="mx-auto w-full max-w-3xl flex-1 px-6 py-20">
        <div className="max-w-2xl">
          <h2 className="text-4xl font-semibold tracking-tight sm:text-5xl font-mono">
            Monitor your websites from{" "}
            <span className="text-accent">multiple regions</span>
          </h2>
          <p className="mt-6 text-lg text-muted">
            Uptime checks, incident tracking, and status pages — built for developers who want reliable monitoring without the bloat.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/auth"
              className="rounded-md bg-accent px-5 py-2.5 text-sm font-medium text-background hover:brightness-110 transition-all duration-150"
            >
              Start monitoring
            </Link>
            <Link
              href="/auth"
              className="rounded-md border border-border px-5 py-2.5 text-sm font-medium text-text hover:bg-surface transition-all duration-150"
            >
              View demo status page
            </Link>
          </div>

          <div className="mt-12">
            <RegionPulseStrip />
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
    <div className="rounded-md border border-border bg-surface p-5">
      <h3 className="text-sm font-medium text-text">{title}</h3>
      <p className="mt-2 text-xs text-muted">{description}</p>
    </div>
  );
}
