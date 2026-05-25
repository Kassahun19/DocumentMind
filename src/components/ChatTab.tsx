import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Send,
  MessageSquare,
  Plus,
  Trash2,
  Calendar,
  FileText,
  Sparkles,
  Layers,
  Quote,
  CheckCircle,
  Info,
  ExternalLink,
  RefreshCw,
  Paperclip,
  X,
  ArrowRight,
  ShieldAlert,
} from "lucide-react";
import { ChatSession, ChatMessage, PDFDocument, User } from "../types";

interface ChatTabProps {
  sessions: ChatSession[];
  pdfs: PDFDocument[];
  authToken: string;
  onRefreshSessions: () => void;
  user: User;
  onRefreshUser: () => void;
  onSwitchToBilling: () => void;
}

export default function ChatTab({
  sessions,
  pdfs,
  authToken,
  onRefreshSessions,
  user,
  onRefreshUser,
  onSwitchToBilling,
}: ChatTabProps) {
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [inputText, setInputText] = useState("");
  const [questionFile, setQuestionFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState("");
  const [activeSources, setActiveSources] = useState<any[] | null>(null);

  const messageEndRef = useRef<HTMLDivElement>(null);
  const questionFileInputRef = useRef<HTMLInputElement>(null);

  const isBasicExhausted =
    (user.tier || "free") === "basic" && (user.promptCount || 0) >= 50;
  const isProExhausted =
    (user.tier || "free") === "pro" && (user.promptCount || 0) >= 50;
  const isFreeExhausted =
    (user.tier || "free") === "free" &&
    ((user.promptCount || 0) >= 5 || pdfs.length >= 1);
  const isPaymentPending =
    (user.tier || "free") !== "free" && user.paymentStatus === "pending";
  const isPaymentNotApproved =
    (user.tier || "free") !== "free" &&
    user.paymentStatus !== "approved" &&
    user.paymentStatus !== "pending";
  const isLocked =
    isFreeExhausted ||
    isBasicExhausted ||
    isProExhausted ||
    isPaymentPending ||
    isPaymentNotApproved;

  // Auto-select session on load
  useEffect(() => {
    if (sessions.length > 0 && !activeSessionId) {
      setActiveSessionId(sessions[0].id);
    }
  }, [sessions]);

  // Scroll to bottom when messages update
  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeSessionId, sessions, submitting]);

  const activeSession = sessions.find((s) => s.id === activeSessionId);

  // Create new session
  const handleNewSession = async () => {
    try {
      const res = await fetch("/api/chats", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ title: "New PDF Inquiry" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      onRefreshSessions();
      setActiveSessionId(data.id);
    } catch (err: any) {
      setApiError(err.message || "Creating chat failed");
    }
  };

  // Delete session
  const handleDeleteSession = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/chats/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });
      if (!res.ok) throw new Error("Unlinking history failed");

      onRefreshSessions();
      if (activeSessionId === id) {
        const remaining = sessions.filter((s) => s.id !== id);
        setActiveSessionId(remaining.length > 0 ? remaining[0].id : null);
      }
    } catch (err: any) {
      setApiError(err.message || "Deleting chat failed");
    }
  };

  // Send message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!inputText.trim() && !questionFile) || submitting || !activeSessionId)
      return;

    const messageToSend = inputText;
    const fileToSend = questionFile;

    setInputText("");
    setQuestionFile(null); // Clear selected question attachment preview
    setSubmitting(true);
    setApiError("");
    setActiveSources(null);

    try {
      let res;
      if (fileToSend) {
        const formData = new FormData();
        formData.append("message", messageToSend);
        formData.append("questionFile", fileToSend);

        res = await fetch(`/api/chats/${activeSessionId}/message`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
          body: formData,
        });
      } else {
        res = await fetch(`/api/chats/${activeSessionId}/message`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({ message: messageToSend }),
        });
      }

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Connection to prompt pipeline failed");
      }

      onRefreshSessions();
    } catch (err: any) {
      setApiError(err.message || "Sending query failed");
    } finally {
      setSubmitting(false);
    }
  };

  const selectSuggestion = (text: string) => {
    setInputText(text);
  };

  return (
    <div className="flex flex-col lg:flex-row min-h-[520px] h-[78vh] lg:h-[78vh] rounded-3xl border border-slate-800 bg-slate-950/40 backdrop-blur-md overflow-hidden font-sans relative">
      {/* 2. Chat History Workspace Selector (Left) */}
      <div className="w-full lg:w-72 bg-slate-900/30 border-b lg:border-b-0 lg:border-r border-slate-800 flex flex-col shrink-0">
        <div className="p-4 border-b border-slate-800">
          <button
            onClick={handleNewSession}
            className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-500 to-cyan-500 text-slate-950 font-bold text-sm tracking-wide hover:opacity-95 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-indigo-500/10"
          >
            <Plus className="h-4 w-4 stroke-[2.5]" /> New Inquiry Space
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1 max-h-[160px] lg:max-h-none">
          {sessions.length === 0 ? (
            <div className="p-4 text-center text-slate-600 text-xs mt-6 select-none leading-relaxed">
              No conversational streams recorded. Create one above to begin.
            </div>
          ) : (
            sessions.map((session) => {
              const isActive = session.id === activeSessionId;
              const hasMessages = session.messages.length > 0;
              return (
                <div
                  key={session.id}
                  onClick={() => {
                    setActiveSessionId(session.id);
                    setApiError("");
                    setActiveSources(null);
                  }}
                  className={`w-full p-3 rounded-xl flex items-center justify-between text-left cursor-pointer transition select-none border ${
                    isActive
                      ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-300"
                      : "border-transparent hover:bg-slate-900/40 text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <MessageSquare
                      className={`h-4.5 w-4.5 shrink-0 ${isActive ? "text-indigo-400" : "text-slate-500"}`}
                    />
                    <div className="min-w-0 pr-2">
                      <p className="text-xs font-semibold truncate leading-normal">
                        {session.title}
                      </p>
                      <p className="text-[10px] text-slate-600 truncate mt-0.5">
                        {new Date(session.createdAt).toLocaleDateString(
                          undefined,
                          {
                            month: "short",
                            day: "numeric",
                          },
                        )}{" "}
                        • {session.messages.length / 2} prompts
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={(e) => handleDeleteSession(session.id, e)}
                    className="opacity-0 group-hover:opacity-100 hover:opacity-100 lg:opacity-40 hover:lg:opacity-100 h-6 w-6 rounded-md hover:bg-slate-800 text-slate-500 hover:text-red-400 flex items-center justify-center transition cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 3. Message Feed Container (Middle / Right) */}
      <div className="flex-1 flex flex-col justify-between overflow-hidden bg-gradient-to-b from-slate-950 to-slate-900/50">
        {/* Active Session Info Header */}
        <div className="py-3.5 px-6 border-b border-slate-800 bg-slate-900/20 backdrop-blur-md flex items-center justify-between z-10 shrink-0">
          <div className="min-w-0">
            <h3 className="text-xs font-bold text-slate-300 truncate">
              {activeSession ? activeSession.title : "No Workspace Active"}
            </h3>
            <p className="text-[10px] text-slate-500 truncate mt-0.5">
              Powered by gemini-3.5-flash &bull; Grounded Semantic RAG Matrix
            </p>
          </div>
          {pdfs.length > 0 && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-indigo-500/20 bg-indigo-500/10 text-indigo-300 text-[10px] font-semibold select-none">
              <Layers className="h-3 w-3" /> Indexed Knowledge Base Activated
            </span>
          )}
        </div>
        {/* Message Feed Scroll */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {apiError && (
            <div className="p-4 rounded-xl border border-red-500/20 bg-red-400/5 text-red-400 text-xs text-center font-semibold leading-relaxed">
              {apiError}
            </div>
          )}

          {!activeSession ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6">
              <Sparkles className="h-10 w-10 text-slate-800 mb-3 animate-pulse" />
              <h4 className="text-slate-400 font-bold text-sm">
                No workspace initialized
              </h4>
              <p className="text-xs text-slate-600 mt-1 max-w-xs leading-normal">
                Initialize a workspace by clicking{" "}
                <span className="text-indigo-400">"New Inquiry Space"</span> on
                the sidebar.
              </p>
            </div>
          ) : activeSession.messages.length === 0 ? (
            <div className="h-full flex flex-col justify-center max-w-2xl mx-auto py-10">
              <div className="text-center mb-8">
                <div className="h-12 w-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 mx-auto mb-4 animate-bounce">
                  <Sparkles className="h-6 w-6 stroke-[2]" />
                </div>
                <h4 className="text-slate-200 font-bold text-base">
                  Direct PDF Prompting Terminal
                </h4>
                <p className="text-slate-500 text-xs mt-1 max-w-sm mx-auto leading-normal">
                  DocuMind is awaiting your query inside this workspace. The AI
                  will speak based strictly on the context chunks extracted from
                  your active PDFs.
                </p>
              </div>

              {pdfs.length === 0 ? (
                <div className="p-4 rounded-2xl border border-dashed border-slate-800 bg-slate-900/20 text-center">
                  <p className="text-slate-400 text-xs font-semibold leading-relaxed">
                    No documents currently reside in your dashboard registry.
                  </p>
                  <p className="text-[11px] text-slate-600 mt-1">
                    Upload papers in the Document Manager first for DocuMind to
                    ground its knowledge.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4">
                  <div
                    onClick={() =>
                      selectSuggestion(
                        "Summarize the primary objectives, methodologies, and core conclusions across my uploaded documents.",
                      )
                    }
                    className="p-3 bg-slate-900/30 hover:bg-slate-900/60 border border-slate-800 rounded-xl text-left cursor-pointer transition select-none group"
                  >
                    <span className="text-[11px] font-bold text-indigo-400 uppercase tracking-widest block mb-1 font-mono uppercase group-hover:text-indigo-300">
                      Summarize All
                    </span>
                    <p className="text-xs text-slate-400 leading-normal">
                      Summarize goals and findings in my document store.
                    </p>
                  </div>
                  <div
                    onClick={() =>
                      selectSuggestion(
                        "Are there any conflicting findings, legal exceptions, or arguments presented between the papers?",
                      )
                    }
                    className="p-3 bg-slate-900/30 hover:bg-slate-900/60 border border-slate-800 rounded-xl text-left cursor-pointer transition select-none group"
                  >
                    <span className="text-[11px] font-bold text-cyan-400 uppercase tracking-widest block mb-1 font-mono uppercase group-hover:text-cyan-300">
                      Contrast Documents
                    </span>
                    <p className="text-xs text-slate-400 leading-normal">
                      Identify differences, debates, or legal overrides.
                    </p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-6 max-w-3xl mx-auto">
              {activeSession.messages.map((message) => {
                const isUser = message.sender === "user";
                return (
                  <div
                    key={message.id}
                    className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}
                  >
                    <div
                      className={`max-w-[85%] p-4 rounded-2xl leading-relaxed text-sm shadow-md whitespace-pre-wrap ${
                        isUser
                          ? "bg-slate-800 border border-slate-700 text-slate-100 rounded-tr-none"
                          : "bg-indigo-950/40 border border-indigo-900/40 text-slate-200 rounded-tl-none relative before:absolute before:inset-0 before:bg-indigo-500/5 before:-z-10"
                      }`}
                    >
                      {/* Message typography */}
                      <span>{message.text}</span>
                    </div>
                    <span className="text-[9px] text-slate-600 mt-1 px-1">
                      {new Date(message.timestamp).toLocaleTimeString(
                        undefined,
                        {
                          hour: "2-digit",
                          minute: "2-digit",
                        },
                      )}
                    </span>
                  </div>
                );
              })}

              {submitting && (
                <div className="flex flex-col items-start">
                  <div className="p-4 bg-indigo-950/20 border border-indigo-900/20 text-indigo-400 rounded-2xl rounded-tl-none flex items-center gap-2.5 shadow-md">
                    <div className="flex space-x-1.5 items-center">
                      <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce delay-75" />
                      <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                      <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce [animation-delay:0.35s]" />
                    </div>
                    <span className="text-xs font-semibold animate-pulse font-mono uppercase tracking-widest text-[10px] pl-1">
                      Scanning memory arrays &amp; vector nodes...
                    </span>
                  </div>
                </div>
              )}

              <div ref={messageEndRef} />
            </div>
          )}
        </div>{" "}
        {/* Messaging Box Bottom Form */}
        {activeSessionId && (
          <div className="p-4 border-t border-slate-800 bg-slate-900/10 shrink-0 z-10">
            {isLocked ? (
              <div className="max-w-3xl mx-auto p-5 rounded-2xl bg-slate-950/90 border border-slate-800/80 shadow-[0_0_25px_rgba(244,63,94,0.03)] space-y-4 select-none">
                {isFreeExhausted || isBasicExhausted || isProExhausted ? (
                  <div className="space-y-4 animate-fade-in text-left">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <div>
                        <h4 className="text-sm font-bold text-red-400 flex items-center gap-1.5 font-sans">
                          <ShieldAlert className="h-4.5 w-4.5 animate-pulse shrink-0 text-red-500" />
                          {isBasicExhausted
                            ? "Basic Plan Completed / Limit Reached!"
                            : isProExhausted
                              ? "Pro Plan Completed / Limit Reached!"
                              : "Free Plan Completed / Limit Reached!"}
                        </h4>
                        <p className="text-[11px] text-slate-400 mt-1 max-w-xl leading-relaxed">
                          {isBasicExhausted && (
                            <>
                              Your Basic plan has completed. You have hit the
                              limit of <strong>50 prompts</strong>. Please
                              upgrade your plan below to continue asking
                              questions.
                            </>
                          )}
                          {isProExhausted && (
                            <>
                              Your Pro monthly allocation has completed. You
                              have hit the limit of{" "}
                              <strong>50 prompts/month</strong> (monthly basis).
                              Please upgrade to Premium to unlock unlimited
                              questions.
                            </>
                          )}
                          {isFreeExhausted && (
                            <>
                              Your Free tier has completed. You have either hit
                              the limit of{" "}
                              <strong>5 free prompt requests</strong> (Current:{" "}
                              {user.promptCount || 0}) or indexed{" "}
                              <strong>1 PDF document</strong> (Current:{" "}
                              {pdfs.length}). Please upgrade to one of our
                              affordable pricing plans below:
                            </>
                          )}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={onSwitchToBilling}
                        className="px-3 py-2 bg-gradient-to-r from-indigo-505 to-cyan-505 bg-indigo-500 hover:opacity-95 text-slate-950 font-bold text-[10px] uppercase rounded-lg transition inline-flex items-center gap-1 shrink-0 cursor-pointer shadow-md"
                      >
                        Enter Reference ID{" "}
                        <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {/* Quick plans grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                      <div className="p-2.5 rounded-xl bg-slate-900/40 border border-slate-850 flex flex-col justify-between">
                        <div>
                          <p className="font-bold text-slate-200">Basic Plan</p>
                          <p className="text-[10px] text-slate-500 mt-0.5">
                            ETB 100 per month
                          </p>
                        </div>
                        <a
                          href="https://ye-buna.com/kassahunmulatu"
                          target="_blank"
                          rel="noopener noreferrer"
                          referrerPolicy="no-referrer"
                          className="mt-2.5 block py-1.5 bg-slate-950 hover:bg-slate-900 text-center text-[10px] font-bold text-indigo-400 border border-slate-850 hover:border-slate-800 rounded-lg transition"
                        >
                          Go Basic
                        </a>
                      </div>

                      <div className="p-2.5 rounded-xl bg-slate-900/40 border border-indigo-500/10 flex flex-col justify-between">
                        <div>
                          <p className="font-bold text-slate-200">Pro Year</p>
                          <p className="text-[10px] text-slate-500 mt-0.5">
                            ETB 500 per year
                          </p>
                        </div>
                        <a
                          href="https://ye-buna.com/kassahunmulatu"
                          target="_blank"
                          rel="noopener noreferrer"
                          referrerPolicy="no-referrer"
                          className="mt-2.5 block py-1.5 bg-slate-950 hover:bg-slate-900 text-center text-[10px] font-bold text-cyan-400 border border-slate-850 hover:border-slate-800 rounded-lg transition"
                        >
                          Go Pro
                        </a>
                      </div>

                      <div className="p-2.5 rounded-xl bg-slate-900/40 border border-slate-850 flex flex-col justify-between">
                        <div>
                          <p className="font-bold text-slate-200">
                            Premium Life
                          </p>
                          <p className="text-[10px] text-slate-500 mt-0.5">
                            ETB 1000 for ever
                          </p>
                        </div>
                        <a
                          href="https://ye-buna.com/kassahunmulatu"
                          target="_blank"
                          rel="noopener noreferrer"
                          referrerPolicy="no-referrer"
                          className="mt-2.5 block py-1.5 bg-slate-950 hover:bg-slate-900 text-center text-[10px] font-bold text-purple-400 border border-slate-850 hover:border-slate-800 rounded-lg transition"
                        >
                          Go Premium
                        </a>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3 animate-fade-in py-1 text-left">
                    <div className="flex items-start gap-3">
                      <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-500 shrink-0">
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-amber-400">
                          Payment Pending Approval
                        </h4>
                        <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                          Your request to unlock DocuMind features is pending
                          administrator verification. In compliance with active
                          instructions, AI inquiries are disabled until your
                          payment (TX ID:{" "}
                          <code className="font-mono text-slate-200 font-bold select-all">
                            {user.paymentTxId || "None"}
                          </code>
                          ) is approved by an admin.
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <button
                        type="button"
                        onClick={onSwitchToBilling}
                        className="px-3 py-1.5 bg-slate-950 hover:bg-slate-900 border border-slate-850 hover:border-slate-800 text-slate-350 text-[10px] font-bold rounded-lg transition cursor-pointer"
                      >
                        Adjust Transaction ID
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="max-w-3xl mx-auto space-y-2">
                {/* Question file attached indicator */}
                {questionFile && (
                  <div className="flex items-center gap-2 p-2 px-3 bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 rounded-xl text-xs w-fit animate-fade-in">
                    <FileText className="h-3.5 w-3.5" />
                    <span className="font-semibold truncate max-w-[200px]">
                      {questionFile.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setQuestionFile(null);
                        if (questionFileInputRef.current)
                          questionFileInputRef.current.value = "";
                      }}
                      className="p-1 hover:bg-indigo-400/20 text-indigo-400 hover:text-indigo-200 rounded-full transition cursor-pointer"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                )}

                <form
                  onSubmit={handleSendMessage}
                  className="flex gap-3 relative"
                >
                  {/* Hidden input */}
                  <input
                    ref={questionFileInputRef}
                    type="file"
                    accept="application/pdf"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setQuestionFile(e.target.files[0]);
                      }
                    }}
                    className="hidden"
                  />

                  <button
                    type="button"
                    disabled={submitting || pdfs.length === 0}
                    onClick={() => questionFileInputRef.current?.click()}
                    className="px-3.5 bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200 rounded-2xl flex items-center justify-center transition cursor-pointer disabled:opacity-40"
                    title="Upload questions PDF"
                  >
                    <Paperclip className="h-4.5 w-4.5" />
                  </button>

                  <input
                    type="text"
                    disabled={submitting || pdfs.length === 0}
                    placeholder={
                      pdfs.length === 0
                        ? "Awaiting document uploads to trigger prompting engine..."
                        : "Ask a question, or attach a questions file with the clip..."
                    }
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    className="w-full pl-5 pr-14 py-3.5 bg-slate-950 border border-slate-800 rounded-2xl text-slate-205 text-sm focus:outline-none focus:border-indigo-505 placeholder-slate-600 transition disabled:opacity-50 text-slate-200"
                  />
                  <button
                    type="submit"
                    disabled={
                      submitting ||
                      (!inputText.trim() && !questionFile) ||
                      pdfs.length === 0
                    }
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 h-10 w-10 rounded-xl bg-gradient-to-r from-indigo-500 to-cyan-500 text-slate-950 flex items-center justify-center hover:opacity-95 transition cursor-pointer disabled:opacity-40"
                  >
                    <Send className="h-4.5 w-4.5 stroke-[2.5]" />
                  </button>
                </form>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 4. Document Source References Drawer Context Popup Modal */}
      <AnimatePresence>
        {activeSources && (
          <motion.div
            className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex justify-end z-50 select-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setActiveSources(null)}
          >
            <motion.div
              className="w-full max-w-md h-full bg-slate-900 border-l border-slate-800 shadow-2xl p-6 overflow-y-auto flex flex-col justify-between"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 220 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <Quote className="h-5 w-5 text-indigo-400" /> Source Data
                      Excerpts
                    </h3>
                    <p className="text-[10px] text-slate-500 mt-0.5 uppercase tracking-widest font-mono">
                      Strict vector index similarity matches
                    </p>
                  </div>
                  <button
                    onClick={() => setActiveSources(null)}
                    className="p-1 px-2.5 rounded-lg border border-slate-850 hover:bg-slate-800 text-xs text-slate-400 font-semibold transition cursor-pointer"
                  >
                    Hide
                  </button>
                </div>

                <div className="space-y-4">
                  {activeSources.map((source, i) => (
                    <div
                      key={i}
                      className="p-4 rounded-xl border border-indigo-500/10 bg-indigo-500/5 space-y-2 relative"
                    >
                      <div className="absolute top-3.5 right-3.5 px-2 py-0.5 bg-indigo-500/20 text-indigo-300 font-mono text-[9px] rounded-md uppercase font-semibold">
                        Rank #{i + 1}
                      </div>

                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-indigo-400 shrink-0" />
                        <span className="text-xs font-bold text-slate-200 truncate pr-16">
                          {source.fileName}
                        </span>
                      </div>

                      <div className="p-3 bg-slate-950/60 rounded-lg text-xs font-mono text-slate-400 border border-slate-900 leading-relaxed max-h-48 overflow-y-auto italic">
                        "{source.text}"
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-6 border-t border-slate-850 text-center select-none">
                <p className="text-[10px] text-slate-600 leading-normal max-w-xs mx-auto">
                  Only content pieces with critical dot-product counts above
                  threshold are selected to prevent AI slop &amp;
                  hallucinations.
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
