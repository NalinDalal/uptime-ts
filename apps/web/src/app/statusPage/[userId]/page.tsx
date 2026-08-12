"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api, type WebsiteWithTicks, type TickStatus, type Incident, type ComponentStatus } from "@/lib/api";

const TICK_COLORS: Record<TickStatus, string> = {
  Up: "bg-emerald-500",
  Down: "bg-red-500",
  Unknown: "bg-zinc-700",
};

const STATUS_STYLES: Record<string, string> = {
  Up: "bg-emerald-500/15 text-emerald-400",
  Down: "bg-red-500/15 text-red-400",
  Unknown: "bg-zinc-500/15 text-zinc-400",
};

function MonitorCard({ website }: { website: WebsiteWithTicks }) {
  const ticks = [...website.ticks].reverse();
  const latest = ticks[ticks.length - 1];
  const upCount = ticks.filter((t) => t.status === "Up").length;
  const uptime = ticks.length ? Math.round((upCount / ticks.length) * 100) : 0;

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-5">
      <div className="flex items-center justify-between gap-4">
        <span className="truncate font-mono text-sm">{website.url}</span>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
            latest?.status === "Up"
              ? "bg-emerald-500/15 text-emerald-400"
              : latest?.status === "Down"
                ? "bg-red-500/15 text-red-400"
                : "bg-zinc-500/15 text-zinc-400"
          }`}
        >
          {latest?.status ?? "Pending"}
        </span>
      </div>

      <div className="mt-4 flex h-2.5 gap-0.5">
        {ticks.length === 0 && <div className="h-full flex-1 rounded-sm bg-zinc-800" />}
        {ticks.map((t) => (
          <div
            key={t.id}
            title={`${t.status} · ${t.response_time_ms}ms · ${new Date(t.created_at).toLocaleString()}`}
            className={`h-full flex-1 rounded-sm first:rounded-l-sm last:rounded-r-sm ${TICK_COLORS[t.status]}`}
          />
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-zinc-500">
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
    return <span className="text-xs text-zinc-500">No data</span>;
  }
  const color =
    value >= 99 ? "text-emerald-400"
    : value >= 95 ? "text-yellow-400"
    : "text-red-400";
  return <span className={`text-xs font-medium ${color}`}>{value.toFixed(2)}%</span>;
}

export default function StatusPageView() {
  const params = useParams<{ userId: string }>();
  const [components, setComponents] = useState<ComponentStatus[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    try {
      const res = await api.getPublicStatus(params.userId);
      setComponents(res.components);
      setIncidents(res.incidents);
      setError("");
    } catch {
      setError("Could not load status");
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
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold tracking-tight">Uptime</h1>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
            allUp
              ? "bg-emerald-500/15 text-emerald-400"
              : "bg-red-500/15 text-red-400"
          }`}
        >
          {components.length === 0
            ? "No monitors"
            : allUp
              ? "All systems operational"
              : "Systems degraded"}
        </span>
      </div>

      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

      <div className="mt-8 space-y-8">
        {components.length === 0 && !error && (
          <p className="text-sm text-zinc-500">No monitors on this status page.</p>
        )}
        {components.map((component) => (
          <section key={component.name}>
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-sm font-medium text-zinc-300">{component.name}</h2>
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
          <h2 className="text-sm font-medium text-zinc-400">Incident history</h2>
          {incidents.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-500">No incidents recorded.</p>
          ) : (
            <ul className="mt-3 divide-y divide-zinc-900 rounded-lg border border-zinc-900">
              {incidents.map((inc) => (
                <li key={inc.id} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="truncate font-mono text-sm">{inc.website.url}</span>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                        inc.ended_at
                          ? "bg-emerald-500/15 text-emerald-400"
                          : "bg-red-500/15 text-red-400"
                      }`}
                    >
                      {inc.ended_at ? "Resolved" : "Ongoing"}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-zinc-500">
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
