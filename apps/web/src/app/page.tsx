"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, clearToken, getToken, type Website, type TickStatus } from "@/lib/api";

function StatusPill({ status }: { status: TickStatus | undefined }) {
  if (!status) return <span className="text-xs text-zinc-500">no checks yet</span>;
  const styles = {
    Up: "bg-emerald-500/15 text-emerald-400",
    Down: "bg-red-500/15 text-red-400",
    Unknown: "bg-zinc-500/15 text-zinc-400",
  }[status];
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${styles}`}>{status}</span>;
}

export default function Dashboard() {
  const router = useRouter();
  const [websites, setWebsites] = useState<Website[]>([]);
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    try {
      const res = await api.getWebsites();
      setWebsites(res.websites);
      setError("");
    } catch {
      setError("Could not reach the API server");
    }
  }, []);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/auth");
      return;
    }
    refresh(); // eslint-disable-line react-hooks/set-state-in-effect
    const id = setInterval(refresh, 10000);
    return () => clearInterval(id);
  }, [refresh, router]);

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
      <header className="border-b border-zinc-900">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <h1 className="text-lg font-semibold tracking-tight">
            Uptime <span className="inline-block h-2 w-2 rounded-full bg-emerald-400 align-middle" />
          </h1>
          <div className="flex items-center gap-4">
            {latestUserId && (
              <Link
                href={`/status-page/${latestUserId}`}
                className="text-sm text-zinc-400 hover:text-zinc-200"
              >
                Public status page
              </Link>
            )}
            <button onClick={logout} className="text-sm text-zinc-400 hover:text-zinc-200">
              Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-3xl flex-1 px-6 py-8 space-y-8">
        <section>
          <h2 className="text-sm font-medium text-zinc-400">Add monitor</h2>
          <form onSubmit={addWebsite} className="mt-3 flex gap-2">
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
              className="flex-1 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-zinc-600"
            />
            <button
              type="submit"
              className="rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-300"
            >
              Add
            </button>
          </form>
          {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
        </section>

        <section>
          <h2 className="text-sm font-medium text-zinc-400">Monitors</h2>
          {websites.length === 0 ? (
            <p className="mt-4 text-sm text-zinc-500">
              No monitors yet. Add one above to start checking uptime.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-zinc-900 rounded-lg border border-zinc-900">
              {websites.map((w) => (
                <li key={w.id}>
                  <Link
                    href={`/website/${w.id}`}
                    className="flex items-center justify-between px-4 py-3 hover:bg-zinc-900/50"
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