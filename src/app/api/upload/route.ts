import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { readSessionTokenFromRequest, validateUuid } from "@/lib/validators";
import { getBlockStartUTC } from "@/lib/timeBlock";

export const runtime = "nodejs";

const BUCKET = "challenge-media";
const MAX_BYTES = 25 * 1024 * 1024;

type SessionRow = { player_id: string };
type PlayerChallengeRow = { id: string; player_id: string; block_start: string };

function extFromMime(mime: string): string {
  if (mime.startsWith("image/")) return mime.split("/")[1] ? `.${mime.split("/")[1]}` : ".jpg";
  if (mime.startsWith("video/")) return mime.split("/")[1] ? `.${mime.split("/")[1]}` : ".mp4";
  return "";
}

export async function POST(req: Request) {
  const sessionToken = readSessionTokenFromRequest(req);
  if (!sessionToken) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

  const supabase = supabaseAdmin();

  const { data: session, error: sessionError } = await supabase
    .from("player_sessions")
    .select("player_id")
    .eq("session_token", sessionToken)
    .maybeSingle<SessionRow>();

  if (sessionError) return NextResponse.json({ ok: false, error: sessionError.message }, { status: 500 });
  if (!session) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ ok: false, error: "INVALID_FORM" }, { status: 400 });

  const playerChallengeId = form.get("playerChallengeId");
  if (!validateUuid(playerChallengeId)) {
    return NextResponse.json({ ok: false, error: "INVALID_PLAYER_CHALLENGE_ID" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "MISSING_FILE" }, { status: 400 });
  }

  const mime = file.type || "application/octet-stream";
  if (!mime.startsWith("image/") && !mime.startsWith("video/")) {
    return NextResponse.json({ ok: false, error: "INVALID_FILE_TYPE" }, { status: 400 });
  }

  const size = file.size;
  if (!Number.isFinite(size) || size <= 0 || size > MAX_BYTES) {
    return NextResponse.json({ ok: false, error: "FILE_TOO_LARGE" }, { status: 400 });
  }

  const blockStart = getBlockStartUTC(new Date()).toISOString();
  const { data: pc, error: pcError } = await supabase
    .from("player_challenges")
    .select("id,player_id,block_start")
    .eq("id", playerChallengeId.trim())
    .maybeSingle<PlayerChallengeRow>();

  if (pcError) return NextResponse.json({ ok: false, error: pcError.message }, { status: 500 });
  if (!pc || pc.player_id !== session.player_id || pc.block_start !== blockStart) {
    return NextResponse.json({ ok: false, error: "NOT_ALLOWED" }, { status: 403 });
  }

  const path = `${session.player_id}/${blockStart}/${pc.id}${extFromMime(mime)}`;
  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, bytes, {
    contentType: mime,
    upsert: true
  });

  if (uploadError) {
    return NextResponse.json(
      { ok: false, error: uploadError.message, hint: `Crea el bucket '${BUCKET}' en Supabase Storage.` },
      { status: 500 }
    );
  }

  const { error: updateError } = await supabase
    .from("player_challenges")
    .update({ media_path: path, media_mime: mime })
    .eq("id", pc.id);

  if (updateError) return NextResponse.json({ ok: false, error: updateError.message }, { status: 500 });

  const { data: signed, error: signError } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 10);
  if (signError) return NextResponse.json({ ok: true, media: { path, mime } });

  return NextResponse.json({ ok: true, media: { path, mime, url: signed.signedUrl } });
}

