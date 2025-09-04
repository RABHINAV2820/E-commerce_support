import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

async function gptFallback(message: string) {
  const url = process.env.GPT5_API_URL;
  const key = process.env.GPT5_API_KEY;
  const system = "You are ShopMate AI, a helpful and empathetic e-commerce support assistant. Use only database or API results. If unsure, say: 'I couldn’t find that. Would you like to talk to an agent?' Always be polite, concise, empathetic.";
  if (!url || !key) return null;
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({ system, message })
    });
    if (!r.ok) return null;
    const data = await r.json();
    return (data?.reply as string) || null;
  } catch {
    return null;
  }
}

async function tryFaq(query: string) {
  // Try match by question text
  const { data: qMatch } = await supabase
    .from("faq")
    .select("intent,question,answer")
    .ilike("question", `%${query}%`)
    .limit(1)
    .maybeSingle();
  if (qMatch?.answer) return qMatch.answer;

  // Simple intent heuristics
  let intent: string | null = null;
  const q = query.toLowerCase();
  if (/(ship|delivery)/.test(q)) intent = "shipping_policy";
  else if (/(return)/.test(q)) intent = "return_policy";
  else if (/(refund)/.test(q)) intent = "refund_timeline";
  else if (/(cancel)/.test(q)) intent = "cancellation_policy";
  else if (/(payment|pay|upi|card)/.test(q)) intent = "payment_methods";
  else if (/\b(hi|hello|hey)\b/.test(q)) intent = "greeting";
  else if (/(offer|discount|sale)/.test(q)) intent = "offers";

  if (intent) {
    const { data: iMatch } = await supabase
      .from("faq")
      .select("answer")
      .eq("intent", intent)
      .limit(1)
      .maybeSingle();
    if (iMatch?.answer) return iMatch.answer;
  }
  return null;
}

async function tryOrder(query: string) {
  const match = query.match(/\b(\d{5,})\b/);
  const id = match?.[1];
  if (!id) return null;
  const { data } = await supabase
    .from("orders")
    .select("order_id,status,expected_delivery,delivered_on,items")
    .eq("order_id", id)
    .maybeSingle();
  if (!data) return null;
  return `Order ${data.order_id}: ${data.status}. Expected delivery: ${data.expected_delivery ?? "N/A"}. Delivered on: ${data.delivered_on ?? "N/A"}.`;
}

async function tryRefund(query: string) {
  if (!/refund/i.test(query)) return null;
  const match = query.match(/\b(\d{5,})\b/);
  const id = match?.[1];
  if (!id) return "Please provide your order ID to start a refund.";
  const { data, error } = await supabase
    .from("refunds")
    .insert({ order_id: id, reason: "user_requested", status: "pending" })
    .select()
    .single();
  if (error) return `Could not create refund: ${error.message}`;
  return `Refund request created for order ${data.order_id}. Status: ${data.status}.`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { query } = body as { query?: string };
    if (!query) {
      return NextResponse.json({ error: "query is required" }, { status: 400 });
    }

    // Session cookie for conversation state
    const existing = req.cookies.get("chat_session_id")?.value;
    const cookie = existing || crypto.randomUUID();
    const setCookieNeeded = !existing;

    function respond(payload: any, init?: number) {
      const res = NextResponse.json(payload, { status: init ?? 200 });
      if (setCookieNeeded) {
        res.cookies.set("chat_session_id", cookie, { path: "/", maxAge: 60 * 60 * 24 * 30, sameSite: "lax" });
      }
      return res;
    }

    async function getState(): Promise<string | null> {
      const { data } = await supabase
        .from("conversations")
        .select("state")
        .eq("session_id", cookie)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return (data?.state as string) || null;
    }

    async function setState(state: string | null, user_query?: string, ai_reply?: string) {
      await supabase.from("conversations").insert({ session_id: cookie, state, user_query: user_query || null, ai_reply: ai_reply || null });
    }

    function extractOrderId(text: string): string | null {
      const m = text.match(/\b(\d{5,})\b/);
      return m?.[1] || null;
    }

    async function lookupOrder(orderId: string) {
      const { data, error } = await supabase
        .from("orders")
        .select("order_id,status,expected_delivery,delivered_on")
        .eq("order_id", orderId)
        .maybeSingle();
      if (error) throw error;
      return data;
    }

    // 1) FAQ
    const faqAns = await tryFaq(query);
    if (faqAns) {
      await setState(null, query, faqAns);
      return respond({ reply: faqAns, source: "faq" });
    }

    // Escalation keywords (support intent)
    if (/(human support|talk to agent|more support|escalate|support)/i.test(query)) {
      // If user simply says 'support', confirm first; otherwise escalate directly
      if (/\bsupport\b/i.test(query) && !/(human|agent|escalate)/i.test(query)) {
        const msg = "Do I need to connect you with an agent?";
        await setState("awaiting_escalation_confirm", query, msg);
        return respond({ reply: msg, source: "escalation_confirm" });
      }
      const msg = "An agent will connect with you shortly.";
      await supabase.from("conversations").insert({ session_id: cookie, user_query: query, ai_reply: msg, escalation_flag: true, state: null });
      return respond({ reply: msg, source: "escalation" });
    }

    // 2) State machine handling
    const currentState = await getState();
    if (currentState === "awaiting_order_id") {
      const id = extractOrderId(query);
      if (!id) {
        const msg = "Please provide a valid order ID (digits).";
        await setState("awaiting_order_id", query, msg);
        return respond({ reply: msg, source: "order_state" });
      }
      try {
        const order = await lookupOrder(id);
        if (!order) {
          const msg = "I couldn’t find that order. Please re-check your ID or escalate to support.";
          await setState(null, query, msg);
          return respond({ reply: msg, source: "order_not_found" });
        }
        const reply = `Order ${id} is currently ${order.status}. Expected delivery: ${order.expected_delivery ?? "N/A"}.`;
        await setState(null, query, reply);
        return respond({ reply, source: "order_status" });
      } catch (e) {
        const msg = "Our systems are facing issues. Please try again later.";
        await setState(null, query, msg);
        return respond({ reply: msg, source: "error" }, 500);
      }
    }

    if (currentState === "awaiting_escalation_confirm") {
      if (/\b(yes|yep|yeah|please)\b/i.test(query)) {
        const msg = "An agent will connect with you shortly.";
        await supabase.from("conversations").insert({ session_id: cookie, user_query: query, ai_reply: msg, escalation_flag: true, state: null });
        return respond({ reply: msg, source: "escalation_yes" });
      }
      if (/\b(no|nope|not now)\b/i.test(query)) {
        const msg = "Sure. Tell me your query.";
        await setState(null, query, msg);
        return respond({ reply: msg, source: "escalation_no" });
      }
      const msg = "Please reply with yes or no.";
      await setState("awaiting_escalation_confirm", query, msg);
      return respond({ reply: msg, source: "escalation_confirm_repeat" });
    }

    // 3) Detect order tracking intent
    if (/(track|status).*order|order.*(track|status)/i.test(query)) {
      const id = extractOrderId(query);
      if (!id) {
        const msg = "Sure! Please provide your order ID.";
        await setState("awaiting_order_id", query, msg);
        return respond({ reply: msg, source: "order_request_id" });
      }
      try {
        const order = await lookupOrder(id);
        if (!order) {
          const msg = "I couldn’t find that order. Please re-check your ID or escalate to support.";
          await setState(null, query, msg);
          return respond({ reply: msg, source: "order_not_found" });
        }
        const reply = `Order ${id} is currently ${order.status}. Expected delivery: ${order.expected_delivery ?? "N/A"}.`;
        await setState(null, query, reply);
        return respond({ reply, source: "order_status" });
      } catch (e) {
        const msg = "Our systems are facing issues. Please try again later.";
        await setState(null, query, msg);
        return respond({ reply: msg, source: "error" }, 500);
      }
    }

    // 3b) If message looks like an order id on its own, attempt lookup (quality of life)
    const onlyDigits = query.trim();
    if (/^\d{5,}$/.test(onlyDigits)) {
      try {
        const order = await lookupOrder(onlyDigits);
        if (order) {
          const reply = `Order ${onlyDigits} is currently ${order.status}. Expected delivery: ${order.expected_delivery ?? "N/A"}.`;
          await setState(null, query, reply);
          return respond({ reply, source: "order_status" });
        }
      } catch {}
    }

    // 3) Refund flow
    const refundAns = await tryRefund(query);
    if (refundAns) {
      return new Response(
        JSON.stringify({ reply: refundAns, source: "refund" }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    }

    // 4) Fallback
    const ai = await gptFallback(query);
    const reply = ai || "I couldn’t find that. Would you like to talk to an agent?";
    await setState(null, query, reply);
    return respond({ reply, source: ai ? "gpt" : "fallback" });
  } catch (e: any) {
    return NextResponse.json({ reply: "Our systems are facing issues. Please try again later.", error: e?.message || "Unknown error" }, { status: 500 });
  }
}

