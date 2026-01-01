"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { RoomGame } from "@/components/app/RoomGame";

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

export default function RoomPage() {
  const params = useParams<{ code: string }>();
  const code = (params?.code ?? "").toUpperCase();
  const [roomExists, setRoomExists] = useState<boolean | null>(null);
  const [needsSwitch, setNeedsSwitch] = useState(false);

  const title = useMemo(() => `Sala ${code}`, [code]);

  useEffect(() => {
    (async () => {
      const res = await fetchJson<{ ok: true; room: any }>(`/api/rooms/info?code=${encodeURIComponent(code)}`);
      setRoomExists(res.ok);
      if (!res.ok) return;

      const me = await fetchJson<{ ok: true; player: { room_id: string } }>("/api/me", { cache: "no-store" });
      if (!me.ok) return;
      const myRoomId = (me.data as any)?.player?.room_id;
      const roomId = (res.data as any)?.room?.id;
      if (myRoomId && roomId && myRoomId !== roomId) {
        setNeedsSwitch(true);
      }
    })();
  }, [code]);

  if (roomExists === false) {
    return (
      <section className="card">
        <h1 style={{ margin: 0, fontSize: 22 }}>{title}</h1>
        <p style={{ margin: "8px 0 0", color: "var(--muted)", lineHeight: 1.5 }}>Sala no encontrada.</p>
      </section>
    );
  }

  if (needsSwitch) {
    return (
      <section className="card">
        <h1 style={{ margin: 0, fontSize: 22 }}>{title}</h1>
        <p style={{ margin: "8px 0 0", color: "var(--muted)", lineHeight: 1.5 }}>
          Ya estás en otra sala. Si quieres cambiar, se cerrará tu sesión actual.
        </p>
        <button
          onClick={() => {
            try {
              localStorage.removeItem("st");
              document.cookie = "st=; Max-Age=0; path=/";
            } catch {}
            window.location.reload();
          }}
          style={{
            marginTop: 12,
            width: "100%",
            padding: "12px 12px",
            borderRadius: 12,
            border: "1px solid rgba(254, 202, 202, 0.35)",
            background: "rgba(239, 68, 68, 0.16)",
            color: "var(--text)",
            fontWeight: 900
          }}
        >
          Cambiar a esta sala
        </button>
      </section>
    );
  }

  return <RoomGame roomCode={code} />;
}
