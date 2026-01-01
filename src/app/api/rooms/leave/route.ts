import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requirePlayerFromSession } from "@/lib/sessionPlayer";

export const runtime = "nodejs";

const BUCKET_RETOS = "retos";
const BUCKET_CHALLENGE_MEDIA = "challenge-media";

function pathFromPublicStorageUrl(url: string, bucket: string): string | null {
  try {
    const u = new URL(url);
    const markerPublic = `/storage/v1/object/public/${bucket}/`;
    const markerSign = `/storage/v1/object/sign/${bucket}/`;
    const idxPublic = u.pathname.indexOf(markerPublic);
    if (idxPublic !== -1) return decodeURIComponent(u.pathname.slice(idxPublic + markerPublic.length));
    const idxSign = u.pathname.indexOf(markerSign);
    if (idxSign !== -1) {
      const rest = u.pathname.slice(idxSign + markerSign.length);
      const withoutLeading = rest.startsWith("/") ? rest.slice(1) : rest;
      const nextSlash = withoutLeading.indexOf("/");
      return decodeURIComponent(nextSlash === -1 ? withoutLeading : withoutLeading.slice(nextSlash + 1));
    }
    return null;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  let playerId = "";

  try {
    const authed = await requirePlayerFromSession(req);
    playerId = authed.player.id;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "UNAUTHORIZED";
    const status = msg === "UNAUTHORIZED" ? 401 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }

  const supabase = supabaseAdmin();

  const { data: pcs } = await supabase
    .from("player_challenges")
    .select("media_path,media_url")
    .eq("player_id", playerId)
    .returns<{ media_path: string | null; media_url: string | null }[]>();

  const retosPaths: string[] = [];
  const challengeMediaPaths: string[] = [];

  for (const pc of pcs ?? []) {
    if (pc.media_path) challengeMediaPaths.push(pc.media_path);
    if (pc.media_url) {
      const p = pathFromPublicStorageUrl(pc.media_url, BUCKET_RETOS);
      if (p) retosPaths.push(p);
    }
  }

  if (retosPaths.length) {
    await supabase.storage.from(BUCKET_RETOS).remove(retosPaths);
  }
  if (challengeMediaPaths.length) {
    await supabase.storage.from(BUCKET_CHALLENGE_MEDIA).remove(challengeMediaPaths);
  }

  await supabase.from("player_challenges").delete().eq("player_id", playerId);
  await supabase.from("player_sessions").delete().eq("player_id", playerId);
  await supabase.from("room_members").delete().eq("player_id", playerId);
  await supabase.from("players").delete().eq("id", playerId);

  return NextResponse.json({ ok: true });
}

