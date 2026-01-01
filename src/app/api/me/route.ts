import { NextResponse } from "next/server";
import { requirePlayerFromSession } from "@/lib/sessionPlayer";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const { sessionToken, player } = await requirePlayerFromSession(req);
    return NextResponse.json({ player, sessionToken });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "UNAUTHORIZED";
    const status = msg === "UNAUTHORIZED" ? 401 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
