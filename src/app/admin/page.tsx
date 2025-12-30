"use client";

import { useEffect, useMemo, useState } from "react";
import { TimeBlockCard } from "@/components/TimeBlockCard";

type Overview = {
  ok: true;
  blockStart: string;
  nextBlockInSec: number;
  gameStatus: string;
  players: {
    id: string;
    nickname: string;
    points: number;
    challenges: { id: string; title: string; description: string; completed: boolean }[];
  }[];
};

export default function AdminPage() {
  const [password, setPassword] = useState("");
  const [loggedIn, setLoggedIn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [overview, setOverview] = useState<Overview | null>(null);

  const title = useMemo(() => (loggedIn ? "Admin" : "Admin login"), [loggedIn]);

  async function refreshOverview() {
    setError(null);
    const res = await fetch("/api/admin/overview", { cache: "no-store" });
    if (res.status === 401) {
      setLoggedIn(false);
      setOverview(null);
      setError("Sesión admin no válida. Vuelve a iniciar sesión.");
      return;
    }
    const json = (await res.json().catch(() => null)) as any;
    if (!res.ok || !json?.ok) {
      setError(json?.error ?? "Error cargando overview");
      return;
    }
    setOverview(json as Overview);
    setLoggedIn(true);
  }

  useEffect(() => {
    // intenta cargar overview si ya hay cookie adm
    refreshOverview().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password })
      });
      const json = (await res.json().catch(() => null)) as any;
      if (!res.ok || !json?.ok) {
        setError(json?.error ?? "Login incorrecto");
        return;
      }
      setLoggedIn(true);
      setPassword("");
      await refreshOverview();
    } finally {
      setLoading(false);
    }
  }

  async function onToggle() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/toggle", { method: "POST" });
      const json = (await res.json().catch(() => null)) as any;
      if (!res.ok || !json?.ok) {
        setError(json?.error ?? "No se pudo cambiar el estado");
        return;
      }
      await refreshOverview();
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <section className="card">
        <h1 style={{ margin: 0, fontSize: 22 }}>{title}</h1>
        <p style={{ margin: "8px 0 0", color: "var(--muted)", lineHeight: 1.5 }}>
          Panel simple: jugadores, retos del bloque actual, y pausa/reanuda.
        </p>
      </section>

      <TimeBlockCard />

      {!loggedIn ? (
        <section className="card">
          <h2 style={{ margin: 0, fontSize: 18 }}>Acceso</h2>
          <form onSubmit={onLogin} style={{ marginTop: 12, display: "grid", gap: 10 }}>
            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ color: "var(--muted)", fontSize: 14 }}>Contraseña</span>
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                placeholder="••••••••"
                autoComplete="current-password"
                style={{
                  padding: "12px 12px",
                  borderRadius: 12,
                  border: "1px solid var(--border)",
                  background: "rgba(0,0,0,0.25)",
                  color: "var(--text)",
                  outline: "none"
                }}
              />
            </label>
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: "12px 12px",
                borderRadius: 12,
                border: "1px solid var(--border)",
                background: "rgba(124, 92, 255, 0.25)",
                color: "var(--text)",
                fontWeight: 700
              }}
            >
              {loading ? "Entrando..." : "Entrar"}
            </button>
            {error ? <div style={{ color: "#fecaca", fontSize: 14 }}>{error}</div> : null}
          </form>
        </section>
      ) : (
        <>
          <section className="card">
            <div className="row" style={{ justifyContent: "space-between" }}>
              <div className="pill">
                <strong>Estado</strong> {overview?.gameStatus ?? "—"}
              </div>
              <button
                onClick={onToggle}
                disabled={loading}
                style={{
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid var(--border)",
                  background: "rgba(34, 197, 94, 0.18)",
                  color: "var(--text)",
                  fontWeight: 700
                }}
              >
                {overview?.gameStatus?.toLowerCase() === "paused" ? "Resume" : "Pause"}
              </button>
            </div>
            <div className="row" style={{ marginTop: 10 }}>
              <span className="pill">
                <strong>block_start</strong> {overview?.blockStart ?? "—"}
              </span>
              <span className="pill">
                <strong>siguiente</strong> {overview?.nextBlockInSec ?? 0}s
              </span>
              <button
                onClick={() => refreshOverview()}
                disabled={loading}
                style={{
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid var(--border)",
                  background: "rgba(255,255,255,0.06)",
                  color: "var(--text)",
                  fontWeight: 700
                }}
              >
                Refrescar
              </button>
            </div>
            {error ? <div style={{ color: "#fecaca", fontSize: 14, marginTop: 10 }}>{error}</div> : null}
          </section>

          <section className="card">
            <h2 style={{ margin: 0, fontSize: 18 }}>Jugadores</h2>
            <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
              {(overview?.players ?? []).slice(0, 100).map((p) => (
                <div
                  key={p.id}
                  style={{
                    padding: 12,
                    borderRadius: 12,
                    border: "1px solid var(--border)",
                    background: "rgba(0,0,0,0.18)"
                  }}
                >
                  <div className="row" style={{ justifyContent: "space-between" }}>
                    <div style={{ fontWeight: 800 }}>{p.nickname}</div>
                    <div className="pill">
                      <strong>puntos</strong> {p.points}
                    </div>
                  </div>

                  <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                    {p.challenges.length === 0 ? (
                      <div style={{ color: "var(--muted)", fontSize: 14 }}>
                        Sin retos asignados en este bloque (o aún no ha pedido /api/challenges).
                      </div>
                    ) : (
                      p.challenges.map((c) => (
                        <div
                          key={c.id}
                          style={{
                            padding: 10,
                            borderRadius: 12,
                            border: "1px solid var(--border)",
                            background: c.completed ? "rgba(34, 197, 94, 0.12)" : "rgba(255,255,255,0.04)"
                          }}
                        >
                          <div className="row" style={{ justifyContent: "space-between" }}>
                            <div style={{ fontWeight: 700 }}>{c.title}</div>
                            <div style={{ color: c.completed ? "var(--accent2)" : "var(--muted)", fontSize: 13 }}>
                              {c.completed ? "Completado" : "Pendiente"}
                            </div>
                          </div>
                          <div style={{ marginTop: 6, color: "var(--muted)", fontSize: 14, lineHeight: 1.35 }}>
                            {c.description}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </>
  );
}

