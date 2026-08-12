"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, setToken } from "@/lib/api";

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (mode === "signup") {
        await api.signup(username, password);
      }
      const res = await api.signin(username, password);
      setToken(res.jwt);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  function switchMode() {
    setError("");
    setMode(mode === "signin" ? "signup" : "signin");
  }

  return (
    <main className="flex flex-1 items-center justify-center p-8">
      <div className="w-full max-w-sm">
        <div className="transition-all duration-300">
          <h1 className="text-2xl font-semibold tracking-tight">
            Uptime{" "}
            <span className="inline-block h-2 w-2 rounded-full bg-success align-middle" />
          </h1>
          <p className="mt-1 text-sm text-muted">
            {mode === "signin" ? "Welcome back" : "Create your account"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <div>
            <label className="text-xs font-medium text-muted">
              Username
            </label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent transition-colors disabled:opacity-50"
              required
              disabled={loading}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent transition-colors disabled:opacity-50"
              required
              disabled={loading}
            />
          </div>

          <div className="min-h-[1.25rem]">
            {error && (
              <p className="text-sm text-danger animate-pulse">{error}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-success px-3 py-2 text-sm font-medium text-background hover:brightness-110 disabled:opacity-50 transition-all duration-200"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-background/30 border-t-background" />
                Please wait...
              </span>
            ) : mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-muted">
          {mode === "signin" ? "No account?" : "Already have an account?"}{" "}
          <button
            onClick={switchMode}
            className="font-medium text-text hover:underline transition-colors"
            type="button"
          >
            {mode === "signin" ? "Sign up" : "Sign in"}
          </button>
        </p>
      </div>
    </main>
  );
}