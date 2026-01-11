"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Leader = { id: string; nickname: string; points: number };
type Summary = { ok: true; roomName: string | null; leaders: Leader[] } | { ok: false; error: string };

type PlayerChallenge = {
  id: string;
  title: string;
  description: string;
  completedAt: string | null;
  blockStart: string;
  media: { url: string; mime: string; type: string } | null;
};

type PlayerChallengesRes =
  | { ok: true; player: { id: string; nickname: string; points: number }; completed: PlayerChallenge[] }
  | { ok: false; error: string };

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

function isValidEmail(email: string): boolean {
  const v = email.trim();
  if (!v) return false;
  if (v.length > 200) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function safeFileName(input: string): string {
  return input
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_")
    .replace(/\s+/g, " ")
    .slice(0, 80);
}

export function FinalResultsScreen({
  authHeaders,
  onNeedsAuthReset
}: {
  authHeaders: Record<string, string>;
  onNeedsAuthReset: () => void;
}) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [playerChallenges, setPlayerChallenges] = useState<PlayerChallengesRes | null>(null);
  const [loadingPlayer, setLoadingPlayer] = useState(false);

  const storageKey = useMemo(() => {
    try {
      const code = new URL(window.location.href).pathname.split("/").filter(Boolean).pop() ?? "room";
      return `canoo:final-email:${code}`;
    } catch {
      return "canoo:final-email:room";
    }
  }, []);

  const [email, setEmail] = useState("");
  const [emailSentTo, setEmailSentTo] = useState<string | null>(null);
  const [emailAttempts, setEmailAttempts] = useState(0);
  const [sendingEmail, setSendingEmail] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { attempts?: number; sentTo?: string } | null;
      setEmailAttempts(Math.max(0, Math.min(2, Number(parsed?.attempts ?? 0) || 0)));
      setEmailSentTo(typeof parsed?.sentTo === "string" && parsed.sentTo ? parsed.sentTo : null);
    } catch {
      // ignore
    }
  }, [storageKey]);

  const persistEmailState = useCallback(
    (next: { attempts: number; sentTo: string | null }) => {
      setEmailAttempts(next.attempts);
      setEmailSentTo(next.sentTo);
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        // ignore
      }
    },
    [storageKey]
  );

  const loadSummary = useCallback(async () => {
    setLoadingSummary(true);
    setError(null);
    const res = await fetchJson<Summary>("/api/final/summary", { headers: { ...authHeaders }, cache: "no-store" });
    setLoadingSummary(false);

    if (!res.ok) {
      if (res.status === 401) {
        onNeedsAuthReset();
        return;
      }
      setError(res.error);
      return;
    }

    setSummary(res.data);
  }, [authHeaders, onNeedsAuthReset]);

  const loadPlayer = useCallback(
    async (playerId: string) => {
      setLoadingPlayer(true);
      setPlayerChallenges(null);
      const res = await fetchJson<PlayerChallengesRes>(`/api/final/player?playerId=${encodeURIComponent(playerId)}`, {
        headers: { ...authHeaders },
        cache: "no-store"
      });
      setLoadingPlayer(false);

      if (!res.ok) {
        if (res.status === 401) {
          onNeedsAuthReset();
          return;
        }
        setPlayerChallenges({ ok: false, error: res.error });
        return;
      }

      setPlayerChallenges(res.data);
    },
    [authHeaders, onNeedsAuthReset]
  );

  useEffect(() => {
    loadSummary().catch(() => {});
  }, [loadSummary]);

  const leaders = (summary && (summary as any).ok ? (summary as any).leaders : []) as Leader[];
  const winner = leaders[0] ?? null;

  const canSendEmail = emailAttempts < 2 && !sendingEmail;

  const sendZipToEmail = useCallback(async () => {
    setError(null);
    const trimmed = email.trim();
    if (!isValidEmail(trimmed)) {
      setError("Introduce un correo v\u00e1lido.");
      return;
    }
    if (emailAttempts >= 2) {
      setError("Has alcanzado el l\u00edmite de env\u00edos.");
      return;
    }

    setSendingEmail(true);
    const res = await fetchJson<{ ok: true; sentTo: string } | { ok: false; error: string }>("/api/final/email-zip", {
      method: "POST",
      headers: { "content-type": "application/json", ...authHeaders },
      body: JSON.stringify({ email: trimmed })
    });
    setSendingEmail(false);

    if (!res.ok) {
      if (res.status === 401) {
        onNeedsAuthReset();
        return;
      }
      setError(res.error);
      return;
    }

    const sentTo = (res.data as any)?.sentTo ?? trimmed;
    persistEmailState({ attempts: Math.min(2, emailAttempts + 1), sentTo });
    setEmail("");
  }, [authHeaders, email, emailAttempts, onNeedsAuthReset, persistEmailState]);

  return (
    <>
      <section className="card">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>Partida finalizada</h2>
          <button
            onClick={() => loadSummary()}
            disabled={loadingSummary}
            style={{
              padding: "8px 10px",
              borderRadius: 12,
              border: "1px solid var(--border)",
              background: "var(--field-bg)",
              color: "var(--text)",
              fontWeight: 700
            }}
          >
            {loadingSummary ? "..." : "Actualizar"}
          </button>
        </div>

        {winner ? (
          <div style={{ marginTop: 12, padding: 14, borderRadius: 14, border: "1px solid rgba(250,204,21,0.45)", background: "linear-gradient(135deg, rgba(250,204,21,0.22), rgba(255,255,255,0.70))" }}>
            <div style={{ color: "var(--muted)", fontSize: 13, fontWeight: 900 }}>Ganador/a</div>
            <div className="row" style={{ justifyContent: "space-between", marginTop: 6 }}>
              <div style={{ fontSize: 20, fontWeight: 900 }}>{winner.nickname}</div>
              <div className="pill" style={{ borderColor: "rgba(250,204,21,0.45)", background: "rgba(8, 22, 17, 0.65)" }}>
                <strong style={{ color: "var(--accent)" }}>{winner.points}</strong>
              </div>
            </div>
          </div>
        ) : null}

        {error ? <div style={{ marginTop: 12, color: "var(--danger)", fontSize: 14 }}>{error}</div> : null}
      </section>

      <section className="card">
        <h2 style={{ margin: 0, fontSize: 18 }}>Ranking final</h2>
        <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
          {leaders.slice(0, 50).map((l, idx) => (
            <div key={l.id} className="pill" style={{ justifyContent: "space-between", width: "100%" }}>
              <span style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
                <span style={{ width: 34, color: "var(--muted)", fontWeight: 900 }}>#{idx + 1}</span>
                <span style={{ fontWeight: 900 }}>{l.nickname}</span>
              </span>
              <span style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <span style={{ color: "var(--muted)", fontWeight: 900 }}>{l.points} pts</span>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedPlayerId(l.id);
                    loadPlayer(l.id).catch(() => {});
                  }}
                  style={{
                    padding: "8px 10px",
                    borderRadius: 12,
                    border: "1px solid var(--border)",
                    background: "rgba(255,255,255,0.06)",
                    color: "var(--text)",
                    fontWeight: 800
                  }}
                >
                  Ver retos
                </button>
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <h2 style={{ margin: 0, fontSize: 18 }}>Recibir todas las im\u00e1genes</h2>
        <p style={{ margin: "8px 0 0", color: "var(--muted)", lineHeight: 1.5 }}>
          Te enviaremos un ZIP con todas las im\u00e1genes de la sala. M\u00e1ximo 2 env\u00edos.
        </p>

        {emailSentTo ? (
          <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
            <div className="pill" style={{ justifyContent: "space-between", width: "100%" }}>
              <span style={{ fontWeight: 900 }}>Correo enviado</span>
              <span style={{ color: "var(--muted)" }}>{emailSentTo}</span>
            </div>
            {emailAttempts < 2 ? (
              <button
                type="button"
                onClick={() => {
                  persistEmailState({ attempts: emailAttempts, sentTo: null });
                  setError(null);
                }}
                style={{
                  padding: "12px 12px",
                  borderRadius: 12,
                  border: "1px solid var(--border)",
                  background: "rgba(255,255,255,0.06)",
                  color: "var(--text)",
                  fontWeight: 900
                }}
              >
                \u00bfNo has recibido el correo? Enviar a otro email
              </button>
            ) : (
              <div style={{ marginTop: 8, color: "var(--muted)", fontSize: 13, fontWeight: 800 }}>
                Has alcanzado el l\u00edmite de env\u00edos.
              </div>
            )}
          </div>
        ) : (
          <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com"
              inputMode="email"
              autoCapitalize="none"
              autoCorrect="off"
              style={{
                width: "100%",
                padding: "12px 12px",
                borderRadius: 12,
                border: "1px solid var(--border)",
                background: "var(--field-bg)",
                color: "var(--text)",
                fontWeight: 700
              }}
            />
            <button
              type="button"
              onClick={() => sendZipToEmail()}
              disabled={!canSendEmail}
              style={{
                padding: "12px 12px",
                borderRadius: 12,
                border: "1px solid var(--border)",
                background: canSendEmail ? "rgba(34, 197, 94, 0.18)" : "rgba(255,255,255,0.06)",
                color: "var(--text)",
                fontWeight: 900
              }}
            >
              {sendingEmail ? "Enviando..." : "Enviar ZIP"}
            </button>
            <div style={{ color: "var(--muted)", fontSize: 13, fontWeight: 800 }}>
              Intentos: {emailAttempts}/2
            </div>
          </div>
        )}
      </section>

      {selectedPlayerId ? (
        <div className="infoModal" role="dialog" aria-modal="true" aria-label="Retos del jugador">
          <button className="infoBackdrop" type="button" onClick={() => setSelectedPlayerId(null)} aria-label="Cerrar" />
          <div className="infoPanel">
            <div className="infoTop">
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <span className="infoBadge">Retos</span>
                <span style={{ color: "var(--muted)", fontSize: 13 }}>
                  {playerChallenges && (playerChallenges as any).ok ? (playerChallenges as any).player.nickname : ""}
                </span>
              </div>
              <button className="infoClose" type="button" onClick={() => setSelectedPlayerId(null)}>
                Cerrar
              </button>
            </div>

            {loadingPlayer ? <div style={{ marginTop: 12, color: "var(--muted)", fontWeight: 800 }}>Cargando...</div> : null}

            {playerChallenges && !(playerChallenges as any).ok ? (
              <div style={{ marginTop: 12, color: "var(--danger)", fontSize: 14 }}>{(playerChallenges as any).error}</div>
            ) : null}

            {playerChallenges && (playerChallenges as any).ok ? (
              <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
                {(playerChallenges as any).completed.length === 0 ? (
                  <div style={{ color: "var(--muted)", fontSize: 14 }}>No hay retos completados con media.</div>
                ) : (
                  (playerChallenges as any).completed.map((c: PlayerChallenge) => (
                    <div key={c.id} style={{ border: "1px solid var(--border)", borderRadius: 14, padding: 12, background: "rgba(255,255,255,0.04)" }}>
                      <div style={{ fontWeight: 900 }}>{c.title}</div>
                      {c.description ? <div style={{ marginTop: 6, color: "var(--muted)", fontSize: 13, lineHeight: 1.4 }}>{c.description}</div> : null}
                      {c.media?.url ? (
                        <div style={{ marginTop: 10 }}>
                          {String(c.media.type) === "video" ? (
                            <video controls playsInline style={{ width: "100%", borderRadius: 12, border: "1px solid var(--border)" }}>
                              <source src={c.media.url} type={c.media.mime || "video/mp4"} />
                            </video>
                          ) : (
                            <img
                              src={c.media.url}
                              alt={safeFileName(c.title)}
                              style={{ width: "100%", borderRadius: 12, border: "1px solid var(--border)" }}
                              loading="lazy"
                            />
                          )}
                          <a
                            href={c.media.url}
                            target="_blank"
                            rel="noreferrer"
                            style={{ display: "inline-block", marginTop: 8, color: "var(--accent)", fontWeight: 900 }}
                          >
                            Abrir media
                          </a>
                        </div>
                      ) : null}
                    </div>
                  ))
                )}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}

