import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { validateNickname, validateRoomCode } from "@/lib/validators";

export const runtime = "nodejs";

type JoinBody = { code?: unknown; nickname?: unknown };
type RoomRow = { id: string; code: string; starts_at: string; ends_at: string };
type PlayerRow = { id: string; nickname: string; points: number };

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as JoinBody | null;
  const nick = validateNickname(body?.nickname);
  if (!nick.ok) return NextResponse.json({ ok: false, error: nick.error }, { status: 400 });

  const code = body?.code;
  if (!validateRoomCode(code)) return NextResponse.json({ ok: false, error: "INVALID_ROOM_CODE" }, { status: 400 });

  const supabase = supabaseAdmin();
  const { data: room, error: roomError } = await supabase.from("rooms").select("id,code,starts_at,ends_at").eq("code", code).maybeSingle<RoomRow>();
  if (roomError) return NextResponse.json({ ok: false, error: roomError.message }, { status: 500 });
  if (!room) return NextResponse.json({ ok: false, error: "ROOM_NOT_FOUND" }, { status: 404 });

  const { data: player, error: playerError } = await supabase
    .from("players")
    .insert({ room_id: room.id, nickname: nick.nickname, points: 0 })
    .select("id,nickname,points")
    .single<PlayerRow>();

  if (playerError) {
    const pgCode = (playerError as any).code as string | undefined;
    if (pgCode === "23505") return NextResponse.json({ ok: false, error: "NICKNAME_TAKEN" }, { status: 409 });
    return NextResponse.json({ ok: false, error: playerError.message }, { status: 500 });
  }

  await supabase.from("room_members").insert({ room_id: room.id, player_id: player.id, role: "member" });

  const sessionToken = crypto.randomUUID();
  const now = new Date().toISOString();
  await supabase.from("player_sessions").insert({
    player_id: player.id,
    session_token: sessionToken,
    created_at: now,
    last_seen_at: now
  });

  const res = NextResponse.json({ ok: true, room: { id: room.id, code: room.code }, sessionToken, player });
  res.cookies.set({
    name: "st",
    value: sessionToken,
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
    secure: process.env.NODE_ENV === "production"
  });
  return res;
}

