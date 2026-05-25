import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Bot,
  MessageSquareText,
  X,
  Send,
  Sparkles,
  ShieldCheck,
} from "lucide-react";

type ChatRole = "user" | "assistant";

type ChatMessage = {
  id: string;
  role: ChatRole;
  text: string;
};

export default function FloatingAssistant() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");

  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    // Add a single welcome message when opening for the first time.
    setMessages((prev: ChatMessage[]) => {
      if ((prev as ChatMessage[]).length > 0) return prev as ChatMessage[];
      return [
        {
          id: "welcome",
          role: "assistant",
          text: "Hi! I can answer about DocuMind AI using only the information on this website. Ask me anything about products, pricing, or how it works.",
        },
      ];
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open, loading]);

  const canSend = useMemo(() => {
    return input.trim().length > 0 && !loading;
  }, [input, loading]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;

    setError("");
    setLoading(true);
    setInput("");

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      text,
    };

    setMessages((prev: ChatMessage[]) => [...prev, userMsg]);

    try {
      const res = await fetch("/api/assistant/static-qa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: text }),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data?.error || "Assistant request failed");

      const assistantMsg: ChatMessage = {
        id: `a-${Date.now()}`,
        role: "assistant",
        text:
          data?.answer ||
          "I could not produce an answer from the website content.",
      };

      setMessages((prev: ChatMessage[]) => [...prev, assistantMsg]);
    } catch (e: any) {
      setError(e?.message || "Assistant error");
      setMessages((prev: ChatMessage[]) => [
        ...prev,
        {
          id: `a-err-${Date.now()}`,
          role: "assistant",
          text: "Sorry—something went wrong while trying to answer from the website content.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Floating button */}
      <div className="fixed bottom-4 right-4 z-[9999]">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="group inline-flex items-center gap-2 px-3 py-2 rounded-2xl bg-slate-950/80 border border-slate-800/90 hover:bg-slate-900 text-slate-100 shadow-2xl backdrop-blur-md transition cursor-pointer"
          aria-label="Open AI Assistant"
          title="AI Assistant (static website knowledge)"
        >
          <span className="flex items-center justify-center h-9 w-9 rounded-xl bg-gradient-to-r from-indigo-500 to-cyan-500 text-slate-950">
            <Bot className="h-4.5 w-4.5" />
          </span>
          <span className="hidden sm:inline text-xs font-bold tracking-wide text-slate-100">
            Assistant
          </span>
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-50">
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-slate-950/30 backdrop-blur-sm"
              onClick={() => setOpen(false)}
            />

            {/* Window */}
            <motion.div
              initial={{ opacity: 0, y: 18, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 18, scale: 0.98 }}
              transition={{ duration: 0.18 }}
              className="absolute bottom-4 right-4 left-4 sm:left-auto sm:right-4 sm:max-w-[420px] w-[calc(100%-2rem)] bg-slate-900 border border-slate-800/90 rounded-3xl shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="px-4 py-3 border-b border-slate-800/80 bg-slate-950/30 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="h-9 w-9 rounded-2xl bg-indigo-500/15 border border-indigo-500/20 flex items-center justify-center text-indigo-300">
                    <MessageSquareText className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-extrabold text-slate-100 leading-tight truncate">
                      DocuMind Assistant
                    </div>
                    <div className="text-[10px] text-slate-400 font-medium truncate flex items-center gap-1">
                      <ShieldCheck className="h-3 w-3 text-cyan-400" /> Static
                      knowledge only
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="p-2 rounded-xl hover:bg-slate-800/70 transition cursor-pointer text-slate-300"
                  aria-label="Close assistant"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Body */}
              <div className="px-4 py-4 space-y-3 max-h-[55vh] overflow-y-auto">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={
                      m.role === "user"
                        ? "flex justify-end"
                        : "flex justify-start"
                    }
                  >
                    <div
                      className={
                        m.role === "user"
                          ? "max-w-[88%] bg-indigo-500/15 border border-indigo-500/20 text-indigo-100 rounded-2xl px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap"
                          : "max-w-[88%] bg-slate-950/30 border border-slate-800/70 text-slate-200 rounded-2xl px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap"
                      }
                    >
                      {m.text}
                    </div>
                  </div>
                ))}

                {loading && (
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <Sparkles className="h-3.5 w-3.5 animate-pulse text-cyan-400" />
                    Answering from website content...
                  </div>
                )}

                {error && (
                  <div className="text-[11px] text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
                    {error}
                  </div>
                )}

                <div ref={endRef} />
              </div>

              {/* Composer */}
              <div className="p-3 border-t border-slate-800/80 bg-slate-950/20">
                <div className="flex items-end gap-2">
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    rows={1}
                    placeholder="Ask about pricing, features, or how DocuMind works..."
                    className="flex-1 resize-none bg-slate-950/50 border border-slate-800/80 rounded-2xl px-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        if (canSend) send();
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={send}
                    disabled={!canSend}
                    className="h-10 w-10 rounded-2xl bg-gradient-to-r from-indigo-500 to-cyan-500 text-slate-950 disabled:opacity-50 flex items-center justify-center hover:opacity-95 transition cursor-pointer"
                    aria-label="Send message"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-2 text-[10px] text-slate-500 flex items-center gap-2 select-none">
                  <span className="inline-flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />{" "}
                    grounded
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />{" "}
                    no external info
                  </span>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
