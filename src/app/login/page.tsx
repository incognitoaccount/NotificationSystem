"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BellRing } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("user1");
  const [password, setPassword] = useState("user1password");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (!res.ok) {
        setError("Invalid username or password.");
        return;
      }

      // Login succeeded.
      router.push("/schedule");
    } catch {
      setError("Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 font-sans px-6">
      <div className="max-w-md mx-auto pt-20 pb-10">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-11 w-11 rounded-2xl bg-sky-100 border border-sky-200 flex items-center justify-center">
            <BellRing className="w-5 h-5 text-sky-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold">NotifyFlow</h1>
            <p className="text-xs text-slate-500">Login to manage your schedule</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
              Username
            </label>
            <input
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition-all focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={loading}
              autoComplete="username"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
              Password
            </label>
            <input
              type="password"
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition-all focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              autoComplete="current-password"
            />
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-slate-900 text-white px-4 py-3 text-sm font-bold hover:bg-slate-800 disabled:opacity-70"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>

          <div className="text-[12px] text-slate-500 pt-2">
            Demo accounts:
            <div className="mt-1">
              <div>
                <span className="font-semibold">user1</span> /{" "}
                user1password
              </div>
              <div>
                <span className="font-semibold">user2</span> /{" "}
                user2password
              </div>
              <div>
                <span className="font-semibold">user3</span> /{" "}
                user3password
              </div>
            </div>
          </div>
        </form>
      </div>
    </main>
  );
}

