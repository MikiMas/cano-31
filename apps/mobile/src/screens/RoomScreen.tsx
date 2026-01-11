import { useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Modal, Pressable, Share, StatusBar, View } from "react-native";
import { apiFetchJson, clearSessionToken } from "../lib/api";
import { STORAGE_LAST_ROOM, STORAGE_ROUNDS } from "../lib/storage";
import { FinalScreen } from "./FinalScreen";
import { GameScreen } from "./GameScreen";
import { WaitingMemberScreen } from "./WaitingMemberScreen";
import { WaitingOwnerScreen } from "./WaitingOwnerScreen";
import { Button } from "../ui/Button";
import { Screen } from "../ui/Screen";
import { H2, Muted } from "../ui/Text";
import { theme } from "../ui/theme";
import type { Challenge, Leader, Player, RoomState } from "./roomTypes";
export function RoomScreen({ route, navigation }: { route: any; navigation: any }) {
  const { apiBaseUrl, roomCode } = route.params as { apiBaseUrl: string; roomCode: string };
  const [rounds, setRounds] = useState<number>(4);
  const [draftRounds, setDraftRounds] = useState<number>(4);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<"owner" | "member">("member");
  const [ownerNickname, setOwnerNickname] = useState<string>("");
  const [state, setState] = useState<RoomState>("scheduled");
  const [nextBlockInSec, setNextBlockInSec] = useState<number>(0);
  const [players, setPlayers] = useState<Player[]>([]);
  const [player, setPlayer] = useState<Player | null>(null);
  const [roomStartsAt, setRoomStartsAt] = useState<string | null>(null);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [leaders, setLeaders] = useState<Leader[]>([]);
  const [uploadingById, setUploadingById] = useState<Record<string, boolean>>({});
  const [uploadErrorById, setUploadErrorById] = useState<Record<string, string | null>>({});
  const [shouldShowFinal, setShouldShowFinal] = useState(false);
  const [exitOpen, setExitOpen] = useState(false);
  const [exitStep, setExitStep] = useState<"menu" | "confirm_end" | "confirm_close" | "confirm_transfer" | "confirm_leave">("menu");
  const [exitError, setExitError] = useState<string | null>(null);
  const [exiting, setExiting] = useState(false);
  const [allowExit, setAllowExit] = useState(false);
  const [finalLeaveRequested, setFinalLeaveRequested] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const pollingRef = useRef(false);
  const startedRef = useRef(false);
  const POLL_MS = 15000;

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_ROUNDS)
      .then((v) => {
        const n = Number(v ?? "");
        if (Number.isFinite(n) && n >= 1 && n <= 10) setDraftRounds(Math.floor(n));
      })
      .catch(() => {});
  }, []);

  const refreshAll = async () => {
    setRefreshing(true);
    setError(null);
    try {
      const me = await apiFetchJson<any>(apiBaseUrl, "/api/rooms/me", { method: "GET" });
      if (me.ok && (me.data as any)?.ok !== false) {
        setRole(((me.data as any)?.role ?? "member") === "owner" ? "owner" : "member");
        const nextPlayer = (me.data as any)?.player ?? null;
        if (nextPlayer?.id) setPlayer(nextPlayer as Player);
      }

      const info = await apiFetchJson<any>(apiBaseUrl, `/api/rooms/info?code=${encodeURIComponent(roomCode)}`, { method: "GET" });
      if (info.ok && (info.data as any)?.ok !== false) {
        const roomStatus = String((info.data as any)?.room?.status ?? "").toLowerCase();
        if (roomStatus === "ended") {
          setState("ended");
        } else if (roomStatus === "running") {
          startedRef.current = true;
          setState("running");
        } else if (roomStatus === "scheduled" && !startedRef.current) {
          setState("scheduled");
        }
        const nextRounds = Number((info.data as any)?.room?.rounds ?? NaN);
        const nextStartsAt = (info.data as any)?.room?.starts_at ?? null;
        if (typeof nextStartsAt === "string") setRoomStartsAt(nextStartsAt);
        if (Number.isFinite(nextRounds) && nextRounds >= 1 && nextRounds <= 10) {
          setRounds(Math.floor(nextRounds));
        }
      }
      const ps = await apiFetchJson<any>(apiBaseUrl, `/api/rooms/players?code=${encodeURIComponent(roomCode)}`, { method: "GET", auth: false });
      if (ps.ok && (ps.data as any)?.ok !== false) setPlayers(((ps.data as any)?.players ?? []) as any);

      const ch = await apiFetchJson<any>(apiBaseUrl, "/api/challenges", { method: "GET" });
      if (!ch.ok) throw new Error(ch.error);
      const data: any = ch.data as any;
      if (data?.ok === false) throw new Error(data?.error ?? "REQUEST_FAILED");
      const s = String(data?.state ?? "running") as any;
      if (s === "ended") {
        setState("ended");
      } else if (s === "scheduled" && !startedRef.current) {
        setState("scheduled");
      } else {
        startedRef.current = true;
        setState("running");
      }
      setNextBlockInSec(Number(data?.nextBlockInSec ?? 0) || 0);
      setChallenges((data?.challenges ?? []) as any);

      const lb = await apiFetchJson<any>(apiBaseUrl, "/api/leaderboard", { method: "GET" });
      if (lb.ok && (lb.data as any)?.ok !== false) setLeaders(((lb.data as any)?.leaders ?? []) as any);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "REQUEST_FAILED";
      setError(msg);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    let canceled = false;
    setError(null);
    const loadInfo = async () => {
      const res = await apiFetchJson<any>(apiBaseUrl, `/api/rooms/info?code=${encodeURIComponent(roomCode)}`, {
        method: "GET"
      });
      if (canceled) return;
      if (!res.ok) {
        setError(res.error);
        return;
      }
      if ((res.data as any)?.ok === false) {
        setError((res.data as any)?.error ?? "REQUEST_FAILED");
        return;
      }
      const roomStatus = String((res.data as any)?.room?.status ?? "").toLowerCase();
      if (roomStatus === "ended") {
        setState("ended");
      } else if (roomStatus === "running") {
        startedRef.current = true;
        setState("running");
      } else if (roomStatus === "scheduled" && !startedRef.current) {
        setState("scheduled");
      }
      const nextRounds = Number((res.data as any)?.room?.rounds ?? NaN);
      const nextStartsAt = (res.data as any)?.room?.starts_at ?? null;
      if (typeof nextStartsAt === "string") setRoomStartsAt(nextStartsAt);
      if (Number.isFinite(nextRounds) && nextRounds >= 1 && nextRounds <= 10) {
        setRounds(Math.floor(nextRounds));
        if (!(Number.isFinite(draftRounds) && draftRounds >= 1 && draftRounds <= 10)) setDraftRounds(Math.floor(nextRounds));
      }
    };

    const loadMe = async () => {
      const res = await apiFetchJson<any>(apiBaseUrl, "/api/rooms/me", { method: "GET" });
      if (canceled) return;
      if (!res.ok) return;
      const data: any = res.data as any;
      if (data?.ok === false) return;
      setRole((data?.role ?? "member") === "owner" ? "owner" : "member");
      if (data?.player?.id) setPlayer(data.player as Player);
    };

    const loadPlayers = async () => {
      const res = await apiFetchJson<any>(apiBaseUrl, `/api/rooms/players?code=${encodeURIComponent(roomCode)}`, {
        method: "GET",
        auth: false
      });
      if (canceled) return;
      if (!res.ok) return;
      if ((res.data as any)?.ok === false) return;
      setPlayers(((res.data as any)?.players ?? []) as any);
    };

    const loadOwner = async () => {
      const res = await apiFetchJson<any>(apiBaseUrl, `/api/rooms/owner?code=${encodeURIComponent(roomCode)}`, {
        method: "GET",
        auth: false
      });
      if (canceled) return;
      if (!res.ok) return;
      const data: any = res.data as any;
      if (data?.ok === false) return;
      setOwnerNickname(String(data?.owner?.nickname ?? ""));
    };

    const loadChallenges = async () => {
      const res = await apiFetchJson<any>(apiBaseUrl, "/api/challenges", { method: "GET" });
      if (canceled) return;
      if (!res.ok) {
        if (res.status === 401) {
          setError("UNAUTHORIZED");
        } else {
          setError(res.error);
        }
        return;
      }
      const data: any = res.data as any;
      const s = String(data?.state ?? "scheduled") as any;
      if (s === "ended") {
        setState("ended");
      } else if (s === "scheduled" && !startedRef.current) {
        setState("scheduled");
      } else {
        startedRef.current = true;
        setState("running");
      }
      setNextBlockInSec(Number(data?.nextBlockInSec ?? 0) || 0);
      setChallenges((data?.challenges ?? []) as any);
    };

    const loadLeaders = async () => {
      const res = await apiFetchJson<any>(apiBaseUrl, "/api/leaderboard", { method: "GET" });
      if (canceled) return;
      if (!res.ok) return;
      const data: any = res.data as any;
      if (data?.ok === false) return;
      setLeaders((data?.leaders ?? []) as any);
    };

    setLoading(true);
    Promise.all([loadInfo(), loadMe(), loadPlayers(), loadOwner(), loadChallenges(), loadLeaders()])
      .catch(() => {})
      .finally(() => {
        if (canceled) return;
        setLoading(false);
      });

    const poll = async () => {
      if (pollingRef.current) return;
      pollingRef.current = true;
      try {
        const tasks: Promise<void>[] = [loadChallenges(), loadLeaders()];
        if (state === "scheduled") {
          tasks.push(loadPlayers(), loadOwner(), loadInfo());
        }
        await Promise.all(tasks);
      } finally {
        pollingRef.current = false;
      }
    };

    const id = setInterval(() => {
      poll().catch(() => {});
    }, POLL_MS);

    return () => {
      clearInterval(id);
      canceled = true;
    };
  }, [apiBaseUrl, roomCode, state]);

  useEffect(() => {
    if (state !== "ended") return;
    setShouldShowFinal(true);
  }, [state]);

  useEffect(() => {
    if (state === "scheduled" || state === "ended") return;
    const id = setInterval(() => setNextBlockInSec((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [state]);

  useEffect(() => {
    const sub = navigation.addListener("beforeRemove", (e: any) => {
      if (allowExit || finalLeaveRequested) return;
      e.preventDefault();
      setExitError(null);
      setExitOpen(true);
      setExitStep("menu");
    });
    return sub;
  }, [navigation, allowExit, finalLeaveRequested]);

  const handleDecRounds = () => {
    const next = Math.max(1, draftRounds - 1);
    setDraftRounds(next);
    AsyncStorage.setItem(STORAGE_ROUNDS, String(next)).catch(() => {});
  };

  const handleIncRounds = () => {
    const next = Math.min(10, draftRounds + 1);
    setDraftRounds(next);
    AsyncStorage.setItem(STORAGE_ROUNDS, String(next)).catch(() => {});
  };

  const handleInvite = async () => {
    try {
      await Share.share({
        title: `Sala ${roomCode}`.trim(),
        message: `Unete a mi sala: ${roomCode}`
      });
    } catch {
      // ignore
    }
  };

  const handleStart = async () => {
    setError(null);
    if (Number.isFinite(draftRounds) && draftRounds >= 1 && draftRounds <= 10) {
      const rr = await apiFetchJson<any>(apiBaseUrl, "/api/rooms/rounds", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: roomCode, rounds: draftRounds })
      });
      if (!rr.ok) {
        setError(rr.error);
        return;
      }
      if ((rr.data as any)?.ok === false) {
        setError((rr.data as any)?.error ?? "REQUEST_FAILED");
        return;
      }
    }

    const res = await apiFetchJson<any>(apiBaseUrl, "/api/rooms/start", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code: roomCode })
    });
    if (!res.ok) {
      setError(res.error);
      return;
    }
    if ((res.data as any)?.ok === false) {
      setError((res.data as any)?.error ?? "REQUEST_FAILED");
      return;
    }
    startedRef.current = true;
    setState("running");
    await refreshAll();
  };

  const handleRequestClose = () => {
    setExitOpen(true);
    setExitStep("confirm_close");
    setExitError(null);
  };
  if (shouldShowFinal) {
    return (
      <FinalScreen
        apiBaseUrl={apiBaseUrl}
        roomCode={roomCode}
        onLeave={async () => {
          if (finalLeaveRequested) return;
          setFinalLeaveRequested(true);
          try {
            await apiFetchJson<any>(apiBaseUrl, "/api/rooms/leave", { method: "POST" });
          } catch {
            // ignore
          }
          await clearSessionToken();
          await AsyncStorage.removeItem(STORAGE_LAST_ROOM).catch(() => {});
          setShouldShowFinal(false);
          startedRef.current = false;
          setState("scheduled");
          setAllowExit(true);
          navigation.reset({ index: 0, routes: [{ name: "Home" }] });
        }}
      />
    );
  }

  return (
    <Screen>
      <StatusBar barStyle="light-content" />
      {state === "scheduled" ? (
        role === "owner" ? (
          <WaitingOwnerScreen
            roomCode={roomCode}
            draftRounds={draftRounds}
            players={players}
            onDecRounds={handleDecRounds}
            onIncRounds={handleIncRounds}
            onInvite={handleInvite}
            onStart={handleStart}
            onRequestClose={handleRequestClose}
          />
        ) : (
          <WaitingMemberScreen roomCode={roomCode} ownerNickname={ownerNickname} players={players} />
        )
      ) : state !== "ended" ? (
        <GameScreen
          apiBaseUrl={apiBaseUrl}
          state={state}
          loading={loading}
          error={error}
          nextBlockInSec={nextBlockInSec}
          challenges={challenges}
          leaders={leaders}
          player={player}
          totalRounds={rounds}
          roomStartsAt={roomStartsAt}
          uploadingById={uploadingById}
          uploadErrorById={uploadErrorById}
          setUploadingById={setUploadingById}
          setUploadErrorById={setUploadErrorById}
          setChallenges={setChallenges}
          setNextBlockInSec={setNextBlockInSec}
          setState={setState}
          setLeaders={setLeaders}
        />
      ) : null}

      <Modal transparent visible={exitOpen} animationType="fade" onRequestClose={() => setExitOpen(false)}>
        <Pressable
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)", padding: 16, justifyContent: "center" }}
          onPress={() => {
            setExitOpen(false);
            setExitStep("menu");
          }}
        >
          <Pressable
            style={{ borderRadius: 18, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: "rgba(26,28,58,0.95)", padding: 14 }}
            onPress={() => {}}
          >
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <H2>Salir</H2>
              <Button
                variant="ghost"
                onPress={() => {
                  setExitOpen(false);
                  setExitStep("menu");
                }}
              >
                Cerrar
              </Button>
            </View>

            {exitError ? <Muted style={{ marginTop: 12, color: theme.colors.danger }}>{exitError}</Muted> : null}

            {exitStep === "menu" ? (
              <View style={{ marginTop: 12, gap: 10 }}>
                {role === "owner" && state !== "scheduled" && state !== "ended" ? (
                  <Button
                    variant="ghost"
                    onPress={() => {
                      setExitStep("confirm_end");
                      setExitError(null);
                    }}
                  >
                    Finalizar partida
                  </Button>
                ) : null}

                {role === "owner" ? (
                  <Button
                    variant="danger"
                    onPress={() => {
                      setExitStep("confirm_close");
                      setExitError(null);
                    }}
                  >
                    Cerrar sala (borrar todo)
                  </Button>
                ) : null}

                {role === "owner" ? (
                  <Button
                    variant="ghost"
                    onPress={() => {
                      setExitStep("confirm_transfer");
                      setExitError(null);
                    }}
                  >
                    Abandonar (transferir liderazgo)
                  </Button>
                ) : null}

                {role !== "owner" ? (
                  <Button
                    variant="danger"
                    onPress={() => {
                      setExitStep("confirm_leave");
                      setExitError(null);
                    }}
                  >
                    Salir de la sala
                  </Button>
                ) : null}
              </View>
            ) : (
              <View style={{ marginTop: 12, gap: 10 }}>
                <Muted style={{ color: theme.colors.text, fontWeight: "900" }}>
                  {exitStep === "confirm_close"
                    ? "¿Cerrar la sala?"
                    : exitStep === "confirm_end"
                      ? "¿Finalizar la partida?"
                      : exitStep === "confirm_transfer"
                        ? "¿Abandonar y transferir liderazgo?"
                        : "¿Abandonar la partida?"}
                </Muted>
                <Muted>
                  {exitStep === "confirm_close"
                    ? "Esto borrará la información de todos (sesiones, retos y media) y eliminará la sala."
                    : exitStep === "confirm_end"
                      ? "Se marcará la partida como finalizada y el ranking se quedará tal cual."
                    : exitStep === "confirm_transfer"
                      ? "Saldrás y se borrarán tus datos. El siguiente jugador será el líder."
                      : "Saldrás de la sala y se borrarán tus retos y media de esta sala."}
                </Muted>

                <Button
                  variant={exitStep === "confirm_end" ? "ghost" : "danger"}
                  disabled={exiting}
                  onPress={async () => {
                    setExitError(null);
                    setExiting(true);
                    try {
                      if (exitStep === "confirm_close") {
                        const res = await apiFetchJson<any>(apiBaseUrl, "/api/rooms/close", {
                          method: "POST",
                          headers: { "content-type": "application/json" },
                          body: JSON.stringify({ code: roomCode })
                        });
                        if (!res.ok) throw new Error(res.error);
                        if ((res.data as any)?.ok === false) throw new Error((res.data as any)?.error ?? "REQUEST_FAILED");
                      } else if (exitStep === "confirm_end") {
                        const res = await apiFetchJson<any>(apiBaseUrl, "/api/rooms/end", {
                          method: "POST",
                          headers: { "content-type": "application/json" },
                          body: JSON.stringify({ code: roomCode })
                        });
                        if (!res.ok) throw new Error(res.error);
                        if ((res.data as any)?.ok === false) throw new Error((res.data as any)?.error ?? "REQUEST_FAILED");
                        setExitOpen(false);
                        setExitStep("menu");
                        setState("ended");
                        return;
                      } else if (exitStep === "confirm_transfer") {
                        const res = await apiFetchJson<any>(apiBaseUrl, "/api/rooms/leave-transfer", { method: "POST" });
                        if (!res.ok) throw new Error(res.error);
                        if ((res.data as any)?.ok === false) throw new Error((res.data as any)?.error ?? "REQUEST_FAILED");
                      } else {
                        const res = await apiFetchJson<any>(apiBaseUrl, "/api/rooms/leave", { method: "POST" });
                        if (!res.ok) throw new Error(res.error);
                        if ((res.data as any)?.ok === false) throw new Error((res.data as any)?.error ?? "REQUEST_FAILED");
                      }

                      await clearSessionToken();
                      await AsyncStorage.removeItem(STORAGE_LAST_ROOM).catch(() => {});
                      setExitOpen(false);
                      setExitStep("menu");
                      setShouldShowFinal(false);
                      startedRef.current = false;
                      setState("scheduled");
                      setAllowExit(true);
                      navigation.reset({ index: 0, routes: [{ name: "Home" }] });
                    } catch (e) {
                      const msg = e instanceof Error ? e.message : "REQUEST_FAILED";
                      setExitError(msg);
                    } finally {
                      setExiting(false);
                    }
                  }}
                >
                  {exiting ? "Procesando..." : "Sí, continuar"}
                </Button>

                <Button
                  variant="ghost"
                  disabled={exiting}
                  onPress={() => {
                    setExitStep("menu");
                    setExitError(null);
                  }}
                >
                  Volver
                </Button>
              </View>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}
























