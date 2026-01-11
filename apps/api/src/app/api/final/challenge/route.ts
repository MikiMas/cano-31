import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requirePlayerFromSession } from "@/lib/sessionPlayer";
import { validateUuid } from "@/lib/validators";

export const runtime = "nodejs";

type RoomRow = { id: string; status: string; starts_at: string; rounds: number | null };
type RoomSettingsRow = { game_started_at: string | null };

type ChallengeInfoRow = { id: string; title: string; description: string | null };
type MediaRow = {
  id: string;
  media_url: string | null;
  media_type: string | null;
  media_mime: string | null;
  completed_at: string | null;
  players: { id: string; nickname: string } | null;
};

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
  const url = new URL(req.url);
  const challengeId = url.searchParams.get("challengeId");
  if (!validateUuid(challengeId)) return NextResponse.json({ ok: false, error: "INVALID_CHALLENGE_ID" }, { status: 400 });

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

  const { data: players, error: playersError } = await supabase
    .from("players")
    .select("id")
    .eq("room_id", roomId)
    .limit(200);
  if (playersError) return NextResponse.json({ ok: false, error: playersError.message }, { status: 500 });
  const ids = (players ?? []).map((p: any) => String(p.id));
  if (ids.length === 0) return NextResponse.json({ ok: true, challenge: null, media: [] });

  const { data: challenge, error: challengeError } = await supabase
    .from("challenges")
    .select("id,title,description")
    .eq("id", challengeId!.trim())
    .maybeSingle<ChallengeInfoRow>();
  if (challengeError) return NextResponse.json({ ok: false, error: challengeError.message }, { status: 500 });
  if (!challenge) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });

  const { data: rows, error: rowsError } = await supabase
    .from("player_challenges")
    .select("id,media_url,media_type,media_mime,completed_at, players ( id, nickname )")
    .eq("challenge_id", challengeId!.trim())
    .in("player_id", ids)
    .not("media_url", "is", null)
    .order("completed_at", { ascending: false })
    .limit(4000)
    .returns<MediaRow[]>();
  if (rowsError) return NextResponse.json({ ok: false, error: rowsError.message }, { status: 500 });

  const media = (rows ?? []).map((r) => ({
    id: r.id,
    completedAt: r.completed_at,
    player: r.players ? { id: r.players.id, nickname: r.players.nickname } : null,
    media: r.media_url ? { url: r.media_url, mime: r.media_mime ?? "", type: r.media_type ?? "" } : null
  }));

  return NextResponse.json({ ok: true, challenge: { id: challenge.id, title: challenge.title, description: challenge.description }, media });
}
