import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { readSessionTokenFromRequest, validateUuid } from "@/lib/validators";
import { getBlockStartUTC } from "@/lib/timeBlock";

export const runtime = "nodejs";

type SessionRow = { player_id: string };
type CompleteResultRow = { points: number; completed_now: boolean };

export async function POST(req: Request) {
  const sessionToken = readSessionTokenFromRequest(req);
  if (!sessionToken) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as { playerChallengeId?: unknown } | null;
  const playerChallengeId = body?.playerChallengeId;
  if (!validateUuid(playerChallengeId)) {
    return NextResponse.json({ ok: false, error: "INVALID_PLAYER_CHALLENGE_ID" }, { status: 400 });
  }

  const supabase = supabaseAdmin();

  const { data: session, error: sessionError } = await supabase
    .from("player_sessions")
    .select("player_id")
    .eq("session_token", sessionToken)
    .maybeSingle<SessionRow>();

  if (sessionError) {
    return NextResponse.json({ ok: false, error: sessionError.message }, { status: 500 });
  }
  if (!session) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const blockStart = getBlockStartUTC(new Date());

  const { data, error } = (await supabase.rpc("complete_player_challenge", {
    p_player_id: session.player_id,
    p_player_challenge_id: playerChallengeId.trim(),
    p_block_start: blockStart.toISOString()
  })) as { data: CompleteResultRow[] | null; error: { message: string } | null };

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const row = data?.[0];
  if (!row) {
    return NextResponse.json({ ok: false, error: "COMPLETE_FAILED" }, { status: 500 });
  }

  await supabase
    .from("player_sessions")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("session_token", sessionToken);

  return NextResponse.json({ ok: true, points: row.points, completedNow: row.completed_now });
}

