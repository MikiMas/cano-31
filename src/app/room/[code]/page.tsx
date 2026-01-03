"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { RoomGame } from "@/components/app/RoomGame";
import { JoinNickname } from "@/components/app/JoinNickname";
import Image from "next/image";
import { LoadingScreen } from "@/components/app/LoadingScreen";

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
  const searchParams = useSearchParams();
  const rawCode = (params as any)?.code;
  const code = (Array.isArray(rawCode) ? rawCode[0] : rawCode ?? "").toUpperCase();
  const [roomExists, setRoomExists] = useState<boolean | null>(null);
  const [needsSwitch, setNeedsSwitch] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [roomName, setRoomName] = useState<string>("");
  const [meOk, setMeOk] = useState<boolean | null>(null);
  const [loadingDecision, setLoadingDecision] = useState(true);

  const title = useMemo(() => `Sala ${code}`, [code]);
  const from = useMemo(() => {
    const v = searchParams?.get("from") ?? "";
    return v.trim();
  }, [searchParams]);

  useEffect(() => {
    if (!/^[A-Z0-9]{4,10}$/.test(code)) return;
    (async () => {
      setLoadingDecision(true);
      const res = await fetchJson<{ ok: true; room: any }>(`/api/rooms/info?code=${encodeURIComponent(code)}`);
      setRoomExists(res.ok);
      if (!res.ok) {
        if (res.error && res.error !== "ROOM_NOT_FOUND") setLoadError(res.error);
        setMeOk(null);
        setNeedsSwitch(false);
        setLoadingDecision(false);
        return;
      }
      const n = (res.data as any)?.room?.name;
      if (typeof n === "string") setRoomName(n.trim());

      const me = await fetchJson<{ ok: true; player: { room_id: string } }>("/api/me", { cache: "no-store" });
      if (!me.ok) {
        setMeOk(false);
        setNeedsSwitch(false);
        setLoadingDecision(false);
        return;
      }
      setMeOk(true);
      const myRoomId = (me.data as any)?.player?.room_id;
      const roomId = (res.data as any)?.room?.id;
      if (myRoomId && roomId && myRoomId !== roomId) {
        setNeedsSwitch(true);
      }
      setLoadingDecision(false);
    })();
  }, [code]);

  if (code && !/^[A-Z0-9]{4,10}$/.test(code)) {
    return (
      <section className="card">
        <h1 style={{ margin: 0, fontSize: 22 }}>Código inválido</h1>
        <p style={{ margin: "8px 0 0", color: "var(--muted)", lineHeight: 1.5 }}>
          El enlace de la sala no es válido.
        </p>
      </section>
    );
  }

  if (roomExists === false) {
    return (
      <section className="card">
        <h1 style={{ margin: 0, fontSize: 22 }}>{title}</h1>
        {loadError ? (
          <p style={{ margin: "8px 0 0", color: "#fecaca", lineHeight: 1.5 }}>
            Error: <strong>{loadError}</strong>
          </p>
        ) : (
          <p style={{ margin: "8px 0 0", color: "var(--muted)", lineHeight: 1.5 }}>Sala no encontrada.</p>
        )}
      </section>
    );
  }

  if (roomExists === null || loadingDecision) {
    return <LoadingScreen title="Cargando invitación…" />;
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

  if (roomExists === true && meOk === false) {
    return (
      <>
        <section className="card coverCard">
          <div className="coverTitle">
            <div className="brandHero" style={{ fontSize: 26 }}>
              Pikudo
            </div>
            <div style={{ marginTop: 6, color: "var(--muted)", lineHeight: 1.4, fontWeight: 700 }}>
              {from ? (
                <>
                  <strong style={{ color: "var(--text)" }}>{from}</strong> te ha invitado a{" "}
                  <strong style={{ color: "var(--text)" }}>{roomName || title}</strong>.
                </>
              ) : (
                <>Te han invitado a <strong style={{ color: "var(--text)" }}>{roomName || title}</strong>.</>
              )}
            </div>
          </div>

          <div className="coverMedia" aria-hidden="true">
            <Image
              src="/foto_portada.png"
              alt=""
              width={1248}
              height={542}
              priority
              sizes="(max-width: 920px) 100vw, 920px"
              style={{ width: "100%", height: "auto" }}
            />
          </div>
        </section>

        <JoinNickname
          joinMode={{ type: "room", code }}
          onJoined={() => {
            window.location.href = `/room/${encodeURIComponent(code)}`;
          }}
        />
      </>
    );
  }

  return <RoomGame roomCode={code} />;
}
