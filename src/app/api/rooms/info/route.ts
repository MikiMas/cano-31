import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { validateRoomCode } from "@/lib/validators";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code")?.toUpperCase();
  if (!validateRoomCode(code)) return NextResponse.json({ ok: false, error: "INVALID_ROOM_CODE" }, { status: 400 });

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("rooms")
    .select("id,code,starts_at,ends_at,status,rounds,name")
    .eq("code", code)
    .maybeSingle();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ ok: false, error: "ROOM_NOT_FOUND" }, { status: 404 });
  return NextResponse.json({ ok: true, room: data });
}
