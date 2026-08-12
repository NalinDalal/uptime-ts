"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { api, getToken, type WebsiteWithTicks, type TickStatus } from "@/lib/api";

const STATUS_STYLES: Record<TickStatus, string> = {
    Up: "bg-success",
    Down: "bg-danger",
    Unknown: "bg-muted",
};

const REGION_COLORS_INDEX: Record<string, number> = {};
let regionColorCounter = 0;

const REGION_COLORS = [
    "border-l-sky-400",
    "border-l-violet-400",
    "border-l-amber-400",
    "border-l-rose-400",
    "border-l-teal-400",
    "border-l-orange-400",
];

function getRegionColor(regionId: string) {
    if (!(regionId in REGION_COLORS_INDEX)) {
        REGION_COLORS_INDEX[regionId] = regionColorCounter++;
    }
    return REGION_COLORS[REGION_COLORS_INDEX[regionId] % REGION_COLORS.length];
}

const REGION_CHART_COLORS: Record<string, string> = {};

function getRegionChartColor(regionId: string): string {
    if (!(regionId in REGION_CHART_COLORS)) {
        const idx = Object.keys(REGION_CHART_COLORS).length;
        const palette = ["#3FB950", "#58A6FF", "#D29922", "#F85149", "#06b6d4", "#f97316"];
        REGION_CHART_COLORS[regionId] = palette[idx % palette.length];
    }
    return REGION_CHART_COLORS[regionId];
}

export default function WebsiteDetail() {
    const params = useParams<{ id: string }>();
    const router = useRouter();
    const [website, setWebsite] = useState<WebsiteWithTicks | null>(null);
    const [error, setError] = useState("");
    const [lastUpdated, setLastUpdated] = useState<string>("");
    const [loading, setLoading] = useState(true);

    const refresh = useCallback(async () => {
        try {
            const res = await api.getWebsiteStatus(params.id);
            setWebsite(res.website);
            setLastUpdated(new Date().toLocaleTimeString());
            setError("");
        } catch {
            setError("Could not fetch status");
        } finally {
            setLoading(false);
        }
    }, [params.id]);

    useEffect(() => {
        if (!getToken()) {
            router.replace("/auth");
            return;
        }
        refresh(); // eslint-disable-line react-hooks/set-state-in-effect
        const id = setInterval(refresh, 10000);
        return () => clearInterval(id);
    }, [refresh, router]);

    if (error) {
        return (
            <main className="flex flex-1 items-center justify-center p-8">
                <p className="text-sm text-danger">{error}</p>
            </main>
        );
    }

    if (loading || !website) {
        return (
            <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
                <div className="mt-6 flex items-center justify-between">
                    <div>
                        <div className="h-7 w-64 animate-pulse rounded bg-surface-elevated" />
                        <div className="mt-2 h-4 w-48 animate-pulse rounded bg-surface-elevated" />
                        <div className="mt-1 h-3 w-32 animate-pulse rounded bg-surface-elevated" />
                    </div>
                    <div className="h-7 w-16 animate-pulse rounded-full bg-surface-elevated" />
                </div>
                <div className="mt-10">
                    <div className="h-4 w-32 animate-pulse rounded bg-surface-elevated" />
                    <div className="mt-3 flex items-end gap-1.5">
                        {Array.from({ length: 12 }).map((_, i) => (
                            <div key={i} className="h-24 flex-1 animate-pulse rounded-sm bg-surface-elevated" />
                        ))}
                    </div>
                </div>
            </main>
        );
    }

    const ticks = [...website.ticks].reverse();
    const latest = ticks[ticks.length - 1];
    const upCount = ticks.filter((t) => t.status === "Up").length;
    const uptime = ticks.length ? Math.round((upCount / ticks.length) * 100) : 0;

    const latencies = ticks.map((t) => t.response_time_ms).filter((ms) => ms > 0);
    const avgLatency =
        latencies.length > 0
            ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
            : 0;
    const p95Latency =
        latencies.length > 0
            ? Math.round(
                [...latencies].sort((a, b) => a - b)[
                Math.floor(latencies.length * 0.95)
                ] || 0,
            )
            : 0;

    const maxMs = Math.max(...ticks.map((t) => t.response_time_ms), 1);

    const regions = Array.from(new Set(ticks.map((t) => t.region_id)));
    const chartData = ticks.map((t) => ({
        time: new Date(t.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        fullTime: new Date(t.created_at).toLocaleString(),
        [t.region_id]: t.response_time_ms,
        [`${t.region_id}_status`]: t.status,
        [`${t.region_id}_http`]: t.http_status,
    }));

    return (
        <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
            <Link href="/" className="text-sm text-muted hover:text-text">
                ← Back
            </Link>

            <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="font-mono text-xl font-semibold">{website.url}</h1>
                    <p className="mt-1 text-sm text-muted">
                        Checks from 3 regions · {uptime}% up (last {ticks.length} checks)
                    </p>
                    <p className="mt-0.5 text-xs text-muted/60">
                        avg {avgLatency}ms · p95 {p95Latency}ms · last updated {lastUpdated}
                    </p>
                </div>
                {latest && (
                    <span
                        className={`shrink-0 rounded-full px-3 py-1 text-sm font-medium transition-all duration-300 ${latest.status === "Up"
                                ? "bg-success/15 text-success"
                                : latest.status === "Down"
                                    ? "bg-danger/15 text-danger"
                                    : "bg-muted/15 text-muted"
                            }`}
                    >
                        {latest.status}
                    </span>
                )}
            </div>

            <section className="mt-10">
                <h2 className="text-sm font-medium text-muted">
                    Recent checks ({ticks.length})
                </h2>
                <div className="mt-3 flex items-end gap-1.5">
                    {ticks.length === 0 && (
                        <p className="text-sm text-muted">
                            No checks yet — the worker pings this website every few minutes.
                        </p>
                    )}
                    {ticks.map((t) => (
                        <div
                            key={t.id}
                            className="group relative flex flex-1 flex-col items-center gap-1"
                        >
                            <div className="flex h-24 w-full items-end">
                                <div
                                    title={`${t.status}${t.http_status ? ` · HTTP ${t.http_status}` : ""} · ${t.response_time_ms}ms`}
                                    style={{
                                        height: `${Math.max(12, (t.response_time_ms / maxMs) * 100)}%`,
                                    }}
                                    className={`w-full rounded-sm border-l-2 ${getRegionColor(t.region_id)} ${STATUS_STYLES[t.status]} opacity-80 group-hover:opacity-100`}
                                />
                            </div>
                            <span className="text-[10px] text-muted">
                                {t.response_time_ms}ms
                            </span>
                            <span className="absolute -top-7 z-10 hidden whitespace-nowrap rounded bg-surface-elevated px-2 py-1 text-[10px] text-text group-hover:block">
                                {t.status}{t.http_status ? ` · HTTP ${t.http_status}` : ""} · {t.response_time_ms}ms · {new Date(t.created_at).toLocaleString()} · {t.region_id}
                            </span>
                        </div>
                    ))}
                </div>
            </section>
        </main>
    );
}
