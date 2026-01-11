import { useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Modal, Pressable, ScrollView, StatusBar, View, useWindowDimensions } from "react-native";
import { apiFetchJson, getDeviceId, getSessionToken, setSessionToken } from "../lib/api";
import { STORAGE_API_BASE, STORAGE_LAST_ROOM } from "../lib/storage";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Input } from "../ui/Input";
import { Pill } from "../ui/Pill";
import { Screen } from "../ui/Screen";
import { LoadingOverlay } from "../ui/LoadingOverlay";
import { H2, Label, Muted, Title } from "../ui/Text";
import { theme } from "../ui/theme";

function isValidRoomCode(code: string) {
  const v = code.trim();
  if (v.length < 4 || v.length > 10) return false;
  return /^[A-Za-z0-9]+$/.test(v);
}
export function HomeScreen({ navigation }: { navigation: any }) {
  const { width: viewportWidth, height: viewportHeight } = useWindowDimensions();
  const [nickname, setNickname] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [creatingRoom, setCreatingRoom] = useState(false);

  const [apiBaseUrl, setApiBaseUrl] = useState("http://172.17.241.235:3000");
  const [showSettings, setShowSettings] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<null | "create" | "join">(null);

  const [joinOpen, setJoinOpen] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const howToPageWidth = Math.max(280, Math.floor(viewportWidth - 32));
  const howToCardWidth = Math.max(240, howToPageWidth - 28);
  const howToCardHeight = Math.max(220, Math.min(300, Math.floor(viewportHeight * 0.30)));

  useEffect(() => {
    let canceled = false;
    (async () => {
      const storedBase = await AsyncStorage.getItem(STORAGE_API_BASE).catch(() => null);
      const storedRoom = await AsyncStorage.getItem(STORAGE_LAST_ROOM).catch(() => null);
      const deviceId = await getDeviceId();
      if (canceled) return;
      if (typeof storedBase === "string" && storedBase.trim()) setApiBaseUrl(storedBase);
      if (typeof storedRoom === "string" && storedRoom.trim() && deviceId) {
        const base = (storedBase && storedBase.trim()) ? storedBase.trim() : apiBaseUrl.trim();
        if (base) {
          navigation.reset({
            index: 0,
            routes: [{ name: "Room", params: { apiBaseUrl: base, roomCode: storedRoom.trim() } }]
          });
        }
      }
    })();
    return () => {
      canceled = true;
    };
  }, []);

  const joinUrl = useMemo(() => {
    const base = apiBaseUrl.trim().replace(/\/+$/, "");
    if (!base) return "";
    const code = joinCode.trim();
    if (!isValidRoomCode(code)) return "";
    return `${base}/room/${encodeURIComponent(code)}`;
  }, [apiBaseUrl, joinCode]);

  const ensureDeviceSession = async (nick: string): Promise<boolean> => {
    const base = apiBaseUrl.trim().replace(/\/+$/, "");
    if (!base) {
      setError("Falta configurar el backend.");
      setShowSettings(true);
      setAuthModalOpen(true);
      return false;
    }
    const normalizedNick = nick.trim();
    if (normalizedNick.length < 4) {
      setError("El nickname debe tener entre 4 y 12 caracteres.");
      setAuthModalOpen(true);
      return false;
    }

    const existing = await getSessionToken();
    const deviceId = await getDeviceId();
    const res = await apiFetchJson<any>(base, "/api/device/register", {
      method: "POST",
      auth: false,
      headers: {
        "content-type": "application/json",
        ...(existing ? { "x-session-token": existing } : {})
      },
      body: JSON.stringify({ nickname: normalizedNick, deviceId })
    });
    if (!res.ok) {
      setError(res.error);
      return false;
    }
    if ((res.data as any)?.ok === false) {
      setError((res.data as any)?.error ?? "REQUEST_FAILED");
      return false;
    }
    const st = String((res.data as any)?.sessionToken ?? "");
    if (st) {
      await setSessionToken(st);
    }
    return true;
  };

  const runCreate = async () => {
    setError(null);
    const ok = await ensureDeviceSession(nickname);
    if (!ok) return;
    const base = apiBaseUrl.trim().replace(/\/+$/, "");
    setCreatingRoom(true);
    setLoading(true);
    try {
      const res = await apiFetchJson<any>(base, "/api/rooms/create", {
        method: "POST",
        auth: true,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ rounds: 4 })
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      if ((res.data as any)?.ok === false) {
        setError((res.data as any)?.error ?? "REQUEST_FAILED");
        return;
      }
      const code = (res.data as any)?.room?.code ?? "";
      if (!code) {
        setError("ROOM_CREATE_FAILED");
        return;
      }
      await AsyncStorage.setItem(STORAGE_API_BASE, base).catch(() => {});
      await AsyncStorage.setItem(STORAGE_LAST_ROOM, code).catch(() => {});
      navigation.navigate("Room", { apiBaseUrl: base, roomCode: code });
    } finally {
      setLoading(false);
      setCreatingRoom(false);
    }
  };

  return (
    <Screen>
      <StatusBar barStyle="light-content" />
      <LoadingOverlay
        visible={creatingRoom}
        title="Creando sala…"
        subtitle="Preparando la sala y guardando tu sesión en el dispositivo."
      />
      <View style={{ paddingTop: 10, alignItems: "center" }}>
        <Title
          style={{
            fontSize: 64,
            letterSpacing: 4,
            textShadowColor: "rgba(0,0,0,0.75)",
            textShadowOffset: { width: 0, height: 6 },
            textShadowRadius: 14
          }}
        >
          PIKUDO
        </Title>
      </View>

      <View style={{ marginTop: 22 }}>
        <View
          style={{
            gap: 14,
            padding: 14,
            borderRadius: 18,
            backgroundColor: "rgba(255,255,255,0.12)",
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.18)"
          }}
        >
          <Button
            size="lg"
            disabled={loading}
            onPress={async () => {
              setNickname("");
              setPendingAction("create");
              setAuthModalOpen(true);
            }}
          >
            Crear sala
          </Button>

          <Button
            size="lg"
            variant="secondary"
            disabled={loading}
            onPress={() => {
              setNickname("");
              setPendingAction("join");
              setAuthModalOpen(true);
            }}
          >
            Unirse a sala
          </Button>
        </View>
      </View>

      {error ? <Muted style={{ marginTop: 14, color: theme.colors.danger, textAlign: "center" }}>{error}</Muted> : null}

      <View style={{ marginTop: 18 }}>
        <Card style={{ backgroundColor: theme.colors.card, borderColor: "rgba(0,0,0,0.25)", padding: 0 }}>
        <View style={{ padding: 14, paddingBottom: 8 }}>
        <H2 style={{ textAlign: "center" }}>¿Cómo jugar?</H2>
        <Muted style={{ marginTop: 6, textAlign: "center" }}>Desliza para ver los pasos.</Muted>

        </View>

        <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}>
          {[
            {
              step: "Paso 1",
              title: "Crea o únete a una sala",
              text: "Crea una sala y comparte el código, o únete con el código de un amigo. Cuando estéis dentro, el host empieza la partida."
            },
            {
              step: "Paso 2",
              title: "Retos por rondas (foto o vídeo)",
              text: "En cada ronda te salen retos. Completa uno haciendo una foto o un vídeo desde la app (o eligiéndolo de tu galería) y envíalo: quedará guardado para la sala."
            },
            {
              step: "Paso 3",
              title: "Se envía, se guarda y se ve al final",
              text: "Cada envío suma puntos. Durante la partida verás el ranking y, al terminar, aparece un resumen con las mejores fotos/vídeos y los ganadores."
            }
          ].map((s, idx) => (
            <View key={idx} style={{ width: howToPageWidth, paddingHorizontal: 14, paddingBottom: 14, alignItems: "center" }}>
              <Card style={{ backgroundColor: theme.colors.cardAlt, width: howToCardWidth, height: howToCardHeight }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Pill>
                    <Muted style={{ color: theme.colors.text, fontWeight: "900" }}>{s.step}</Muted>
                  </Pill>
                  <View style={{ flexDirection: "row", gap: 6 }}>
                    {[0, 1, 2].map((d) => (
                      <View
                        key={d}
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 999,
                          backgroundColor: d === idx ? theme.colors.buttonPrimary : "rgba(255,255,255,0.25)",
                          borderWidth: 1,
                          borderColor: "rgba(0,0,0,0.18)"
                        }}
                      />
                    ))}
                  </View>
                </View>

                <View style={{ marginTop: 12, flex: 1 }}>
                  <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false}>
                    <Muted style={{ color: theme.colors.text, fontWeight: "900", fontSize: 16 }}>{s.title}</Muted>
                    <Muted style={{ marginTop: 8 }}>{s.text}</Muted>
                  </ScrollView>
                </View>
              </Card>
            </View>
          ))}
        </ScrollView>
        </Card>
      </View>

      <Modal transparent visible={authModalOpen} animationType="fade" onRequestClose={() => setAuthModalOpen(false)}>
        <Pressable
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)", padding: 16, justifyContent: "center" }}
          onPress={() => setAuthModalOpen(false)}
        >
          <Pressable onPress={() => {}} style={{ width: "100%" }}>
            <Card style={{ backgroundColor: theme.colors.card, borderColor: theme.colors.buttonPrimaryBorder }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <View style={{ gap: 4 }}>
                  <H2 style={{ fontSize: 20 }}>Tu nickname</H2>
                  <Muted style={{ color: theme.colors.muted }}>Solo para esta partida</Muted>
                </View>

                <View style={{ width: 32 }} />

              </View>

              <View style={{ marginTop: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Pill>
                  <Muted style={{ color: theme.colors.text, fontWeight: "900" }}>
                    {pendingAction === "join" ? "Unirse a sala" : "Crear sala"}
                  </Muted>
                </Pill>
                <Muted>4-12 caracteres</Muted>
              </View>

              <View style={{ marginTop: 12, gap: 10 }}>
                <Input
                  value={nickname}
                  onChangeText={setNickname}
                  autoCapitalize="words"
                  autoCorrect={false}
                  maxLength={12}
                  placeholder="Escribe tu nombre"
                  style={{
                    fontSize: 18,
                    paddingVertical: 16,
                    borderRadius: 16,
                    textAlign: "center",
                    borderWidth: 1,
                    borderColor: "rgba(255,255,255,0.16)",
                    backgroundColor: "rgba(255,255,255,0.12)"
                  }}
                />
              </View>

              {!apiBaseUrl.trim() || showSettings ? (
                <View style={{ marginTop: 12, gap: 10 }}>
                  <Label>Backend</Label>
                  <Input
                    value={apiBaseUrl}
                    onChangeText={(v) => {
                      setApiBaseUrl(v);
                      AsyncStorage.setItem(STORAGE_API_BASE, v.trim()).catch(() => {});
                    }}
                    autoCapitalize="none"
                    autoCorrect={false}
                    placeholder="http://localhost:3000"
                  />
                </View>
              ) : null}

              <View style={{ marginTop: 14, gap: 10 }}>
                <Button
                  size="lg"
                  variant="secondary"
                  disabled={nickname.trim().length < 4 || nickname.trim().length > 12}
                  onPress={async () => {
                    setAuthModalOpen(false);
                    const next = pendingAction;
                    setPendingAction(null);
                    if (next === "join") {
                      setJoinOpen(true);
                      setJoinCode("");
                      setError(null);
                      return;
                    }
                    await runCreate();
                  }}
                >
                  Continuar
                </Button>
              </View>
            </Card>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal transparent visible={joinOpen} animationType="fade" onRequestClose={() => setJoinOpen(false)}>
        <Pressable
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)", padding: 16, justifyContent: "center" }}
          onPress={() => setJoinOpen(false)}
        >
          <Pressable
            style={{ borderRadius: 18, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: "rgba(26,28,58,0.95)", padding: 14 }}
            onPress={() => {}}
          >
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <H2>Unirme a sala</H2>
              <Button variant="ghost" fullWidth={false} onPress={() => setJoinOpen(false)}>
                Cerrar
              </Button>
            </View>

            <View style={{ marginTop: 12, gap: 10 }}>
              <Label>Código</Label>
              <Input value={joinCode} onChangeText={setJoinCode} autoCapitalize="characters" autoCorrect={false} placeholder="ABC123" />

              <Button
                disabled={!joinUrl || loading}
                onPress={async () => {
                  setError(null);
                  const base = apiBaseUrl.trim().replace(/\/+$/, "");
                  const code = joinCode.trim();
                  const ok = await ensureDeviceSession(nickname);
                  if (!ok) {
                    setJoinOpen(false);
                    return;
                  }
                  if (!base) return;
                  if (!isValidRoomCode(code)) return;

                  setLoading(true);
                  const joined = await apiFetchJson<any>(base, "/api/rooms/join", {
                    method: "POST",
                    auth: true,
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ code })
                  });
                  setLoading(false);

                  if (!joined.ok) {
                    setError(joined.error);
                    setJoinOpen(false);
                    return;
                  }
                  if ((joined.data as any)?.ok === false) {
                    setError((joined.data as any)?.error ?? "REQUEST_FAILED");
                    setJoinOpen(false);
                    return;
                  }

                  setJoinOpen(false);
                  await AsyncStorage.setItem(STORAGE_API_BASE, base).catch(() => {});
                  await AsyncStorage.setItem(STORAGE_LAST_ROOM, code).catch(() => {});
                  navigation.navigate("Room", { apiBaseUrl: base, roomCode: code });
                }}
              >
                {loading ? "Entrando..." : "Entrar"}
              </Button>
              {joinUrl ? <Muted>URL: {joinUrl}</Muted> : null}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}




