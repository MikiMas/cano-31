import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { readSessionTokenFromRequest, validateUuid } from "@/lib/validators";

export const runtime = "nodejs";

const BUCKET = "challenge-media";

type SessionRow = { player_id: string };
type PlayerChallengeRow = { id: string; player_id: string; media_path: string | null; media_mime: string | null };

export async function GET(req: Request) {
  const sessionToken = readSessionTokenFromRequest(req);
  if (!sessionToken) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

  const url = new URL(req.url);
  const playerChallengeId = url.searchParams.get("playerChallengeId");
  if (!validateUuid(playerChallengeId)) {
    return NextResponse.json({ ok: false, error: "INVALID_PLAYER_CHALLENGE_ID" }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  const { data: session, error: sessionError } = await supabase
    .from("player_sessions")
    .select("player_id")
    .eq("session_token", sessionToken)
    .maybeSingle<SessionRow>();

  if (sessionError) return NextResponse.json({ ok: false, error: sessionError.message }, { status: 500 });
  if (!session) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

  const { data: pc, error: pcError } = await supabase
    .from("player_challenges")
    .select("id,player_id,media_path,media_mime")
    .eq("id", playerChallengeId.trim())
    .maybeSingle<PlayerChallengeRow>();

  if (pcError) return NextResponse.json({ ok: false, error: pcError.message }, { status: 500 });
  if (!pc || pc.player_id !== session.player_id) return NextResponse.json({ ok: false, error: "NOT_ALLOWED" }, { status: 403 });
  if (!pc.media_path) return NextResponse.json({ ok: false, error: "NO_MEDIA" }, { status: 404 });

  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(pc.media_path, 60 * 10);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, url: data.signedUrl, mime: pc.media_mime });
}

