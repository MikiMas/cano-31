import { NextResponse } from "next/server";
import { requireAdminPassword } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { seedChallenges } from "@/lib/seedChallenges";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as { password?: string } | null;
    const password = typeof body?.password === "string" ? body.password : "";
    if (!password) {
      return NextResponse.json({ ok: false, error: "MISSING_PASSWORD" }, { status: 400 });
    }

    await requireAdminPassword(password);

    const supabase = supabaseAdmin();
    const result = await seedChallenges(supabase);

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 401 });
  }
}
