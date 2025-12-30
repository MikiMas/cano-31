"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Leader = { nickname: string; points: number };

async function fetchJson<T>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<{ ok: true; data: T } | { ok: false; status: number; error: string }> {
  try {
    const res = await fetch(input, init);
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      return { ok: false, status: res.status, error: (json as any)?.error ?? "REQUEST_FAILED" };
    }
    return { ok: true, data: json as T };
  } catch {
    return { ok: false, status: 0, error: "NETWORK_ERROR" };
  }
}

export function LeaderboardSection({
  authHeaders,
  onNeedsAuthReset,
  refreshSignal
}: {
  authHeaders: Record<string, string>;
  onNeedsAuthReset: () => void;
  refreshSignal: string;
}) {
  const [leaders, setLeaders] = useState<Leader[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const top10 = useMemo(() => leaders.slice(0, 10), [leaders]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await fetchJson<{ ok: true; leaders: Leader[] }>("/api/leaderboard", {
      headers: { ...authHeaders },
      cache: "no-store"
    });
    setLoading(false);

    if (!res.ok) {
      if (res.status === 401) {
        onNeedsAuthReset();
        return;
      }
      setError(res.error);
      return;
    }

    setLeaders(res.data.leaders ?? []);
  }, [authHeaders, onNeedsAuthReset]);

  useEffect(() => {
    load().catch(() => {});
  }, [load, refreshSignal]);

  useEffect(() => {
    const id = setInterval(() => load().catch(() => {}), 8000);
    return () => clearInterval(id);
  }, [load]);

  return (
    <section className="card">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>Ranking</h2>
        <button
          onClick={() => load()}
          disabled={loading}
          style={{
            padding: "8px 10px",
            borderRadius: 12,
            border: "1px solid var(--border)",
            background: "rgba(255,255,255,0.06)",
            color: "var(--text)",
            fontWeight: 700
          }}
        >
          {loading ? "..." : "Actualizar"}
        </button>
      </div>

      {error ? <div style={{ marginTop: 10, color: "#fecaca", fontSize: 14 }}>{error}</div> : null}

      <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
        {top10.map((l, idx) => (
          <div
            key={`${l.nickname}-${idx}`}
            className="row"
            style={{
              justifyContent: "space-between",
              padding: 10,
              borderRadius: 12,
              border: "1px solid var(--border)",
              background: "rgba(0,0,0,0.18)"
            }}
          >
            <div style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
              <div style={{ width: 22, color: "var(--muted)", fontSize: 13 }}>#{idx + 1}</div>
              <div style={{ fontWeight: 800 }}>{l.nickname}</div>
            </div>
            <div className="pill">
              <strong>{l.points}</strong>
            </div>
          </div>
        ))}
      </div>

      <div className="row" style={{ marginTop: 12, justifyContent: "space-between" }}>
        <button
          onClick={() => setExpanded((v) => !v)}
          style={{
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid var(--border)",
            background: "rgba(124, 92, 255, 0.18)",
            color: "var(--text)",
            fontWeight: 800,
            width: "100%"
          }}
        >
          {expanded ? "Ocultar" : "Ver más"}
        </button>
      </div>

      {expanded ? (
        <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
          {leaders.slice(0, 50).map((l, idx) => (
            <div
              key={`${l.nickname}-all-${idx}`}
              className="row"
              style={{
                justifyContent: "space-between",
                padding: 10,
                borderRadius: 12,
                border: "1px solid var(--border)",
                background: "rgba(255,255,255,0.04)"
              }}
            >
              <div style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
                <div style={{ width: 28, color: "var(--muted)", fontSize: 13 }}>#{idx + 1}</div>
                <div style={{ fontWeight: 700 }}>{l.nickname}</div>
              </div>
              <div style={{ color: "var(--text)", fontWeight: 800 }}>{l.points}</div>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

