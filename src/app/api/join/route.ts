import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { validateNickname } from "@/lib/validators";

export const runtime = "nodejs";

type PlayerRow = { id: string; nickname: string; points: number };

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { nickname?: unknown } | null;
  const nick = validateNickname(body?.nickname);
  if (!nick.ok) {
    return NextResponse.json({ ok: false, error: nick.error }, { status: 400 });
  }

  const supabase = supabaseAdmin();

  const { data: player, error: playerError } = await supabase
    .from("players")
    .insert({ nickname: nick.nickname, points: 0 })
    .select("id,nickname,points")
    .single<PlayerRow>();

  if (playerError) {
    const code = (playerError as any).code as string | undefined;
    if (code === "23505") {
      return NextResponse.json({ ok: false, error: "NICKNAME_TAKEN" }, { status: 409 });
    }
    return NextResponse.json({ ok: false, error: playerError.message }, { status: 500 });
  }

  const sessionToken = crypto.randomUUID();
  const now = new Date().toISOString();

  const { error: sessionError } = await supabase.from("player_sessions").insert({
    player_id: player.id,
    session_token: sessionToken,
    created_at: now,
    last_seen_at: now
  });

  if (sessionError) {
    return NextResponse.json({ ok: false, error: sessionError.message }, { status: 500 });
  }

  const res = NextResponse.json({
    sessionToken,
    player
  });

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

