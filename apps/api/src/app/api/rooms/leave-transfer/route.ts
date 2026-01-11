import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requirePlayerFromSession } from "@/lib/sessionPlayer";

export const runtime = "nodejs";

const BUCKET_RETOS = "retos";
const BUCKET_CHALLENGE_MEDIA = "challenge-media";

type PlayerRow = { id: string; created_at?: string | null };

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
  try {
    const authed = await requirePlayerFromSession(req);
    const playerId = authed.player.id;
    const playerNickname = authed.player.nickname;

    const supabase = supabaseAdmin();

    const { data: member } = await supabase
      .from("room_members")
      .select("room_id,role")
      .eq("player_id", playerId)
      .maybeSingle<{ room_id: string; role: string }>();

    if (!member?.room_id) return NextResponse.json({ ok: false, error: "ROOM_NOT_FOUND" }, { status: 404 });
    if (member.role !== "owner") return NextResponse.json({ ok: false, error: "NOT_ALLOWED" }, { status: 403 });

    const roomId = member.room_id;

    const { data: players } = await supabase
      .from("players")
      .select("id,created_at")
      .eq("room_id", roomId)
      .order("created_at", { ascending: true })
      .returns<PlayerRow[]>();

    const nextOwner = (players ?? []).find((p) => p.id !== playerId) ?? null;

    // If no one else is in the room, close it completely.
    if (!nextOwner) {
      // Remove all room media (only owner exists).
      const { data: pcs } = await supabase
        .from("player_challenges")
        .select("player_id,media_path,media_url")
        .eq("player_id", playerId)
        .returns<{ player_id: string; media_path: string | null; media_url: string | null }[]>();

      const retosPaths: string[] = [];
      const challengeMediaPaths: string[] = [];

      for (const pc of pcs ?? []) {
        if (pc.media_path) challengeMediaPaths.push(pc.media_path);
        if (pc.media_url) {
          const p = pathFromPublicStorageUrl(pc.media_url, BUCKET_RETOS);
          if (p) retosPaths.push(p);
        }
      }

      if (retosPaths.length) await supabase.storage.from(BUCKET_RETOS).remove(retosPaths);
      if (challengeMediaPaths.length) await supabase.storage.from(BUCKET_CHALLENGE_MEDIA).remove(challengeMediaPaths);

      await supabase.from("player_challenges").delete().eq("player_id", playerId);
      await supabase.from("room_members").delete().eq("room_id", roomId);
      await supabase.from("players").delete().eq("id", playerId);
      await supabase.from("room_settings").delete().eq("room_id", roomId);
      await supabase.from("rooms").delete().eq("id", roomId);

      return NextResponse.json({ ok: true, closed: true });
    }

    // Remove owner's uploaded media.
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

    if (retosPaths.length) await supabase.storage.from(BUCKET_RETOS).remove(retosPaths);
    if (challengeMediaPaths.length) await supabase.storage.from(BUCKET_CHALLENGE_MEDIA).remove(challengeMediaPaths);

    // Transfer leadership.
    await supabase.from("room_members").update({ role: "member" }).eq("room_id", roomId).eq("player_id", playerId);
    await supabase.from("room_members").update({ role: "owner" }).eq("room_id", roomId).eq("player_id", nextOwner.id);
    await supabase.from("rooms").update({ created_by_player_id: nextOwner.id }).eq("id", roomId);

    // Delete owner's room data and membership (keep device identity).
    await supabase.from("player_challenges").delete().eq("player_id", playerId);
    await supabase.from("room_members").delete().eq("room_id", roomId).eq("player_id", playerId);
    await supabase.from("players").update({ room_id: null, points: 0, nickname: playerNickname }).eq("id", playerId);

    return NextResponse.json({ ok: true, newOwnerId: nextOwner.id });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "UNAUTHORIZED";
    const status = msg === "UNAUTHORIZED" ? 401 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
