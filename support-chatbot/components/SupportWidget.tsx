"use client";
import { useEffect, useRef, useState } from "react";
import styles from "./SupportWidget.module.css";

type ChatMode = "min" | "dock" | "full";

type Intent = "none" | "track" | "refundAwaitId" | "refundAwaitReason";

export default function SupportWidget() {
  const [mode, setMode] = useState<ChatMode>("min");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<{ from: "user" | "bot"; text: string }[]>([]);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const resizingRef = useRef<{ startX: number; startY: number; startW: number; startH: number } | null>(null);
  const [intent, setIntent] = useState<Intent>("none");
  const refundOrderIdRef = useRef<string | null>(null);

  // Restore persisted mode and default to dock on mobile
  useEffect(() => {
    const m = (typeof window !== "undefined" && localStorage.getItem("chatMode")) as ChatMode | null;
    const isMobile = typeof window !== "undefined" && window.matchMedia("(max-width: 768px)").matches;
    setMode(m || (isMobile ? "dock" : "min"));
    const s = typeof window !== "undefined" ? localStorage.getItem("chatSize") : null;
    if (s) {
      try { setSize(JSON.parse(s)); } catch {}
    }

    // Check for chat context from orders page
    const context = typeof window !== "undefined" ? sessionStorage.getItem('chatContext') : null;
    if (context) {
      try {
        const { message } = JSON.parse(context);
        setMessages([{ from: "bot", text: message }]);
        sessionStorage.removeItem('chatContext');
      } catch {}
    } else {
      setMessages([{ from: "bot", text: "Hi! I'm ShopMate. How can I help today?" }]);
    }
  }, []);

  // Persist mode
  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem("chatMode", mode);
  }, [mode]);

  useEffect(() => {
    if (typeof window !== "undefined" && size) localStorage.setItem("chatSize", JSON.stringify(size));
  }, [size]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, mode]);

  // Close on Esc in all modes; focus trap in fullscreen
  useEffect(() => {
    const container = panelRef.current;
    const focusable = () => container ? Array.from(container.querySelectorAll<HTMLElement>("button, [href], input, textarea, [tabindex]:not([tabindex='-1'])")).filter(el => !el.hasAttribute("disabled")) : [];
    const first = () => (focusable()[0]);
    const last = () => (focusable()[focusable().length - 1]);
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        // Close/minimize on Esc as requested
        setMode("min");
      } else if (e.key === "Tab") {
        if (mode !== "full") return; // trap only in fullscreen
        const f = focusable();
        if (!f.length) return;
        const firstEl = f[0];
        const lastEl = f[f.length - 1];
        if (e.shiftKey && document.activeElement === firstEl) {
          e.preventDefault();
          lastEl.focus();
        } else if (!e.shiftKey && document.activeElement === lastEl) {
          e.preventDefault();
          firstEl.focus();
        }
      }
    };
    document.addEventListener("keydown", handleKey);
    if (mode === "full") setTimeout(() => first()?.focus(), 0);
    return () => document.removeEventListener("keydown", handleKey);
  }, [mode]);

  async function send(query: string) {
    setMessages((m) => [...m, { from: "user", text: query }]);
    // Intent-driven flows first
    if (intent === "track") {
      const match = query.match(/\b(\d{5,})\b/);
      const id = match?.[1];
      if (!id) {
        setMessages((m) => [...m, { from: "bot", text: "Please provide a valid Order ID (digits)." }]);
        return;
      }
      console.log("[chat] fetching order", id);
      try {
        const r = await fetch(`/api/orders/${id}`);
        if (r.status === 404) {
          setMessages((m) => [...m, { from: "bot", text: "Order not found. Please re-check or escalate." }]);
          return;
        }
        if (!r.ok) throw new Error("server");
        const data = await r.json();
        const status = String(data.status || "");
        const expected = data.expected_delivery ?? "N/A";
        const delivered = data.delivered_on ?? "N/A";
        setMessages((m) => [
          ...m,
          { from: "bot", text: `Order ${id}: ${status}. Expected delivery: ${expected}. Delivered on: ${delivered}.` }
        ]);
      } catch (e) {
        console.error("[chat] order error", e);
        setMessages((m) => [...m, { from: "bot", text: "Our systems are facing issues. Please try again later." }]);
      } finally {
        setIntent("none");
      }
      return;
    }

    if (intent === "refundAwaitId") {
      const match = query.match(/\b(\d{5,})\b/);
      const id = match?.[1];
      if (!id) {
        setMessages((m) => [...m, { from: "bot", text: "Please provide a valid Order ID (digits)." }]);
        return;
      }
      console.log("[chat] validate refund order", id);
      try {
        const r = await fetch(`/api/orders/${id}`);
        if (r.status === 404) {
          setMessages((m) => [...m, { from: "bot", text: "Order not found. Please re-check or escalate." }]);
          setIntent("none");
          return;
        }
        if (!r.ok) throw new Error("server");
        refundOrderIdRef.current = id;
        setIntent("refundAwaitReason");
        setMessages((m) => [...m, { from: "bot", text: "Please provide a short reason for the refund." }]);
      } catch (e) {
        console.error("[chat] refund validate error", e);
        setMessages((m) => [...m, { from: "bot", text: "Our systems are facing issues. Please try again later." }]);
        setIntent("none");
      }
      return;
    }

    if (intent === "refundAwaitReason") {
      const orderId = refundOrderIdRef.current;
      if (!orderId) {
        setIntent("none");
      } else {
        console.log("[chat] creating refund", orderId);
        try {
          const r = await fetch("/api/refund", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ order_id: orderId, reason: query })
          });
          const data = await r.json();
          if (r.ok) {
            const msg = data?.message as string | undefined;
            if (msg && /already been initiated/i.test(msg)) {
              setMessages((m) => [...m, { from: "bot", text: "Refund has already been initiated." }]);
            } else {
              setMessages((m) => [...m, { from: "bot", text: `Refund request created for order ${orderId}.` }]);
            }
          } else if (r.status === 404) {
            setMessages((m) => [...m, { from: "bot", text: "Order not found. Please re-check or escalate." }]);
          } else {
            setMessages((m) => [...m, { from: "bot", text: "Our systems are facing issues. Please try again later." }]);
          }
        } catch (e) {
          console.error("[chat] refund error", e);
          setMessages((m) => [...m, { from: "bot", text: "Our systems are facing issues. Please try again later." }]);
        }
      }
      refundOrderIdRef.current = null;
      setIntent("none");
      return;
    }

    // Generic chat fallback
    try {
      const r = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query })
      });
      if (!r.ok) throw new Error("Request failed");
      const data = await r.json();
      setMessages((m) => [...m, { from: "bot", text: data.reply }]);
    } catch (e) {
      console.error("[chat] generic error", e);
      setMessages((m) => [
        ...m,
        { from: "bot", text: "Our systems are facing issues. Please try again later." }
      ]);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;
    const q = input.trim();
    setInput("");
    await send(q);
  }

  function handleQuick(action: "track" | "refund" | "agent") {
    if (action === "track") {
      setMessages((m) => [...m, { from: "bot", text: "Please share your Order ID to track." }]);
      setIntent("track");
    } else if (action === "refund") {
      setMessages((m) => [...m, { from: "bot", text: "Please share your Order ID to start a refund." }]);
      setIntent("refundAwaitId");
    } else {
      setMessages((m) => [...m, { from: "bot", text: "An agent will reach you shortly." }]);
      // Optionally call escalate endpoint
      fetch("/api/escalate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ user_query: "User requested agent", ai_reply: "Escalation created" }) });
    }
  }
  return (
    <>
      {mode === "min" && (
        <button
          aria-label="Open support"
          className={styles.fab}
          onClick={() => setMode("dock")}
          data-chat-widget
        >
          💬
        </button>
      )}

      {mode === "dock" && (
        <div
          className={`${styles.panel} ${styles.panelTall} ${styles.visible}`}
          role="dialog"
          aria-label="Support chat"
          aria-modal="false"
          ref={panelRef}
          style={size ? { width: `${Math.min(Math.max(size.w, 320), 520)}px`, height: `${Math.min(Math.max(size.h, 400), window.innerHeight * 0.8)}px` } : undefined}
        >
          <div className={styles.header}>
            <div className={styles.titleBar}>
              <div className={styles.title}>Support</div>
              <div className={styles.controls}>
                <button className={styles.iconBtn} onClick={() => setMode("min")} aria-label="Minimize">_</button>
                <button className={styles.iconBtn} onClick={() => setMode("full")} aria-label="Enter fullscreen">⛶</button>
                <button className={styles.iconBtn} onClick={() => setMode("dock")} aria-label="Dock">▣</button>
              </div>
            </div>
          </div>
          <div className={styles.body}>
            <div className={styles.messages} role="log" aria-live="polite">
              {messages.map((m, i) => (
                <div key={i} className={`${styles.row} ${m.from === "user" ? styles.user : styles.bot}`}>
                  <div className={`${styles.bubble} ${m.from === "user" ? styles.bubbleUser : styles.bubbleBot}`}>{m.text}</div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
            <div className={styles.quickBar}>
              <button className={styles.quickBtn} onClick={() => handleQuick("track")} aria-label="Track Order">Track Order</button>
              <button className={styles.quickBtn} onClick={() => handleQuick("refund")} aria-label="Return or Refund">Return/Refund</button>
              <button className={styles.quickBtn} onClick={() => handleQuick("agent")} aria-label="Talk to Agent">Talk to Agent</button>
            </div>
            <form className={styles.inputBar} onSubmit={handleSubmit} role="search">
              <input
                className={styles.input}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type your message..."
                aria-label="Chat message"
              />
              <button className={styles.send} aria-label="Send message">Send</button>
            </form>
          </div>
          {/* resize handle (desktop only) */}
          {typeof window !== "undefined" && window.matchMedia("(min-width: 769px)").matches && (
            <div
              className={styles.resizeHandle}
              role="separator"
              aria-orientation="vertical"
              onMouseDown={(e) => {
                if (!panelRef.current) return;
                const rect = panelRef.current.getBoundingClientRect();
                resizingRef.current = { startX: e.clientX, startY: e.clientY, startW: rect.width, startH: rect.height };
                const onMove = (ev: MouseEvent) => {
                  if (!resizingRef.current) return;
                  const dx = resizingRef.current.startX - ev.clientX; // dragging left increases width
                  const dy = ev.clientY - resizingRef.current.startY; // dragging down increases height
                  const w = Math.min(Math.max(resizingRef.current.startW + dx, 320), 520);
                  const maxH = Math.floor(window.innerHeight * 0.8);
                  const h = Math.min(Math.max(resizingRef.current.startH + dy, 400), maxH);
                  setSize({ w, h });
                };
                const onUp = () => {
                  document.removeEventListener("mousemove", onMove);
                  document.removeEventListener("mouseup", onUp);
                  resizingRef.current = null;
                };
                document.addEventListener("mousemove", onMove);
                document.addEventListener("mouseup", onUp);
              }}
            />
          )}
        </div>
      )}

      {mode === "full" && (
        <div className={styles.overlay} aria-hidden={false}>
          <div className={`${styles.panelFull} ${styles.visible}`} role="dialog" aria-label="Support chat fullscreen" aria-modal="true" ref={panelRef}>
            <div className={styles.header}>
              <div className={styles.titleBar}>
                <div className={styles.title}>Support</div>
                <div className={styles.controls}>
                  <button className={styles.iconBtn} onClick={() => setMode("dock")} aria-label="Exit fullscreen">▣</button>
                  <button className={styles.iconBtn} onClick={() => setMode("min")} aria-label="Minimize">_</button>
                </div>
              </div>
            </div>
            <div className={styles.body}>
              <div className={styles.messages} role="log" aria-live="polite">
                {messages.map((m, i) => (
                  <div key={i} className={`${styles.row} ${m.from === "user" ? styles.user : styles.bot}`}>
                    <div className={`${styles.bubble} ${m.from === "user" ? styles.bubbleUser : styles.bubbleBot}`}>{m.text}</div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
              <div className={styles.quickBar}>
                <button className={styles.quickBtn} onClick={() => handleQuick("track")} aria-label="Track Order">Track Order</button>
                <button className={styles.quickBtn} onClick={() => handleQuick("refund")} aria-label="Return or Refund">Return/Refund</button>
                <button className={styles.quickBtn} onClick={() => handleQuick("agent")} aria-label="Talk to Agent">Talk to Agent</button>
              </div>
              <form className={styles.inputBar} onSubmit={handleSubmit} role="search">
                <input
                  className={styles.input}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Type your message..."
                  aria-label="Chat message"
                />
                <button className={styles.send} aria-label="Send message">Send</button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

