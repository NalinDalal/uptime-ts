"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api, getToken, type WebsiteWithTicks, type TickStatus } from "@/lib/api";

const STATUS_STYLES: Record<TickStatus, string> = {
  Up: "bg-emerald-500",
  Down: "bg-red-500",
  Unknown: "bg-zinc-600",
};

export default function WebsiteDetail() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [website, setWebsite] = useState<WebsiteWithTicks | null>(null);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    try {
      const res = await api.getWebsiteStatus(params.id);
      setWebsite(res.website);
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
  const uptime = ticks.length
    ? Math.round(
        (ticks.filter((t) => t.status === "Up").length / ticks.length) * 100,
      )
    : 0;

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
        </div>
        {latest && (
          <span
            className={`rounded-full px-3 py-1 text-sm font-medium ${
              latest.status === "Up"
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
            <div key={t.id} className="group relative flex flex-1 flex-col items-center gap-1">
              <div className="flex h-24 w-full items-end">
              <div
                title={`${t.status}${t.http_status ? ` · HTTP ${t.http_status}` : ""} · ${t.response_time_ms}ms`}
                style={{ height: `${Math.max(12, Math.min(100, 1000 / t.response_time_ms * 100))}%` }}
                className={`w-full rounded-sm ${STATUS_STYLES[t.status]} opacity-80 group-hover:opacity-100`}
              />
              </div>
              <span className="text-[10px] text-zinc-600">
                {t.response_time_ms}ms
              </span>
                <span className="absolute -top-7 z-10 hidden whitespace-nowrap rounded bg-zinc-800 px-2 py-1 text-[10px] text-zinc-200 group-hover:block">
                  {t.status}{t.http_status ? ` · HTTP ${t.http_status}` : ""} · {t.response_time_ms}ms · {new Date(t.created_at).toLocaleString()} · {t.region_id}
                </span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}