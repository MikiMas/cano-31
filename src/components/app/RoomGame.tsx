"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AppHeader } from "@/components/app/AppHeader";
import { JoinNickname } from "@/components/app/JoinNickname";
import { ChallengesSection } from "@/components/app/ChallengesSection";
import { LeaderboardSection } from "@/components/app/LeaderboardSection";

type Player = { id: string; nickname: string; points: number; room_id?: string };
type RoomPlayer = { id: string; nickname: string; points: number };
type RoomInfo = { id?: string; code?: string; name?: string | null };

function getStoredSessionToken(): string | null {
  try {
    return localStorage.getItem("st");
  } catch {
    return null;
  }
}

function storeSessionToken(token: string) {
  try {
    localStorage.setItem("st", token);
  } catch {}
}

function clearStoredSessionToken() {
  try {
    localStorage.removeItem("st");
  } catch {}
  try {
    document.cookie = "st=; Max-Age=0; path=/";
  } catch {}
}

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

export function RoomGame({ roomCode }: { roomCode: string }) {
  const [player, setPlayer] = useState<Player | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [blockStart, setBlockStart] = useState<string | null>(null);
  const [nextBlockInSec, setNextBlockInSec] = useState<number>(0);
  const [state, setState] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [booting, setBooting] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  const [roomPlayers, setRoomPlayers] = useState<RoomPlayer[]>([]);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [roomName, setRoomName] = useState<string>("");
  const [ownerNickname, setOwnerNickname] = useState<string>("");

  const authHeaders: Record<string, string> = useMemo(() => {
    const token = sessionToken ?? getStoredSessionToken();
    return token ? { "x-session-token": token } : ({} as Record<string, string>);
  }, [sessionToken]);

  const refreshMe = useCallback(async () => {
    const res = await fetchJson<{ player: Player; sessionToken: string }>("/api/me", {
      headers: { ...authHeaders }
    });

    if (!res.ok) {
      if (res.status === 401) {
        setPlayer(null);
        setSessionToken(null);
        clearStoredSessionToken();
        return;
      }
      setError(res.error);
      return;
    }

    setPlayer(res.data.player);
    setSessionToken(res.data.sessionToken);
    storeSessionToken(res.data.sessionToken);

    const meRoom = await fetchJson<{ ok: true; role: string }>("/api/rooms/me", { headers: { ...authHeaders }, cache: "no-store" });
    if (meRoom.ok) setIsOwner((meRoom.data as any).role === "owner");
  }, [authHeaders]);

  const refreshChallenges = useCallback(async () => {
    if (!player) return;
    const res = await fetchJson<
      | { paused: true; state: string; nextBlockInSec: number; blockStart: string }
      | {
          paused: false;
          blockStart: string;
          nextBlockInSec: number;
          challenges: {
            id: string;
            title: string;
            description: string;
            completed: boolean;
            hasMedia: boolean;
            media: { url: string | null; type: string | null; mime: string | null } | null;
          }[];
        }
    >("/api/challenges", { headers: { ...authHeaders }, cache: "no-store" });

    if (!res.ok) {
      if (res.status === 401) {
        setPlayer(null);
        setSessionToken(null);
        clearStoredSessionToken();
        return;
      }
      setError(res.error);
      return;
    }

    setPaused(res.data.paused);
    setState((res.data as any).state ?? null);
    setBlockStart(res.data.blockStart);
    setNextBlockInSec(res.data.nextBlockInSec);
    return res.data;
  }, [authHeaders, player]);

  useEffect(() => {
    (async () => {
      setBooting(true);
      setError(null);
      await refreshMe();
      setBooting(false);
    })();
  }, [refreshMe]);

  useEffect(() => {
    (async () => {
      const info = await fetchJson<{ ok: true; room: RoomInfo }>(`/api/rooms/info?code=${encodeURIComponent(roomCode)}`, { cache: "no-store" });
      if (info.ok) {
        const n = (info.data as any)?.room?.name;
        if (typeof n === "string" && n.trim()) setRoomName(n.trim());
      }

      const owner = await fetchJson<{ ok: true; owner: { nickname: string } }>(`/api/rooms/owner?code=${encodeURIComponent(roomCode)}`, {
        cache: "no-store"
      });
      if (owner.ok) {
        const nick = (owner.data as any)?.owner?.nickname;
        if (typeof nick === "string" && nick.trim()) setOwnerNickname(nick.trim());
      }
    })();
  }, [roomCode]);

  useEffect(() => {
    if (!player) return;
    refreshChallenges().catch(() => {});
  }, [player, refreshChallenges]);

  useEffect(() => {
    if (!player) return;
    const id = setInterval(() => setNextBlockInSec((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, [player]);

  useEffect(() => {
    if (!player) return;
    const id = setInterval(() => refreshChallenges().catch(() => {}), 8000);
    return () => clearInterval(id);
  }, [player, refreshChallenges]);

  useEffect(() => {
    if (!player) return;
    let cancelled = false;

    async function refreshRoomPlayers() {
      const res = await fetchJson<{ ok: true; players: RoomPlayer[] }>(`/api/rooms/players?code=${encodeURIComponent(roomCode)}`, {
        cache: "no-store"
      });
      if (cancelled) return;
      if (!res.ok) return;
      setRoomPlayers((res.data as any).players ?? []);
    }

    refreshRoomPlayers().catch(() => {});
    const id = setInterval(() => refreshRoomPlayers().catch(() => {}), 3000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [player, roomCode]);

  useEffect(() => {
    if (!player) return;
    if (nextBlockInSec !== 0) return;
    refreshChallenges().catch(() => {});
  }, [nextBlockInSec, player, refreshChallenges]);

  const onJoined = useCallback((data: { player: Player; sessionToken: string }) => {
    setPlayer(data.player);
    setSessionToken(data.sessionToken);
    storeSessionToken(data.sessionToken);
  }, []);

  const onPointsUpdate = useCallback((points: number) => {
    setPlayer((p) => (p ? { ...p, points } : p));
  }, []);

  const onNeedsAuthReset = useCallback(() => {
    setPlayer(null);
    setSessionToken(null);
    clearStoredSessionToken();
  }, []);

  const leaveRoom = useCallback(async () => {
    setError(null);
    const res = await fetchJson<{ ok: true }>("/api/rooms/leave", {
      method: "POST",
      headers: { ...authHeaders }
    });
    if (!res.ok) {
      setError(res.error);
      return;
    }

    setShowLeaveConfirm(false);
    onNeedsAuthReset();
    window.location.href = "/";
  }, [authHeaders, onNeedsAuthReset]);

  const closeRoom = useCallback(async () => {
    setError(null);
    const res = await fetchJson<{ ok: true }>("/api/rooms/close", {
      method: "POST",
      headers: { "content-type": "application/json", ...authHeaders },
      body: JSON.stringify({ code: roomCode })
    });
    if (!res.ok) {
      setError(res.error);
      return;
    }

    setShowCloseConfirm(false);
    setShowLeaveConfirm(false);
    onNeedsAuthReset();
    window.location.href = "/";
  }, [authHeaders, onNeedsAuthReset, roomCode]);

  const showPausedCard = paused && state !== "scheduled";

  return (
    <>
      <AppHeader
        player={player ? { nickname: player.nickname, points: player.points } : null}
        nextBlockInSec={nextBlockInSec}
        paused={paused}
        showGameStatus={state !== "scheduled"}
        onRetry={() => {
          setError(null);
          refreshMe().catch(() => {});
          refreshChallenges().catch(() => {});
        }}
      />

      {error ? (
        <section className="card" style={{ borderColor: "rgba(254, 202, 202, 0.35)" }}>
          <div style={{ color: "#fecaca", fontSize: 14, lineHeight: 1.4 }}>
            Error: <strong>{error}</strong>
          </div>
        </section>
      ) : null}

      {!player ? (
        <JoinNickname disabled={booting} onJoined={onJoined} joinMode={{ type: "room", code: roomCode }} />
      ) : (
        <>
          {showLeaveConfirm ? (
            <section className="card" style={{ borderColor: "rgba(254, 202, 202, 0.35)" }}>
              <h2 style={{ margin: 0, fontSize: 18 }}>¿Abandonar la partida?</h2>
              <p style={{ margin: "8px 0 0", color: "var(--muted)", lineHeight: 1.5 }}>
                Se borrarán tus datos: sesión, retos asignados y media subida.
              </p>
              <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                <button
                  onClick={() => leaveRoom()}
                  style={{
                    width: "100%",
                    padding: "12px 12px",
                    borderRadius: 12,
                    border: "1px solid rgba(254, 202, 202, 0.35)",
                    background: "rgba(239, 68, 68, 0.16)",
                    color: "var(--text)",
                    fontWeight: 900
                  }}
                >
                  Sí, abandonar
                </button>
                <button
                  onClick={() => setShowLeaveConfirm(false)}
                  style={{
                    width: "100%",
                    padding: "12px 12px",
                    borderRadius: 12,
                    border: "1px solid var(--border)",
                    background: "rgba(255,255,255,0.06)",
                    color: "var(--text)",
                    fontWeight: 900
                  }}
                >
                  Cancelar
                </button>
              </div>
            </section>
          ) : null}

          {showCloseConfirm ? (
            <section className="card" style={{ borderColor: "rgba(254, 202, 202, 0.35)" }}>
              <h2 style={{ margin: 0, fontSize: 18 }}>¿Cerrar la sala?</h2>
              <p style={{ margin: "8px 0 0", color: "var(--muted)", lineHeight: 1.5 }}>
                Esto borrará toda la información de todos los jugadores (sesiones, retos y media) y eliminará la sala.
              </p>
              <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                <button
                  onClick={() => closeRoom()}
                  style={{
                    width: "100%",
                    padding: "12px 12px",
                    borderRadius: 12,
                    border: "1px solid rgba(254, 202, 202, 0.35)",
                    background: "rgba(239, 68, 68, 0.16)",
                    color: "var(--text)",
                    fontWeight: 900
                  }}
                >
                  Sí, cerrar sala
                </button>
                <button
                  onClick={() => setShowCloseConfirm(false)}
                  style={{
                    width: "100%",
                    padding: "12px 12px",
                    borderRadius: 12,
                    border: "1px solid var(--border)",
                    background: "rgba(255,255,255,0.06)",
                    color: "var(--text)",
                    fontWeight: 900
                  }}
                >
                  Cancelar
                </button>
              </div>
            </section>
          ) : null}

          {state !== "scheduled" ? (
            <section className="card">
              <h2 style={{ margin: 0, fontSize: 18 }}>Opciones</h2>
              <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                {isOwner ? (
                  <button
                    onClick={() => setShowCloseConfirm(true)}
                    style={{
                      width: "100%",
                      padding: "12px 12px",
                      borderRadius: 12,
                      border: "1px solid rgba(254, 202, 202, 0.35)",
                      background: "rgba(239, 68, 68, 0.12)",
                      color: "var(--text)",
                      fontWeight: 900
                    }}
                  >
                    Cerrar sala (borrar todo)
                  </button>
                ) : null}
                <button
                  onClick={() => setShowLeaveConfirm(true)}
                  style={{
                    width: "100%",
                    padding: "12px 12px",
                    borderRadius: 12,
                    border: "1px solid rgba(254, 202, 202, 0.35)",
                    background: "rgba(239, 68, 68, 0.10)",
                    color: "var(--text)",
                    fontWeight: 900
                  }}
                >
                  Abandonar (borrar mis datos)
                </button>
              </div>
            </section>
          ) : null}
          {state === "scheduled" ? (
            <section className="card">
              <h2 style={{ margin: 0, fontSize: 18 }}>{isOwner ? "Aún no empieza" : roomName || `Sala ${roomCode}`}</h2>
              <p style={{ margin: "8px 0 0", color: "var(--muted)", lineHeight: 1.5 }}>
                {isOwner ? "Espera al inicio o pide al host que pulse “Empezar ahora”." : "Estás en la sala de espera."}
              </p>
              {!isOwner ? (
                <div className="row" style={{ marginTop: 10 }}>
                  <span className="pill">
                    <strong>Admin</strong> {ownerNickname || "—"}
                  </span>
                </div>
              ) : null}
              <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
                <div style={{ color: "var(--muted)", fontSize: 13, fontWeight: 900 }}>Jugadores ({roomPlayers.length})</div>
                {roomPlayers.length === 0 ? (
                  <div style={{ color: "var(--muted)", fontSize: 14 }}>Aún no ha entrado nadie.</div>
                ) : (
                  roomPlayers.map((p) => (
                    <div key={p.id} className="pill" style={{ justifyContent: "space-between", width: "100%" }}>
                      <span style={{ fontWeight: 900 }}>{p.nickname}</span>
                      <span style={{ color: "var(--muted)" }}>{p.points} pts</span>
                    </div>
                  ))
                )}
              </div>
              {isOwner ? (
                <button
                  onClick={async () => {
                    setError(null);
                    const res = await fetchJson<{ ok: true; startsAt: string; endsAt: string }>("/api/rooms/start", {
                      method: "POST",
                      headers: { "content-type": "application/json", ...authHeaders },
                      body: JSON.stringify({ code: roomCode })
                    });
                    if (!res.ok) {
                      setError(res.error);
                      return;
                    }
                    await refreshChallenges();
                  }}
                  style={{
                    marginTop: 12,
                    width: "100%",
                    padding: "12px 12px",
                    borderRadius: 12,
                    border: "1px solid var(--border)",
                    background: "rgba(34, 197, 94, 0.18)",
                    color: "var(--text)",
                    fontWeight: 900
                  }}
                >
                  Empezar ahora
                </button>
              ) : null}
              {!isOwner ? (
                <button
                  onClick={() => setShowLeaveConfirm(true)}
                  style={{
                    marginTop: 10,
                    width: "100%",
                    padding: "12px 12px",
                    borderRadius: 12,
                    border: "1px solid rgba(254, 202, 202, 0.35)",
                    background: "rgba(239, 68, 68, 0.10)",
                    color: "var(--text)",
                    fontWeight: 900
                  }}
                >
                  Abandonar
                </button>
              ) : null}
            </section>
          ) : null}

          {state !== "scheduled" && state === "ended" ? (
            <section className="card">
              <h2 style={{ margin: 0, fontSize: 18 }}>Partida terminada</h2>
              <p style={{ margin: "8px 0 0", color: "var(--muted)", lineHeight: 1.5 }}>
                La sala ya ha terminado. Puedes ver el ranking final.
              </p>
            </section>
          ) : null}

          {state !== "scheduled" && showPausedCard ? (
            <section className="card">
              <h2 style={{ margin: 0, fontSize: 18 }}>Juego en pausa</h2>
              <p style={{ margin: "8px 0 0", color: "var(--muted)", lineHeight: 1.5 }}>
                El host ha pausado el juego. El contador sigue corriendo.
              </p>
            </section>
          ) : null}

          {state !== "scheduled" ? (
            <>
              <ChallengesSection
                authHeaders={authHeaders}
                blockStart={blockStart}
                onPointsUpdate={onPointsUpdate}
                onNeedsAuthReset={onNeedsAuthReset}
                onRefreshAll={() => refreshChallenges()}
              />

              <LeaderboardSection
                authHeaders={authHeaders}
                onNeedsAuthReset={onNeedsAuthReset}
                refreshSignal={`${player.points}:${blockStart ?? ""}`}
              />
            </>
          ) : null}
        </>
      )}
    </>
  );
}
