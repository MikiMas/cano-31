import { View } from "react-native";
import { Card } from "../ui/Card";
import { Pill } from "../ui/Pill";
import { H2, Label, Muted, Title } from "../ui/Text";
import { theme } from "../ui/theme";
import type { Player } from "./roomTypes";

export function WaitingMemberScreen({
  roomCode,
  ownerNickname,
  players
}: {
  roomCode: string;
  ownerNickname: string;
  players: Player[];
}) {
  return (
    <Card>
      <View style={{ alignItems: "center", gap: 6 }}>
        <Muted style={{ color: theme.colors.muted }}>Codigo de sala</Muted>
        <Title style={{ fontSize: 44, letterSpacing: 4 }}>{roomCode}</Title>
      </View>
      <View style={{ height: 12 }} />
      <H2>Sala</H2>
      <View style={{ height: 8 }} />
      <Muted>Estas en la sala de espera.</Muted>

      <View style={{ marginTop: 12 }}>
        <Pill>
          <Muted style={{ color: theme.colors.text, fontWeight: "900" }}>Admin</Muted>
          <Muted>{ownerNickname || "-"}</Muted>
        </Pill>
      </View>

      <View
        style={{
          marginTop: 12,
          gap: 8,
          padding: 12,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: "rgba(0,0,0,0.18)",
          backgroundColor: "rgba(255,255,255,0.06)"
        }}
      >
        <Label>Jugadores ({players.length})</Label>
        {players.length === 0 ? (
          <Muted>Aun no ha entrado nadie.</Muted>
        ) : (
          <View style={{ gap: 8 }}>
            {players.map((p) => (
              <Pill key={p.id} style={{ justifyContent: "space-between", width: "100%" }}>
                <Muted style={{ color: theme.colors.text, fontWeight: "900" }}>{p.nickname}</Muted>
              </Pill>
            ))}
          </View>
        )}
      </View>
    </Card>
  );
}

