import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { readSessionTokenFromRequest } from "@/lib/validators";

export const runtime = "nodejs";

type Player = { id: string; nickname: string; points: number };
type SessionRow = { session_token: string; players: Player | null };

export async function GET(req: Request) {
  const sessionToken = readSessionTokenFromRequest(req);
  if (!sessionToken) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const supabase = supabaseAdmin();

  const { data: session, error } = await supabase
    .from("player_sessions")
    .select("session_token, players ( id, nickname, points )")
    .eq("session_token", sessionToken)
    .maybeSingle<SessionRow>();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  if (!session?.players) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  await supabase
    .from("player_sessions")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("session_token", sessionToken);

  return NextResponse.json({ player: session.players, sessionToken: session.session_token });
}

