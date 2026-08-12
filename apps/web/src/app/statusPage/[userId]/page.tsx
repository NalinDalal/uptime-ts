"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api, type WebsiteWithTicks, type TickStatus, type Incident, type ComponentStatus, type Maintenance } from "@/lib/api";

const TICK_COLORS: Record<TickStatus, string> = {
  Up: "bg-success",
  Down: "bg-danger",
  Unknown: "bg-muted",
};

const STATUS_STYLES: Record<string, string> = {
  Up: "bg-success/15 text-success",
  Down: "bg-danger/15 text-danger",
  Unknown: "bg-muted/15 text-muted",
};

const MAINTENANCE_STATUS_STYLES: Record<string, string> = {
  scheduled: "bg-accent/15 text-accent",
  in_progress: "bg-warning/15 text-warning",
  completed: "bg-muted/15 text-muted",
};

function SkeletonCard() {
  return (
    <div className="rounded-lg border border-border bg-surface p-5">
      <div className="flex items-center justify-between gap-4">
        <div className="h-4 w-48 animate-pulse rounded bg-surface-elevated" />
        <div className="h-5 w-16 animate-pulse rounded-full bg-surface-elevated" />
      </div>
      <div className="mt-4 flex h-2.5 gap-0.5">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-full flex-1 animate-pulse rounded-sm bg-surface-elevated" />
        ))}
      </div>
    </div>
  );
}

function MonitorCard({ website }: { website: WebsiteWithTicks }) {
  const ticks = [...website.ticks].reverse();
  const latest = ticks[ticks.length - 1];
  const upCount = ticks.filter((t) => t.status === "Up").length;
  const uptime = ticks.length ? Math.round((upCount / ticks.length) * 100) : 0;

  return (
    <div className="rounded-lg border border-border bg-surface p-5 transition-colors hover:border-muted">
      <div className="flex items-center justify-between gap-4">
        <Link
          href={`/website/${website.id}`}
          className="truncate font-mono text-sm text-accent hover:text-accent/80"
        >
          {website.url}
        </Link>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium transition-all ${
            latest?.status === "Up"
              ? "bg-success/15 text-success"
              : latest?.status === "Down"
                ? "bg-danger/15 text-danger"
                : "bg-muted/15 text-muted"
          }`}
        >
          {latest?.status ?? "Pending"}
        </span>
      </div>

      <div className="mt-4 flex h-2.5 gap-0.5">
        {ticks.length === 0 && <div className="h-full flex-1 rounded-sm bg-border" />}
        {ticks.map((t) => (
          <div
            key={t.id}
            title={`${t.status} · ${t.response_time_ms}ms · ${new Date(t.created_at).toLocaleString()}`}
            className={`h-full flex-1 rounded-sm first:rounded-l-sm last:rounded-r-sm transition-opacity hover:opacity-80 ${TICK_COLORS[t.status]}`}
          />
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-muted">
        <span>
          {uptime}% up · latest {ticks.length ? `${latest?.response_time_ms}ms` : "—"}
        </span>
        <span>last {ticks.length || 0} checks</span>
      </div>
    </div>
  );
}

function UptimeBadge({ value }: { value: number | null }) {
  if (value === null) {
    return <span className="text-xs text-muted">No data</span>;
  }
  const color =
    value >= 99 ? "text-success"
    : value >= 95 ? "text-warning"
    : "text-danger";
  return <span className={`text-xs font-medium ${color}`}>{value.toFixed(2)}%</span>;
}

function formatMaintenanceTime(iso: string | null | undefined) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString();
}

export default function StatusPageView() {
  const params = useParams<{ userId: string }>();
  const [components, setComponents] = useState<ComponentStatus[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [maintenances, setMaintenances] = useState<Maintenance[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string>("");

  const refresh = useCallback(async () => {
    try {
      const res = await api.getPublicStatus(params.userId);
      setComponents(res.components);
      setIncidents(res.incidents);
      setMaintenances(res.maintenances);
      setLastUpdated(new Date().toLocaleTimeString());
      setError("");
      const allUp = res.components.length > 0 && res.components.every((c) => c.status === "Up");
      document.title = allUp
        ? "All systems operational"
        : res.components.length === 0
          ? "No monitors"
          : "Systems degraded";
    } catch {
      setError("Could not load status");
    } finally {
      setLoading(false);
    }
  }, [params.userId]);

  useEffect(() => {
    refresh(); // eslint-disable-line react-hooks/set-state-in-effect
    const id = setInterval(refresh, 30000);
    return () => clearInterval(id);
  }, [refresh]);

  const allUp = components.length > 0 && components.every((c) => c.status === "Up");

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold tracking-tight">Uptime</h1>
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
              allUp
                ? "bg-success/15 text-success"
                : "bg-danger/15 text-danger"
            }`}
          >
            {components.length === 0 && !loading
              ? "No monitors"
              : allUp
                ? "All systems operational"
                : "Systems degraded"}
          </span>
        </div>
        <span className="text-xs text-muted">
          {loading ? "Updating..." : `Updated ${lastUpdated}`}
        </span>
      </div>

      {error && <p className="mt-4 text-sm text-danger">{error}</p>}

      {maintenances.length > 0 && (
        <section className="mt-8 space-y-3">
          <h2 className="text-sm font-medium text-muted">Scheduled maintenance</h2>
          <ul className="space-y-2">
            {maintenances.map((m) => (
              <li
                key={m.id}
                className="rounded-lg border border-border bg-surface px-4 py-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate font-mono text-sm">{m.title}</span>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                      MAINTENANCE_STATUS_STYLES[m.status] ?? MAINTENANCE_STATUS_STYLES.scheduled
                    }`}
                  >
                    {m.status === "in_progress"
                      ? "In progress"
                      : m.status === "scheduled"
                        ? "Scheduled"
                        : m.status}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted">
                  {m.website.url} · {formatMaintenanceTime(m.starts_at)}
                  {m.ends_at ? ` – ${formatMaintenanceTime(m.ends_at)}` : ""}
                </p>
                {m.description && (
                  <p className="mt-1 text-xs text-text/80">{m.description}</p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mt-8 space-y-8">
        {components.length === 0 && !loading && (
          <p className="text-sm text-muted">No monitors on this status page.</p>
        )}
        {loading
          ? Array.from({ length: 2 }).map((_, i) => <SkeletonCard key={i} />)
          : components.map((component) => (
              <section key={component.name}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-sm font-medium text-text">{component.name}</h2>
              <div className="flex items-center gap-3">
                <div className="flex gap-3 text-xs">
                  <span>24h <UptimeBadge value={component.stats.d1} /></span>
                  <span>7d <UptimeBadge value={component.stats.d7} /></span>
                  <span>30d <UptimeBadge value={component.stats.d30} /></span>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[component.status]}`}
                >
                  {component.status}
                </span>
              </div>
            </div>
                <div className="mt-3 space-y-3">
                  {component.websites.map((w) => (
                    <MonitorCard key={w.id} website={w} />
                  ))}
                </div>
              </section>
            ))}
      </div>

      {(incidents.length > 0 || error === "") && (
        <section className="mt-12">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-medium text-muted">Incident history</h2>
            <Link href={`/statusPage/${params.userId}/history`} className="text-xs text-accent hover:text-accent/80">
              View full history
            </Link>
          </div>
          {incidents.length === 0 ? (
            <p className="mt-2 text-sm text-muted">No incidents recorded.</p>
          ) : (
            <ul className="mt-3 divide-y divide-border rounded-lg border border-border">
              {incidents.map((inc) => (
                <li key={inc.id} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="truncate font-mono text-sm">{inc.website.url}</span>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                        inc.ended_at
                          ? "bg-success/15 text-success"
                          : "bg-danger/15 text-danger"
                      }`}
                    >
                      {inc.ended_at ? "Resolved" : "Ongoing"}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    {inc.region_id} · started {new Date(inc.started_at).toLocaleString()}
                    {inc.ended_at
                      ? ` · lasted ${Math.max(1, Math.round((new Date(inc.ended_at).getTime() - new Date(inc.started_at).getTime()) / 60000))} min`
                      : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </main>
  );
}
