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
    Up: "bg-emerald-500",
    Down: "bg-red-500",
    Unknown: "bg-zinc-600",
};

const REGION_COLORS_INDEX: Record<string, number> = {};
let regionColorCounter = 0;

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
        const palette = ["#22c55e", "#3b82f6", "#f59e0b", "#ef4444", "#06b6d4", "#f97316"];
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

    const refresh = useCallback(async () => {
        try {
            const res = await api.getWebsiteStatus(params.id);
            setWebsite(res.website);
            setLastUpdated(new Date().toLocaleTimeString());
            setError("");
        } catch {
            setError("Could not fetch status");
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
                <p className="text-sm text-red-400">{error}</p>
            </main>
        );
    }

    if (!website) {
        return (
            <main className="flex flex-1 items-center justify-center p-8">
                <p className="text-sm text-zinc-500">Loading...</p>
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
    const chartData = ticks
        .slice()
        .reverse()
        .map((t) => ({
            time: new Date(t.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            fullTime: new Date(t.created_at).toLocaleString(),
            [t.region_id]: t.response_time_ms,
            [`${t.region_id}_status`]: t.status,
            [`${t.region_id}_http`]: t.http_status,
        }));

    return (
        <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
            <Link href="/" className="text-sm text-zinc-400 hover:text-zinc-200">
                ← Back
            </Link>

            <div className="mt-6 flex items-center justify-between">
                <div>
                    <h1 className="font-mono text-xl font-semibold">{website.url}</h1>
                    <p className="mt-1 text-sm text-zinc-500">
                        Checks from 3 regions · {uptime}% up (last {ticks.length} checks)
                    </p>
                    <p className="mt-0.5 text-xs text-zinc-600">
                        avg {avgLatency}ms · p95 {p95Latency}ms · last updated {lastUpdated}
                    </p>
                </div>
                {latest && (
                    <span
                        className={`shrink-0 rounded-full px-3 py-1 text-sm font-medium ${latest.status === "Up"
                                ? "bg-emerald-500/15 text-emerald-400"
                                : latest.status === "Down"
                                    ? "bg-red-500/15 text-red-400"
                                    : "bg-zinc-500/15 text-zinc-400"
                            }`}
                    >
                        {latest.status}
                    </span>
                )}
            </div>

            <section className="mt-10">
                <h2 className="text-sm font-medium text-zinc-400">
                    Recent checks ({ticks.length})
                </h2>
                <div className="mt-3 flex items-end gap-1.5">
                    {ticks.length === 0 && (
                        <p className="text-sm text-zinc-500">
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
                            <span className="text-[10px] text-zinc-600">
                                {t.response_time_ms}ms
                            </span>
                            <span className="absolute -top-7 z-10 hidden whitespace-nowrap rounded bg-zinc-800 px-2 py-1 text-[10px] text-zinc-200 group-hover:block">
                                {t.status}
                                {t.http_status ? ` · HTTP ${t.http_status}` : ""} · {t.response_time_ms}ms ·{" "}
                                {new Date(t.created_at).toLocaleString()} · {t.region_id}
                            </span>
                        </div>
                    ))}
                </div>
            </section>

            <section className="mt-12">
                <h2 className="text-sm font-medium text-zinc-400">
                    Response time trend
                </h2>
                <div className="mt-3 h-64 w-full rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
                    {ticks.length === 0 ? (
                        <p className="text-sm text-zinc-500">No data yet.</p>
                    ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                                <XAxis
                                    dataKey="time"
                                    stroke="#71717a"
                                    tick={{ fill: "#a1a1aa", fontSize: 11 }}
                                    tickLine={{ stroke: "#3f3f46" }}
                                />
                                <YAxis
                                    stroke="#71717a"
                                    tick={{ fill: "#a1a1aa", fontSize: 11 }}
                                    tickLine={{ stroke: "#3f3f46" }}
                                    label={{
                                        value: "ms",
                                        angle: -90,
                                        position: "insideLeft",
                                        fill: "#71717a",
                                        fontSize: 11,
                                    }}
                                />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: "#18181b",
                                        border: "1px solid #27272a",
                                        borderRadius: "0.5rem",
                                        color: "#e4e4e7",
                                    }}
                                    labelStyle={{ color: "#a1a1aa" }}
                                />
                                <Legend
                                    wrapperStyle={{ color: "#a1a1aa", fontSize: 12 }}
                                />
                                {regions.map((region) => (
                                    <Line
                                        key={region}
                                        type="monotone"
                                        dataKey={region}
                                        stroke={getRegionChartColor(region)}
                                        strokeWidth={2}
                                        dot={(props) => {
                                            const status = props.payload[`${region}_status`];
                                            if (status === "Down" || status === "Unknown") {
                                                return (
                                                    <circle
                                                        cx={props.cx}
                                                        cy={props.cy}
                                                        r={4}
                                                        fill="#ef4444"
                                                        stroke="#18181b"
                                                        strokeWidth={2}
                                                    />
                                                );
                                            }
                                            return (
                                                <circle
                                                    cx={props.cx}
                                                    cy={props.cy}
                                                    r={3}
                                                    fill={getRegionChartColor(region)}
                                                    stroke="#18181b"
                                                    strokeWidth={1}
                                                />
                                            );
                                        }}
                                        activeDot={{ r: 5 }}
                                    />
                                ))}
                            </LineChart>
                        </ResponsiveContainer>
                    )}
                </div>
            </section>
        </main>
    );
}
