import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { readSessionTokenFromRequest } from "@/lib/validators";

export type AuthedPlayer = { id: string; nickname: string; points: number; room_id: string };

export async function requirePlayerFromSession(req: Request): Promise<{ sessionToken: string; player: AuthedPlayer }> {
  const sessionToken = readSessionTokenFromRequest(req);
  if (!sessionToken) throw new Error("UNAUTHORIZED");

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("player_sessions")
    .select("session_token, players ( id, nickname, points, room_id )")
    .eq("session_token", sessionToken)
    .maybeSingle<{ session_token: string; players: AuthedPlayer | null }>();

  if (error) throw new Error(error.message);
  if (!data?.players) throw new Error("UNAUTHORIZED");

  await supabase
    .from("player_sessions")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("session_token", sessionToken);

  return { sessionToken: data.session_token, player: data.players };
}

