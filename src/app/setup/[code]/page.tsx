"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

async function fetchJson<T>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<{ ok: true; data: T } | { ok: false; status: number; error: string }> {
  try {
    const res = await fetch(input, init);
    const json = await res.json().catch(() => null);
    if (!res.ok) return { ok: false, status: res.status, error: (json as any)?.error ?? "REQUEST_FAILED" };
    return { ok: true, data: json as T };
  } catch {
    return { ok: false, status: 0, error: "NETWORK_ERROR" };
  }
}

type Player = { id: string; nickname: string; points: number };

export default function SetupRoomPage() {
  const params = useParams<{ code: string }>();
  const code = (params?.code ?? "").toUpperCase();

  const [roomName, setRoomName] = useState("");
  const [players, setPlayers] = useState<Player[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [shareNotSupported, setShareNotSupported] = useState(false);

  const inviteLink = useMemo(() => {
    if (!code) return "";
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/room/${code}`;
  }, [code]);

  useEffect(() => {
    try {
      setRoomName(localStorage.getItem("draft.roomName") ?? "");
    } catch {}

    try {
      setShareNotSupported(!(typeof navigator !== "undefined" && "share" in navigator));
    } catch {
      setShareNotSupported(true);
    }
  }, []);

  useEffect(() => {
    if (!code) return;
    (async () => {
      const res = await fetchJson<{ ok: true; room: { name: string | null } }>(`/api/rooms/info?code=${encodeURIComponent(code)}`);
      if (!res.ok) return;
      const n = (res.data as any)?.room?.name;
      if (typeof n === "string" && n.trim()) setRoomName(n.trim());
    })();
  }, [code]);

  useEffect(() => {
    if (!code) return;
    let cancelled = false;

    async function refreshPlayers() {
      const res = await fetchJson<{ ok: true; players: Player[] }>(`/api/rooms/players?code=${encodeURIComponent(code)}`, {
        cache: "no-store"
      });
      if (cancelled) return;
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setPlayers((res.data as any).players ?? []);
    }

    refreshPlayers().catch(() => {});
    const id = setInterval(() => refreshPlayers().catch(() => {}), 3000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [code]);

  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(inviteLink);
    } catch {
      const el = document.createElement("textarea");
      el.value = inviteLink;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    }
  }

  async function shareInvite() {
    try {
      if (!inviteLink) return;
      if (typeof navigator !== "undefined" && "share" in navigator) {
        await (navigator as any).share({
          title: `Sala ${roomName || code}`.trim(),
          text: "Únete a mi sala:",
          url: inviteLink
        });
        return;
      }
    } catch {
      return;
    }

    await copyInvite();
  }

  return (
    <>
      <section className="card">
        <h1 style={{ margin: 0, fontSize: 22 }}>Ajustes de la sala</h1>
        <p style={{ margin: "8px 0 0", color: "var(--muted)", lineHeight: 1.5 }}>
          Comparte el enlace para que tus amigos entren y elijan su nickname. Cuando estéis listos, entra a la sala y
          pulsa “Empezar ahora”.
        </p>
      </section>

      {error ? (
        <section className="card" style={{ borderColor: "rgba(254, 202, 202, 0.35)" }}>
          <div style={{ color: "#fecaca", fontSize: 14 }}>
            Error: <strong>{error}</strong>
          </div>
        </section>
      ) : null}

      <section className="card">
        <h2 style={{ margin: 0, fontSize: 18 }}>Sala</h2>
        <div className="row" style={{ marginTop: 10 }}>
          <span className="pill">
            <strong>Nombre</strong> {roomName || "—"}
          </span>
          <span className="pill">
            <strong>Código</strong> {code || "—"}
          </span>
        </div>
      </section>

      <section className="card">
        <h2 style={{ margin: 0, fontSize: 18 }}>Invitar</h2>
        <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
          <div className="pill" style={{ justifyContent: "space-between", width: "100%" }}>
            <strong>Enlace</strong>
            <span style={{ wordBreak: "break-all" }}>{inviteLink}</span>
          </div>
          <button
            onClick={shareInvite}
            style={{
              padding: "12px 12px",
              borderRadius: 12,
              border: "1px solid var(--border)",
              background: "rgba(59, 130, 246, 0.18)",
              color: "var(--text)",
              fontWeight: 900
            }}
          >
            {shareNotSupported ? "Copiar para compartir" : "Compartir enlace"}
          </button>
          <button
            onClick={copyInvite}
            style={{
              padding: "12px 12px",
              borderRadius: 12,
              border: "1px solid var(--border)",
              background: "rgba(34, 197, 94, 0.18)",
              color: "var(--text)",
              fontWeight: 900
            }}
          >
            Copiar enlace
          </button>
          <button
            onClick={() => {
              window.location.href = `/room/${code}`;
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
            Entrar a la sala
          </button>
        </div>
      </section>

      <section className="card">
        <h2 style={{ margin: 0, fontSize: 18 }}>Jugadores ({players.length})</h2>
        <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
          {players.length === 0 ? (
            <div style={{ color: "var(--muted)", fontSize: 14 }}>Aún no ha entrado nadie.</div>
          ) : (
            players.map((p) => (
              <div key={p.id} className="pill" style={{ justifyContent: "space-between", width: "100%" }}>
                <span style={{ fontWeight: 900 }}>{p.nickname}</span>
                <span style={{ color: "var(--muted)" }}>{p.points} pts</span>
              </div>
            ))
          )}
        </div>
      </section>
    </>
  );
}

