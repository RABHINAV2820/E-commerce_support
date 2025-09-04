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

    // Thread ID for grouping conversation messages
    const threadId = req.cookies.get("chat_thread_id")?.value || crypto.randomUUID();
    const setThreadCookieNeeded = !req.cookies.get("chat_thread_id")?.value;

    function respond(payload: any, init?: number) {
      const res = NextResponse.json(payload, { status: init ?? 200 });
      if (setCookieNeeded) {
        res.cookies.set("chat_session_id", cookie, { path: "/", maxAge: 60 * 60 * 24 * 30, sameSite: "lax" });
      }
      if (setThreadCookieNeeded) {
        res.cookies.set("chat_thread_id", threadId, { path: "/", maxAge: 60 * 60 * 24 * 30, sameSite: "lax" });
      }
      return res;
    }

    async function getState(): Promise<string | null> {
      const { data, error } = await supabase
        .from("conversations")
        .select("state")
        .eq("thread_id", threadId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      
      console.log('getState Debug:', { threadId, data, error, foundState: data?.state });
      return (data?.state as string) || null;
    }

    async function logMessage(role: 'user' | 'bot', content: string, state?: string | null, escalation?: boolean, metadata?: any) {
      const insertData: any = {
        thread_id: threadId,
        session_id: cookie,
        role,
        escalation_flag: escalation || false,
        state: state || null
      };
      
      if (role === 'user') {
        insertData.user_query = content;
      } else {
        insertData.ai_reply = content;
      }
      
      // Add metadata if provided (e.g., order context)
      if (metadata) {
        insertData.metadata = metadata;
      }
      
      console.log('Logging message:', { role, content, state, escalation, threadId, metadata });
      const { error } = await supabase.from("conversations").insert(insertData);
      if (error) {
        console.error('Error logging message:', error);
      }
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

    // Log user message
    await logMessage('user', query);
    
    // 1) State machine handling (check state first - HIGHEST PRIORITY)
    const currentState = await getState();
    
    // Debug logging
    console.log('Chat API Debug:', {
      query,
      threadId,
      sessionId: cookie,
      currentState
    });
    
    // Handle escalation confirmation state
    if (currentState === "confirm_escalation") {
      console.log('Processing escalation confirmation for query:', query);
      
      // Check for affirmative responses
      if (/\b(yes|y|yeah|yep|please do|ok|okay|sure|connect|agent)\b/i.test(query)) {
        console.log('User confirmed escalation - proceeding with escalation');
        const msg = "An agent will connect with you shortly.";
        await logMessage('bot', msg, null, true); // Reset state to null, set escalation=true
        return respond({ reply: msg, source: "escalation_yes" });
      }
      
      // Check for negative responses
      if (/\b(no|nope|not now|not yet|cancel|never mind)\b/i.test(query)) {
        console.log('User declined escalation');
        const msg = "No problem. I'm here if you need me.";
        await logMessage('bot', msg, null); // Reset state to null
        return respond({ reply: msg, source: "escalation_no" });
      }
      
      // Unclear response - ask for clarification
      console.log('User response unclear, asking for clarification');
      const msg = "Please reply with yes or no.";
      await logMessage('bot', msg, "confirm_escalation"); // Keep state as confirm_escalation
      return respond({ reply: msg, source: "escalation_confirm_repeat" });
    }

    // 2) FAQ (only if not in a state machine)
    const faqAns = await tryFaq(query);
    if (faqAns) {
      await logMessage('bot', faqAns);
      return respond({ reply: faqAns, source: "faq" });
    }

    // 3) Escalation keywords (support intent)
    const escalationPhrases = ["need support", "talk to human", "talk to agent", "escalate", "more support", "human support"];
    const isEscalationRequest = escalationPhrases.some(phrase => 
      query.toLowerCase().includes(phrase.toLowerCase())
    ) || /(human support|talk to agent|more support|escalate|support)/i.test(query);
    
    if (isEscalationRequest) {
      console.log('Escalation keyword detected:', query);
      // Always confirm first for escalation requests
      console.log('Setting confirm_escalation state');
      const msg = "Do you want me to connect you with an agent?";
      await logMessage('bot', msg, "confirm_escalation");
      return respond({ reply: msg, source: "escalation_confirm" });
    }
    if (currentState === "awaiting_order_id") {
      const id = extractOrderId(query);
      if (!id) {
        const msg = "Please provide a valid order ID (digits).";
        await logMessage('bot', msg, "awaiting_order_id");
        return respond({ reply: msg, source: "order_state" });
      }
      try {
        const order = await lookupOrder(id);
        if (!order) {
          const msg = "Invalid order ID. Please re-check or escalate.";
          await logMessage('bot', msg, "awaiting_order_id"); // Keep state as awaiting_order_id
          return respond({ reply: msg, source: "order_not_found" });
        }
        const reply = `Order ${id} is currently ${order.status}. Expected delivery: ${order.expected_delivery ?? "N/A"}.`;
        await logMessage('bot', reply, null); // Reset state to null
        return respond({ reply, source: "order_status" });
      } catch (e) {
        const msg = "Our systems are facing issues. Please try again later.";
        await logMessage('bot', msg, "awaiting_order_id"); // Keep state as awaiting_order_id
        return respond({ reply: msg, source: "error" }, 500);
      }
    }

    // 3) Detect order tracking intent
    if (/(track|status).*order|order.*(track|status)/i.test(query)) {
      const id = extractOrderId(query);
      if (!id) {
        const msg = "Sure! Please provide your order ID.";
        await logMessage('bot', msg, "awaiting_order_id");
        return respond({ reply: msg, source: "order_request_id" });
      }
      try {
        const order = await lookupOrder(id);
        if (!order) {
          const msg = "Invalid order ID. Please re-check or escalate.";
          await logMessage('bot', msg, "awaiting_order_id");
          return respond({ reply: msg, source: "order_not_found" });
        }
        const reply = `Order ${id} is currently ${order.status}. Expected delivery: ${order.expected_delivery ?? "N/A"}.`;
        await logMessage('bot', reply);
        return respond({ reply, source: "order_status" });
      } catch (e) {
        const msg = "Our systems are facing issues. Please try again later.";
        await logMessage('bot', msg);
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
          await logMessage('bot', reply);
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
    const reply = ai || "I couldn't find that. Would you like to talk to an agent?";
    await logMessage('bot', reply);
    return respond({ reply, source: ai ? "gpt" : "fallback" });
  } catch (e: any) {
    return NextResponse.json({ reply: "Our systems are facing issues. Please try again later.", error: e?.message || "Unknown error" }, { status: 500 });
  }
}

