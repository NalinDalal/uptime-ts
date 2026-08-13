"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, clearToken, getToken, type Website, type TickStatus, type Incident } from "@/lib/api";

/**
 * Renders a compact status badge for a given tick status.
 *
 * @typedef {Object} StatusPillProps
 * @property {TickStatus | undefined} status - The tick status to render.
 * @returns {JSX.Element} A rounded pill badge, or "no checks yet" in muted text when status is undefined.
 */
function StatusPill({ status }: { status: TickStatus | undefined }) {
    if (!status) return <span className="text-xs text-muted">no checks yet</span>;
    const styles = {
        Up: "bg-success/15 text-success",
        Down: "bg-danger/15 text-danger",
        Unknown: "bg-muted/15 text-muted",
    }[status];
    return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${styles}`}>{status}</span>;
}

/**
 * Renders a skeleton loading row that mimics the shape of a website list item.
 *
 * Used as a placeholder while the dashboard data is being fetched.
 *
 * @returns {JSX.Element}
 */
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

/**
 * Props for the `SummaryBadge` metric display component.
 *
 * @typedef {Object} SummaryBadgeProps
 * @property {string} label - Metric name (e.g. "Total", "Up", "Down").
 * @property {number} value - Metric value to display.
 * @property {"success" | "danger" | "muted"} [tone] - Optional color tone for the badge border/background.
 */

/**
 * Renders a small summary metric badge with an uppercase label and numeric value.
 *
 * When no `tone` is provided, a neutral surface style is used.
 *
 * @param {SummaryBadgeProps} props - Component props.
 * @returns {JSX.Element}
 */
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

/**
 * Main dashboard page for authenticated users.
 *
 * Allows users to:
 * - Add new website monitors via a URL input.
 * - Configure an alert webhook URL for incident notifications.
 * - View recent incidents across all monitored websites.
 * - See a list of all monitors with their latest status and summary stats.
 * - Access the public status page for their account.
 * - Sign out.
 *
 * Redirects unauthenticated users to `/auth`. Polls for monitor updates every 10 seconds.
 *
 * @returns {JSX.Element}
 */
export default function Dashboard() {
    const router = useRouter();
    const [websites, setWebsites] = useState<Website[]>([]);
    const [url, setUrl] = useState("");
    const [error, setError] = useState("");
    const [webhookUrl, setWebhookUrl] = useState("");
    const [webhookError, setWebhookError] = useState("");
    const [incidents, setIncidents] = useState<Incident[]>([]);
    const [loading, setLoading] = useState(true);

    /**
     * Formats an ISO timestamp into a localized human-readable string.
     *
     * @param {string} iso - ISO 8601 timestamp.
     * @returns {string} Localized date/time string.
     */
    function formatTime(iso: string) {
        return new Date(iso).toLocaleString();
    }

    /**
     * Calculates a human-readable duration between two ISO timestamps.
     *
     * @param {string} startIso - Start timestamp (ISO 8601).
     * @param {string} endIso - End timestamp (ISO 8601).
     * @returns {string} Duration in minutes or hours (e.g. `"5 mins"`, `"1h 30m"`).
     */
    function formatDuration(startIso: string, endIso: string) {
        const ms = new Date(endIso).getTime() - new Date(startIso).getTime();
        const mins = Math.max(1, Math.round(ms / 60000));
        return `${mins} min${mins === 1 ? "" : "s"}`;
    }

    /**
     * Fetches the authenticated user's websites from the API and stores them in state.
     */
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

    /**
     * Loads the authenticated user's current webhook URL from the API.
     */
    const loadWebhook = useCallback(async () => {
        try {
            const res = await api.getWebhook();
            setWebhookUrl(res.url ?? "");
        } catch {
            setWebhookError("Could not load webhook settings");
        }
    }, []);

    /**
     * Fetches recent incidents for the authenticated user.
     * Failures are silently ignored since incidents are secondary data.
     */
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

    /**
     * Handles the webhook URL form submission.
     *
     * @param {React.FormEvent} e - The form submission event.
     */
    async function saveWebhook(e: React.FormEvent) {
        e.preventDefault();
        setWebhookError("");
        try {
            await api.setWebhook(webhookUrl);
        } catch {
            setWebhookError("Could not save webhook URL");
        }
    }

    /**
     * Handles the add-website form submission.
     *
     * @param {React.FormEvent} e - The form submission event.
     */
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

    /**
     * Clears the stored JWT and redirects the user to the authentication page.
     */
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
