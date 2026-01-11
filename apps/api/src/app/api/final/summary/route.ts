import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requirePlayerFromSession } from "@/lib/sessionPlayer";

export const runtime = "nodejs";

type RoomRow = { id: string; name: string | null; status: string; starts_at: string; rounds: number | null };
type RoomSettingsRow = { game_started_at: string | null };

type LeaderRow = { id: string; nickname: string; points: number };

async function isRoomEnded(supabase: ReturnType<typeof supabaseAdmin>, roomId: string): Promise<boolean> {
  const now = new Date();
  const { data: room, error: roomError } = await supabase
    .from("rooms")
    .select("id,status,starts_at,rounds")
    .eq("id", roomId)
    .maybeSingle<RoomRow>();
  if (roomError || !room) return false;

  const roomStatus = String((room as any)?.status ?? "").toLowerCase();
  if (roomStatus === "ended") return true;

  const { data: settings } = await supabase
    .from("room_settings")
    .select("game_started_at")
    .eq("room_id", roomId)
    .maybeSingle<RoomSettingsRow>();

  const startedAtIso = ((settings as any)?.game_started_at as string | null) ?? null;
  const startedAtFallback = roomStatus === "running" ? ((room as any)?.starts_at as string | null) ?? null : null;
  const effectiveStartedAtIso = startedAtIso ?? startedAtFallback;
  if (!effectiveStartedAtIso) return false;

  const startedAt = new Date(effectiveStartedAtIso);
  const rounds = Math.min(10, Math.max(1, Math.floor((room as any).rounds ?? 1)));
  const endsAt = new Date(startedAt.getTime() + rounds * 30 * 60 * 1000);
  return now.getTime() >= endsAt.getTime();
}

export async function GET(req: Request) {
  const supabase = supabaseAdmin();
  let roomId = "";
  try {
    const { player } = await requirePlayerFromSession(req);
    roomId = player.room_id;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "UNAUTHORIZED";
    return NextResponse.json({ ok: false, error: msg }, { status: msg === "UNAUTHORIZED" ? 401 : 500 });
  }

  const ended = await isRoomEnded(supabase, roomId);
  if (!ended) return NextResponse.json({ ok: false, error: "GAME_NOT_ENDED" }, { status: 400 });

  const { data: room } = await supabase.from("rooms").select("name").eq("id", roomId).maybeSingle<{ name: string | null }>();

  const { data: leaders, error } = await supabase
    .from("players")
    .select("id,nickname,points")
    .eq("room_id", roomId)
    .order("points", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(50)
    .returns<LeaderRow[]>();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, roomName: room?.name ?? null, leaders: leaders ?? [] });
}

