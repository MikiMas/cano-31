"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppHeader } from "@/components/app/AppHeader";
import { JoinNickname } from "@/components/app/JoinNickname";
import { ChallengesSection } from "@/components/app/ChallengesSection";
import { LeaderboardSection } from "@/components/app/LeaderboardSection";

type Player = { id: string; nickname: string; points: number };

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

export default function HomePage() {
  const [player, setPlayer] = useState<Player | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [blockStart, setBlockStart] = useState<string | null>(null);
  const [nextBlockInSec, setNextBlockInSec] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [booting, setBooting] = useState(true);

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
  }, [authHeaders]);

  const refreshChallenges = useCallback(async () => {
    if (!player) return;
    const res = await fetchJson<
      | { paused: true; nextBlockInSec: number; blockStart: string }
      | {
          paused: false;
          blockStart: string;
          nextBlockInSec: number;
          challenges: { id: string; title: string; description: string; completed: boolean; hasMedia: boolean }[];
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
    if (!player) return;
    refreshChallenges().catch(() => {});
  }, [player, refreshChallenges]);

  useEffect(() => {
    if (!player) return;
    const id = setInterval(() => {
      setNextBlockInSec((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => clearInterval(id);
  }, [player]);

  useEffect(() => {
    if (!player) return;
    const id = setInterval(() => {
      refreshChallenges().catch(() => {});
    }, 7000);
    return () => clearInterval(id);
  }, [player, refreshChallenges]);

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

  return (
    <>
      <AppHeader
        player={player}
        nextBlockInSec={nextBlockInSec}
        paused={paused}
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
        <JoinNickname disabled={booting} onJoined={onJoined} />
      ) : (
        <>
          {paused ? (
            <section className="card">
              <h2 style={{ margin: 0, fontSize: 18 }}>Juego en pausa</h2>
              <p style={{ margin: "8px 0 0", color: "var(--muted)", lineHeight: 1.5 }}>
                Vuelve pronto. El contador sigue corriendo y se reanudará cuando el admin active el juego.
              </p>
            </section>
          ) : null}

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
      )}
    </>
  );
}
