"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api, type HistoryItem } from "@/lib/api";

function formatDuration(startedAt: string, endedAt: string | null) {
  const start = new Date(startedAt);
  const end = endedAt ? new Date(endedAt) : new Date();
  const diffMs = end.getTime() - start.getTime();
  const minutes = Math.max(1, Math.round(diffMs / 60000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

function TimelineItem({ item }: { item: HistoryItem }) {
  const isIncident = item.type === "incident";
  const isOngoing = !item.ended_at;
  const started = new Date(item.started_at);

  return (
    <li className="relative flex gap-4 pb-8 last:pb-0">
      <div className="flex flex-col items-center">
        <span
          className={`h-3 w-3 rounded-full border-2 ${
            isIncident
              ? isOngoing
                ? "border-danger bg-danger/20"
                : "border-success bg-success/20"
              : "border-accent bg-accent/20"
          }`}
        />
        <div className="mt-2 w-px flex-1 bg-border" />
      </div>
      <div className="flex-1 pt-0">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-text">
              {isIncident ? "Incident" : item.title}
            </p>
            <p className="mt-0.5 text-xs text-muted">
              <Link href={item.website_url} className="text-accent hover:text-accent/80">
                {item.website_url}
              </Link>
              {isIncident && item.region_id ? ` · ${item.region_id}` : ""}
            </p>
          </div>
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
              isIncident
                ? isOngoing
                  ? "bg-danger/15 text-danger"
                  : "bg-success/15 text-success"
                : item.status === "in_progress"
                  ? "bg-warning/15 text-warning"
                  : "bg-accent/15 text-accent"
            }`}
          >
            {isIncident ? (isOngoing ? "Ongoing" : "Resolved") : item.status === "in_progress" ? "In progress" : "Scheduled"}
          </span>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
          <span>Started {started.toLocaleString()}</span>
          <span>
            {isOngoing ? "Ongoing" : `Resolved · lasted ${formatDuration(item.started_at, item.ended_at)}`}
          </span>
        </div>
      </div>
    </li>
  );
}

export default function HistoryPage() {
  const params = useParams<{ userId: string }>();
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    try {
      const res = await api.getHistory(params.userId);
      setHistory(res.history);
      setError("");
    } catch {
      setError("Could not load history");
    }
  }, [params.userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
      <div className="flex items-center gap-3">
        <Link href={`/statusPage/${params.userId}`} className="text-sm text-muted hover:text-text">
          ← Back
        </Link>
        <h1 className="text-xl font-semibold tracking-tight">Status history</h1>
      </div>

      {error && <p className="mt-4 text-sm text-danger">{error}</p>}

      {history.length === 0 && !error && (
        <p className="mt-8 text-sm text-muted">No incidents or maintenance recorded.</p>
      )}

      <ul className="mt-8">
        {history.map((item) => (
          <TimelineItem key={`${item.type}-${item.id}`} item={item} />
        ))}
      </ul>
    </main>
  );
}
