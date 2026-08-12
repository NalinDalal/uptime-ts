"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, clearToken, getToken, type Website, type TickStatus, type Incident } from "@/lib/api";

function StatusPill({ status }: { status: TickStatus | undefined }) {
    if (!status) return <span className="text-xs text-muted">no checks yet</span>;
    const styles = {
        Up: "bg-success/15 text-success",
        Down: "bg-danger/15 text-danger",
        Unknown: "bg-muted/15 text-muted",
    }[status];
    return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${styles}`}>{status}</span>;
}

function SkeletonRow() {
    return (
        <li className="px-4 py-3">
            <div className="flex items-center justify-between gap-3">
                <div className="h-4 w-48 animate-pulse rounded bg-surface-elevated" />
                <div className="h-5 w-16 animate-pulse rounded-full bg-surface-elevated" />
            </div>
        </li>
    );
}

function SummaryBadge({ label, value, tone }: { label: string; value: number; tone?: "success" | "danger" | "muted" }) {
    const color =
        tone === "success"
            ? "border-success/30 bg-success/10 text-success"
            : tone === "danger"
                ? "border-danger/30 bg-danger/10 text-danger"
                : tone === "muted"
                    ? "border-muted/30 bg-muted/10 text-muted"
                    : "border-border bg-surface text-text";
    return (
        <div className={`rounded-md border px-3 py-1.5 text-xs ${color}`}>
            <span className="text-[10px] uppercase tracking-wider opacity-70">{label}</span>
            <span className="ml-1.5 text-sm font-medium">{value}</span>
        </div>
    );
}

export default function Dashboard() {
    const router = useRouter();
    const [websites, setWebsites] = useState<Website[]>([]);
    const [url, setUrl] = useState("");
    const [error, setError] = useState("");
    const [webhookUrl, setWebhookUrl] = useState("");
    const [webhookError, setWebhookError] = useState("");
    const [incidents, setIncidents] = useState<Incident[]>([]);
    const [loading, setLoading] = useState(true);

    function formatTime(iso: string) {
        return new Date(iso).toLocaleString();
    }

    function formatDuration(startIso: string, endIso: string) {
        const ms = new Date(endIso).getTime() - new Date(startIso).getTime();
        const mins = Math.max(1, Math.round(ms / 60000));
        return `${mins} min${mins === 1 ? "" : "s"}`;
    }

    const refresh = useCallback(async () => {
        try {
            const res = await api.getWebsites();
            setWebsites(res.websites);
            setError("");
        } catch {
            setError("Could not reach the API server");
        } finally {
            setLoading(false);
        }
    }, []);

    const loadWebhook = useCallback(async () => {
        try {
            const res = await api.getWebhook();
            setWebhookUrl(res.url ?? "");
        } catch {
            setWebhookError("Could not load webhook settings");
        }
    }, []);

    const refreshIncidents = useCallback(async () => {
        try {
            const res = await api.getIncidents();
            setIncidents(res.incidents);
        } catch {
            // incidents are secondary; ignore failures
        }
    }, []);

    useEffect(() => {
        if (!getToken()) {
            router.replace("/auth");
            return;
        }
        refresh(); // eslint-disable-line react-hooks/set-state-in-effect
        loadWebhook();
        refreshIncidents();
        const id = setInterval(refresh, 10000);
        return () => clearInterval(id);
    }, [refresh, refreshIncidents, loadWebhook, router]);

    async function saveWebhook(e: React.FormEvent) {
        e.preventDefault();
        setWebhookError("");
        try {
            await api.setWebhook(webhookUrl);
        } catch {
            setWebhookError("Could not save webhook URL");
        }
    }

    async function addWebsite(e: React.FormEvent) {
        e.preventDefault();
        if (!url) return;
        setError("");
        try {
            await api.createWebsite(url);
            setUrl("");
            await refresh();
        } catch {
            setError("Could not add website");
        }
    }

    const latestUserId = websites[websites.length - 1]?.user_id;

    function logout() {
        clearToken();
        router.push("/auth");
    }

    return (
        <main className="flex flex-1 flex-col">
            <header className="border-b border-border">
                <div className="mx-auto flex max-w-3xl flex-col gap-2 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-4">
                        <h1 className="text-lg font-semibold tracking-tight">
                            Uptime{" "}
                            <span className="inline-block h-2 w-2 rounded-full bg-success align-middle animate-pulse-slow" />
                        </h1>
                        {latestUserId && (
                            <Link
                                href={`/statusPage/${latestUserId}`}
                                className="text-sm text-muted hover:text-text"
                            >
                                Public status page
                            </Link>
                        )}
                    </div>
                    <button onClick={logout} className="text-sm text-muted hover:text-text">
                        Sign out
                    </button>
                </div>
            </header>

            <div className="mx-auto w-full max-w-3xl flex-1 px-6 py-8 space-y-8">
                <section>
                    <h2 className="text-sm font-medium text-muted">Add monitor</h2>
                    <form onSubmit={addWebsite} className="mt-3 flex flex-col gap-2 sm:flex-row">
                        <input
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            placeholder="https://example.com"
                            className="flex-1 rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
                        />
                        <button
                            type="submit"
                            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-background hover:brightness-110 transition-all duration-150"
                        >
                            Add
                        </button>
                    </form>
                    {error && <p className="mt-2 text-sm text-danger">{error}</p>}
                </section>

                <section>
                    <h2 className="text-sm font-medium text-muted">
                        Alerts <span className="text-muted/60">— webhook on status change</span>
                    </h2>
                    <form onSubmit={saveWebhook} className="mt-3 flex flex-col gap-2 sm:flex-row">
                        <input
                            value={webhookUrl}
                            onChange={(e) => setWebhookUrl(e.target.value)}
                            placeholder="https://hooks.slack.com/services/..."
                            className="flex-1 rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
                        />
                        <button
                            type="submit"
                            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-background hover:brightness-110 transition-all duration-150"
                        >
                            Save
                        </button>
                    </form>
                    {webhookError && <p className="mt-2 text-sm text-danger">{webhookError}</p>}
                </section>

                <section>
                    <h2 className="text-sm font-medium text-muted">Incidents</h2>
                    {incidents.length === 0 ? (
                        <p className="mt-2 text-sm text-muted">
                            No incidents — every check has been passing.
                        </p>
                    ) : (
                        <ul className="mt-3 divide-y divide-border rounded-md border border-border">
                            {incidents.map((inc) => (
                                <li key={inc.id} className="px-4 py-3">
                                    <div className="flex items-center justify-between gap-3">
                                        <span className="truncate font-mono text-sm">{inc.website.url}</span>
                                        <span
                                            className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${inc.ended_at
                                                    ? "bg-success/15 text-success"
                                                    : "bg-danger/15 text-danger"
                                                }`}
                                        >
                                            {inc.ended_at ? "Resolved" : "Ongoing"}
                                        </span>
                                    </div>
                                    <p className="mt-1 text-xs text-muted">
                                        {inc.region_id} · started {formatTime(inc.started_at)}
                                        {inc.ended_at ? ` · lasted ${formatDuration(inc.started_at, inc.ended_at)}` : ""}
                                    </p>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>

                <section>
                    <div className="flex items-center justify-between">
                        <h2 className="text-sm font-medium text-muted">Monitors</h2>
                        {loading && <span className="text-xs text-muted">Refreshing...</span>}
                    </div>
                    {websites.length > 0 && !loading && (
                        <div className="mt-3 flex flex-wrap gap-3">
                            <SummaryBadge label="Total" value={websites.length} />
                            <SummaryBadge
                                label="Up"
                                value={websites.filter((w) => w.ticks?.[0]?.status === "Up").length}
                                tone="success"
                            />
                            <SummaryBadge
                                label="Down"
                                value={websites.filter((w) => w.ticks?.[0]?.status === "Down").length}
                                tone="danger"
                            />
                            <SummaryBadge
                                label="Unknown"
                                value={websites.filter((w) => w.ticks?.[0]?.status === "Unknown").length}
                                tone="muted"
                            />
                        </div>
                    )}
                    {websites.length === 0 && !loading ? (
                        <p className="mt-4 text-sm text-muted">
                            No monitors yet. Add one above to start checking uptime.
                        </p>
                    ) : (
                        <ul className="mt-3 divide-y divide-border rounded-md border border-border">
                            {loading
                                ? Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={i} />)
                                : websites.map((w) => (
                                    <li key={w.id}>
                                        <Link
                                            href={`/website/${w.id}`}
                                            className="flex items-center justify-between px-4 py-3 hover:bg-surface-elevated transition-colors"
                                        >
                                            <span className="font-mono text-sm">{w.url}</span>
                                            <StatusPill status={w.ticks?.[0]?.status} />
                                        </Link>
                                    </li>
                                ))}
                        </ul>
                    )}
                </section>
            </div>
        </main>
    );
}
