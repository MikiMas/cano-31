import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { readSessionTokenFromRequest } from "@/lib/validators";
import { getBlockStartUTC, secondsToNextBlock } from "@/lib/timeBlock";

export const runtime = "nodejs";

type AdminSettingsRow = { game_status: string | null };
type SessionRow = { player_id: string; session_token: string };
type AssignedChallengeRow = {
  player_challenge_id: string;
  title: string;
  description: string;
  completed: boolean;
};

export async function GET(req: Request) {
  const sessionToken = readSessionTokenFromRequest(req);
  if (!sessionToken) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const supabase = supabaseAdmin();

  const { data: session, error: sessionError } = await supabase
    .from("player_sessions")
    .select("player_id,session_token")
    .eq("session_token", sessionToken)
    .maybeSingle<SessionRow>();

  if (sessionError) {
    return NextResponse.json({ ok: false, error: sessionError.message }, { status: 500 });
  }
  if (!session) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const now = new Date();
  const blockStart = getBlockStartUTC(now);
  const nextBlockInSec = secondsToNextBlock(now);

  const { data: settings, error: settingsError } = await supabase
    .from("admin_settings")
    .select("game_status")
    .eq("id", true)
    .maybeSingle<AdminSettingsRow>();

  if (settingsError) {
    return NextResponse.json({ ok: false, error: settingsError.message }, { status: 500 });
  }

  if ((settings?.game_status ?? "").toLowerCase() === "paused") {
    return NextResponse.json({
      paused: true,
      nextBlockInSec,
      blockStart: blockStart.toISOString()
    });
  }

  const { data: assigned, error: assignError } = await supabase.rpc("assign_challenges_for_block", {
    p_player_id: session.player_id,
    p_block_start: blockStart.toISOString()
  }) as { data: AssignedChallengeRow[] | null; error: { message: string } | null };

  if (assignError) {
    const msg = assignError.message || "RPC_FAILED";
    if (msg.toLowerCase().includes("assign_challenges_for_block")) {
      return NextResponse.json(
        {
          ok: false,
          error: "MISSING_RPC_ASSIGN_CHALLENGES",
          hint: "Ejecuta scripts/sql/assign_challenges_for_block.sql en Supabase (SQL Editor)."
        },
        { status: 500 }
      );
    }
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }

  await supabase
    .from("player_sessions")
    .update({ last_seen_at: now.toISOString() })
    .eq("session_token", sessionToken);

  const ids = (assigned ?? []).map((c) => c.player_challenge_id);
  const { data: mediaRows } =
    ids.length === 0
      ? { data: [] as { id: string; media_path: string | null }[] }
      : await supabase.from("player_challenges").select("id,media_path").in("id", ids);
  const hasMediaById = new Map((mediaRows ?? []).map((r: any) => [String(r.id), Boolean(r.media_path)]));

  return NextResponse.json({
    paused: false,
    blockStart: blockStart.toISOString(),
    nextBlockInSec,
    challenges: (assigned ?? []).map((c) => ({
      id: c.player_challenge_id,
      title: c.title,
      description: c.description,
      completed: c.completed,
      hasMedia: hasMediaById.get(c.player_challenge_id) ?? false
    }))
  });
}
