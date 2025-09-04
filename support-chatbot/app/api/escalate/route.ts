import { NextRequest } from "next/server";
import { supabase } from "@/lib/supabaseClient";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { user_query, ai_reply } = body as {
      user_query?: string;
      ai_reply?: string;
    };

    const { data, error } = await supabase
      .from("conversations")
      .insert({
        user_query: user_query || null,
        ai_reply: ai_reply || null,
        escalation_flag: true
      })
      .select()
      .single();

    if (error) throw error;

    return new Response(JSON.stringify({ ok: true, conversation: data }), {
      status: 200,
      headers: { "content-type": "application/json" }
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || "Unknown error" }), {
      status: 500,
      headers: { "content-type": "application/json" }
    });
  }
}

