import { NextRequest } from "next/server";
import { supabase } from "@/lib/supabaseClient";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const orderId = params.id;
  const { data, error } = await supabase
    .from("orders")
    .select("order_id,status,expected_delivery,delivered_on,items,created_at")
    .eq("order_id", orderId)
    .maybeSingle();

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "content-type": "application/json" }
    });
  }

  if (!data) {
    return new Response(JSON.stringify({ error: "Order not found" }), {
      status: 404,
      headers: { "content-type": "application/json" }
    });
  }

  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "content-type": "application/json" }
  });
}

