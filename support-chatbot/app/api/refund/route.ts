import { NextRequest } from "next/server";
import { supabase } from "@/lib/supabaseClient";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { order_id, reason } = body as { order_id?: string; reason?: string };
    if (!order_id) {
      return new Response(JSON.stringify({ error: "order_id is required" }), {
        status: 400,
        headers: { "content-type": "application/json" }
      });
    }

    // Check if order exists
    const { data: orderExists } = await supabase
      .from("orders")
      .select("order_id")
      .eq("order_id", order_id)
      .maybeSingle();
    if (!orderExists) {
      return new Response(
        JSON.stringify({ error: "This order ID doesn’t exist. Please re-check or escalate." }),
        { status: 404, headers: { "content-type": "application/json" } }
      );
    }

    // Check duplicate refund
    const { data: existingRefund } = await supabase
      .from("refunds")
      .select("refund_id,status")
      .eq("order_id", order_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existingRefund) {
      return new Response(
        JSON.stringify({ ok: true, message: "Refund has already been initiated.", refund: existingRefund }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    }

    const { data, error } = await supabase
      .from("refunds")
      .insert({ order_id, reason: reason || null, status: "pending" })
      .select()
      .single();

    if (error) throw error;

    return new Response(JSON.stringify({ ok: true, refund: data }), {
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

