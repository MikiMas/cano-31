import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdminCookie } from "@/lib/adminSession";

export const runtime = "nodejs";

type AdminSettingsRow = { game_status: string | null };

export async function POST(req: Request) {
  try {
    requireAdminCookie(req);

    const supabase = supabaseAdmin();
    const { data: current, error: readError } = await supabase
      .from("admin_settings")
      .select("game_status")
      .eq("id", true)
      .maybeSingle<AdminSettingsRow>();

    if (readError) return NextResponse.json({ ok: false, error: readError.message }, { status: 500 });

    const status = (current?.game_status ?? "running").toLowerCase();
    const next = status === "paused" ? "running" : "paused";

    const { error: updateError } = await supabase
      .from("admin_settings")
      .update({ game_status: next })
      .eq("id", true);

    if (updateError) return NextResponse.json({ ok: false, error: updateError.message }, { status: 500 });

    return NextResponse.json({ ok: true, gameStatus: next });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const status = message === "UNAUTHORIZED" ? 401 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

