import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  BrainCircuit,
  LayoutDashboard,
  MessageSquareLock,
  LogOut,
  Database,
  UserCheck,
  RefreshCw,
  Layers,
  Sparkles,
  CreditCard,
  ShieldAlert,
  Users,
  Mail,
  Phone,
  MapPin,
  Info,
  Check,
  X,
  Coins,
} from "lucide-react";

import AuthScreen from "./components/AuthScreen";
import DashboardTab from "./components/DashboardTab";
import ChatTab from "./components/ChatTab";
import BillingTab from "./components/BillingTab";
import AdminTab from "./components/AdminTab";
import ContactForm from "./components/ContactForm";
import PricingOverviewModal from "./components/PricingOverviewModal";
import FloatingAssistant from "./components/FloatingAssistant";
import {
  User,
  PDFDocument,
  ChatSession,
  DashboardStats,
  AuthResponse,
} from "./types";

// Establish a default, eye-pleasing theme state
export default function App() {
  const [token, setToken] = useState<string | null>(
    localStorage.getItem("documind_token"),
  );
  const [user, setUser] = useState<User | null>(null);

  // Public Modals / Hangar States
  const [showAbout, setShowAbout] = useState(false);
  const [showContact, setShowContact] = useState(false);
  const [showPricingPopup, setShowPricingPopup] = useState(false);
  const [showAuthForm, setShowAuthForm] = useState(false);

  const [activeTab, setActiveTab] = useState<
    "dashboard" | "chat" | "billing" | "admin"
  >("dashboard");
  const [loading, setLoading] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);

  // Core Data models
  const [stats, setStats] = useState<DashboardStats>({
    totalDocs: 0,
    totalChunks: 0,
    totalChats: 0,
    storageUsed: 0,
  });
  const [pdfs, setPdfs] = useState<PDFDocument[]>([]);
  const [sessions, setSessions] = useState<ChatSession[]>([]);

  // 1. Initial Profile Recovery
  useEffect(() => {
    if (!token) return;

    const fetchProfile = async () => {
      try {
        const res = await fetch("/api/auth/me", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Session expired");
        }

        setUser(data);
      } catch (e) {
        handleLogout();
      }
    };

    fetchProfile();
  }, [token, refreshTrigger]);

  // 2. Fetch Dashboard Content & AI Conversations
  useEffect(() => {
    if (!token || !user) return;

    const fetchData = async () => {
      try {
        // Fetch stats
        const statsRes = await fetch("/api/stats", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (statsRes.ok) {
          const statsData = await statsRes.json();
          setStats(statsData);
        }

        // Fetch PDFs list
        const pdfRes = await fetch("/api/pdf", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (pdfRes.ok) {
          const pdfData = await pdfRes.json();
          setPdfs(pdfData);
        }

        // Fetch Chat sessions
        const chatRes = await fetch("/api/chats", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (chatRes.ok) {
          const chatData = await chatRes.json();
          setSessions(chatData);
        }
      } catch (err) {
        console.error("Error fetching dashboard indices:", err);
      }
    };

    fetchData();
  }, [token, user, refreshTrigger]);

  const handleAuthSuccess = (data: AuthResponse) => {
    localStorage.setItem("documind_token", data.token);
    setToken(data.token);
    setUser(data.user);
  };

  const handleLogout = () => {
    localStorage.removeItem("documind_token");
    setToken(null);
    setUser(null);
    setActiveTab("dashboard");
  };

  const forceRefresh = () => {
    setRefreshTrigger((prev: number) => prev + 1);
  };

  // If fetching authentic identity, display loading screen
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center font-sans">
        <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center animate-spin mb-4">
          <BrainCircuit className="h-6 w-6 text-slate-950 stroke-[2.5]" />
        </div>
        <p className="text-slate-400 font-semibold text-xs uppercase tracking-widest animate-pulse">
          Decrypting secured memory vault...
        </p>
      </div>
    );
  }

  // If guest, show Authentication Landing
  if (!token || !user) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans relative overflow-x-hidden overflow-y-auto">
        {/* Aesthetic global landing header */}
        <header className="border-b border-slate-900 bg-slate-950/80 backdrop-blur-md sticky top-0 z-40 px-3 py-2.5 sm:px-6 sm:py-4 select-none">
          <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
            {/* Left: brand */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <div className="h-5 w-5 sm:h-6 sm:w-6 rounded-md bg-gradient-to-br from-indigo-505 to-cyan-505 bg-indigo-500 flex items-center justify-center shrink-0">
                <BrainCircuit className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-slate-950 stroke-[2.5]" />
              </div>
              <span className="font-bold text-[11px] sm:text-xs tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent shrink-0">
                DocuMind AI
              </span>
            </div>

            {/* Center: About / Contact / Pricing (explicitly centered) */}
            <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-1.5 sm:gap-3 text-[11px] sm:text-xs font-bold">
              <button
                onClick={() => setShowAbout(true)}
                className="px-1.5 sm:px-2.5 py-1 sm:py-1.5 rounded-lg hover:bg-slate-900 text-slate-400 hover:text-slate-100 transition cursor-pointer select-none font-semibold"
              >
                About
              </button>
              <button
                onClick={() => setShowContact(true)}
                className="px-1.5 sm:px-2.5 py-1 sm:py-1.5 rounded-lg hover:bg-slate-900 text-slate-400 hover:text-slate-100 transition cursor-pointer select-none font-semibold"
              >
                Contact
              </button>
              <button
                onClick={() => setShowPricingPopup(true)}
                className="px-1.5 sm:px-2.5 py-1 sm:py-1.5 rounded-lg hover:bg-slate-900 text-slate-400 hover:text-slate-100 transition cursor-pointer select-none font-semibold"
              >
                Pricing
              </button>
            </div>

            {/* Right: CTA */}
            <button
              onClick={() => setShowAuthForm(true)}
              className="inline-flex px-2.5 sm:px-3.5 py-1.2 sm:py-1.5 bg-gradient-to-r from-indigo-500 to-cyan-500 hover:from-indigo-600 hover:to-cyan-600 rounded-lg sm:rounded-xl font-bold text-slate-950 transition-all hover:scale-[1.03] active:scale-[0.97] cursor-pointer text-[10.5px] sm:text-[11px] select-none shrink-0"
            >
              Get Started
            </button>
          </div>
        </header>

        {/* Global Modals for Guests */}
        <AnimatePresence>
          {showAbout && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/95 backdrop-blur-md">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-slate-900 border border-slate-850 rounded-2xl w-full max-w-xl overflow-hidden relative shadow-2xl p-6 md:p-8 space-y-5"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between border-b border-slate-850 pb-4">
                  <div className="flex items-center gap-2 text-indigo-400">
                    <BrainCircuit className="h-5 w-5" />
                    <h3 className="text-sm font-bold text-slate-100">
                      About DocuMind AI
                    </h3>
                  </div>
                  <button
                    onClick={() => setShowAbout(false)}
                    className="p-1.5 rounded-lg hover:bg-slate-850 text-slate-400 hover:text-slate-200 transition cursor-pointer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="space-y-4 text-xs text-slate-300 leading-relaxed max-h-[60vh] overflow-y-auto pr-1">
                  <div className="space-y-1.5">
                    <div className="text-[10px] text-indigo-400 uppercase tracking-widest font-extrabold font-mono">
                      Executive Profile
                    </div>
                    <p className="text-slate-100 font-bold text-[13px]">
                      Kassahun Mulatu{" "}
                      <span className="text-xs font-normal text-slate-500">
                        • CEO &amp; Founder
                      </span>
                    </p>
                    <p className="text-slate-400">
                      Under the visionary leadership of Kassahun Mulatu,
                      DocuMind AI was founded to bridge the gap between heavy,
                      unsearchable documents and rapid-response document
                      insights. We believe your time belongs to analysis, not
                      scanning pages.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <div className="text-[10px] text-cyan-400 uppercase tracking-widest font-extrabold font-mono">
                      Our Mission
                    </div>
                    <p className="text-slate-400">
                      To empower professionals, researchers, students, and
                      businesses with secure, high-utility, context-aware
                      artificial intelligence capable of reading, parsing, and
                      summarizing extremely dense PDF resources in seconds.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <div className="text-[10px] text-purple-400 uppercase tracking-widest font-extrabold font-mono font-bold font-semibold">
                      Vision &amp; Future Statement
                    </div>
                    <p className="text-slate-400">
                      DocuMind AI seeks to become the leading intelligence
                      companion globally for deep knowledge querying, offering
                      unrestricted semantic context searches and absolute
                      structural analysis with uncompromised customer security.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <div className="text-[10px] text-amber-500 uppercase tracking-widest font-extrabold font-mono font-bold font-bold">
                      Purpose of the finding
                    </div>
                    <p className="text-slate-400">
                      Faced with massive PDF books and complex research reports,
                      standard keyword searches fall short of grasping context.
                      DocuMind AI uses advanced vector search matching and
                      recursive text parsing to provide precise answers backed
                      by citations.
                    </p>
                  </div>
                </div>

                <div className="border-t border-slate-850 pt-4 flex justify-end">
                  <button
                    onClick={() => setShowAbout(false)}
                    className="px-4 py-2 bg-slate-950 font-semibold hover:bg-slate-800 text-slate-300 duration-155 rounded-xl text-xs cursor-pointer border border-slate-850"
                  >
                    Close Overview
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showContact && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/95 backdrop-blur-md"
              onClick={() => setShowContact(false)}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-slate-900 border border-slate-850 rounded-2xl w-full max-w-lg overflow-hidden relative shadow-2xl p-6 md:p-8 space-y-6"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between border-b border-slate-850 pb-4">
                  <div className="flex items-center gap-2 text-indigo-400">
                    <Mail className="h-5 w-5" />
                    <h3 className="text-sm font-bold text-slate-100 tracking-tight">
                      Contact Us (CEO: Kassahun Mulatu)
                    </h3>
                  </div>
                  <button
                    onClick={() => setShowContact(false)}
                    className="p-1.5 rounded-lg hover:bg-slate-850 text-slate-400 hover:text-slate-205 transition cursor-pointer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <ContactForm onClose={() => setShowContact(false)} />
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showPricingPopup && (
            <PricingOverviewModal
              onClose={() => setShowPricingPopup(false)}
              onGetStarted={() => {
                setShowPricingPopup(false);
                setShowAuthForm(true);
              }}
            />
          )}
        </AnimatePresence>

        <div className="flex-1 flex flex-col justify-center py-8">
          <AuthScreen
            onAuthSuccess={handleAuthSuccess}
            showForm={showAuthForm}
            setShowForm={setShowAuthForm}
          />
        </div>

        {/* 2-Columns Responsive Landing Page Footer */}
        <footer className="pt-10 pb-6 border-t border-slate-900/85 text-xs text-slate-400 select-none bg-slate-950">
          <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 pb-8 px-6">
            {/* Column 1: Brand details */}
            <div className="space-y-3 text-left">
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded-md bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center shrink-0">
                  <BrainCircuit className="h-3.5 w-3.5 text-slate-950 stroke-[2.5]" />
                </div>
                <span className="font-bold text-sm tracking-tight text-slate-100">
                  DocuMind AI
                </span>
              </div>
              <p className="text-[11px] leading-relaxed text-slate-400">
                A high-performance intelligence workspace engineered to extract,
                index, and query unstructured documents at extreme speeds using
                custom semantic vectors.
              </p>
              <div className="text-[10px] text-slate-500 font-mono">
                Engine Version: v2.1.0-Release
              </div>
            </div>

            {/* Column 2: Navigation links */}
            <div className="space-y-4 text-left">
              <h4 className="font-extrabold uppercase text-[10px] tracking-wider text-slate-200">
                Company &amp; Service
              </h4>
              <ul className="space-y-2.5 font-medium text-[11px]">
                <li>
                  <button
                    onClick={() => setShowAbout(true)}
                    className="text-slate-400 hover:text-indigo-400 transition cursor-pointer flex items-center gap-1.5"
                  >
                    <Info className="h-3 w-3 text-indigo-400 shrink-0" />
                    About us
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => setShowPricingPopup(true)}
                    className="text-slate-400 hover:text-indigo-400 transition cursor-pointer flex items-center gap-1.5"
                  >
                    <CreditCard className="h-3 w-3 text-indigo-400 shrink-0" />
                    Pricing
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => setShowContact(true)}
                    className="text-slate-400 hover:text-indigo-400 transition cursor-pointer flex items-center gap-1.5"
                  >
                    <Mail className="h-3 w-3 text-indigo-400 shrink-0" />
                    Contact us
                  </button>
                </li>
              </ul>
            </div>

            {/* Column 3: Contact details */}
            <div className="space-y-4 text-left">
              <h4 className="font-extrabold uppercase text-[10px] tracking-wider text-slate-200">
                Contact Us
              </h4>
              <div className="space-y-2.5 text-[11px] font-medium text-slate-400">
                <div className="flex items-start gap-2">
                  <MapPin className="h-3.5 w-3.5 text-cyan-400 shrink-0 mt-0.5" />
                  <span>Address: Bahir Dar, Ethiopia</span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
                  <a
                    href="mailto:kmulatu21@gmail.com"
                    className="hover:text-cyan-400 transition select-all"
                  >
                    Email: kmulatu21@gmail.com
                  </a>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
                  <a
                    href="tel:0915508167"
                    className="hover:text-cyan-400 transition select-all"
                  >
                    Mobile: 0915508167
                  </a>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-900/60 bg-slate-950/40 px-4 py-4 text-center text-[10px] text-slate-500 font-medium font-sans">
            &copy; {new Date().getFullYear()} DocuMind AI. All rights reserved.
            Built by Kassahun Mulatu
          </div>
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans relative overflow-hidden select-none">
      {/* Visual Ambient Light Spots */}
      <div className="absolute top-[-20%] right-[-10%] w-[60%] h-[60%] rounded-full bg-indigo-500/5 blur-[150px] pointer-events-none" />
      <div className="absolute bottom-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-cyan-500/5 blur-[150px] pointer-events-none" />

      {/* 1. Global Navigation Bar */}
      <header className="border-b border-slate-900 bg-slate-950/80 backdrop-blur-md sticky top-0 z-40 select-none px-4 py-3 md:px-6 md:py-4 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        {/* Row 1 / Left section: Logo & Hangar Links */}
        <div className="w-full xl:w-auto flex flex-col sm:flex-row items-center justify-between xl:justify-start gap-4 flex-wrap">
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <div className="h-5 w-5 sm:h-6 sm:w-6 rounded-md bg-gradient-to-br from-indigo-505 to-cyan-505 bg-indigo-500 flex items-center justify-center shrink-0">
              <BrainCircuit className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-slate-950 stroke-[2.5]" />
            </div>
            <span className="font-bold text-[11px] sm:text-xs tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent shrink-0">
              DocuMind AI
            </span>
          </div>

          <div className="h-4 w-px bg-slate-800/80 hidden sm:block shrink-0" />

          {/* Hangar Links */}
          <div className="flex items-center gap-1 sm:gap-2 text-[10.5px] font-extrabold text-slate-400">
            <button
              onClick={() => setShowAbout(true)}
              className="hover:text-slate-100 px-2 py-1 hover:bg-slate-900/40 rounded-lg transition cursor-pointer select-none"
            >
              About Us
            </button>
            <button
              onClick={() => setShowContact(true)}
              className="hover:text-slate-100 px-2 py-1 hover:bg-slate-900/40 rounded-lg transition cursor-pointer select-none"
            >
              Contact Us
            </button>
            <button
              onClick={() => setActiveTab("billing")}
              className={`hover:text-slate-100 px-2 py-1 hover:bg-slate-900/40 rounded-lg transition cursor-pointer select-none ${
                activeTab === "billing" ? "text-indigo-400 bg-indigo-550/5" : ""
              }`}
            >
              Pricing
            </button>
          </div>
        </div>

        {/* Tab route control widgets - Centered on mobile and desktop */}
        <div className="w-full xl:w-auto flex flex-wrap justify-center items-center gap-1.5 p-1 bg-slate-900/50 rounded-xl border border-slate-800/65 max-w-full overflow-x-auto">
          <button
            onClick={() => setActiveTab("dashboard")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold tracking-wide transition flex items-center gap-1.5 cursor-pointer shrink-0 ${
              activeTab === "dashboard"
                ? "bg-gradient-to-r from-indigo-505 to-cyan-505 bg-indigo-500 text-slate-900"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/30"
            }`}
          >
            <LayoutDashboard className="h-3.5 w-3.5" />{" "}
            <span className="hidden sm:inline">Document Vault</span>
            <span className="sm:hidden">Vault</span>
          </button>

          <button
            onClick={() => setActiveTab("chat")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold tracking-wide transition flex items-center gap-1.5 cursor-pointer shrink-0 ${
              activeTab === "chat"
                ? "bg-gradient-to-r from-indigo-505 to-cyan-505 bg-indigo-500 text-slate-900"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/30"
            }`}
          >
            <MessageSquareLock className="h-3.5 w-3.5" />{" "}
            <span className="hidden sm:inline">Q&amp;A Agent</span>
            <span className="sm:hidden">Q&amp;A</span>
          </button>

          <button
            onClick={() => setActiveTab("billing")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold tracking-wide transition flex items-center gap-1.5 cursor-pointer relative shrink-0 ${
              activeTab === "billing"
                ? "bg-gradient-to-r from-indigo-505 to-cyan-505 bg-indigo-500 text-slate-900"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/30"
            }`}
          >
            <CreditCard className="h-3.5 w-3.5" />{" "}
            <span className="hidden sm:inline">Pricing</span>
            <span className="sm:hidden">Price</span>
            {user.tier === "free" && (user.promptCount || 0) >= 5 && (
              <span className="absolute -top-1.5 -right-1 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
              </span>
            )}
          </button>

          {user.role === "admin" && (
            <button
              onClick={() => setActiveTab("admin")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold tracking-wide transition flex items-center gap-1.5 cursor-pointer shrink-0 ${
                activeTab === "admin"
                  ? "bg-gradient-to-r from-indigo-505 to-cyan-505 bg-indigo-500 text-slate-900"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/30"
              }`}
            >
              <Users className="h-3.5 w-3.5" />{" "}
              <span className="hidden sm:inline">Admin Console</span>
              <span className="sm:hidden">Admin</span>
            </button>
          )}
        </div>

        {/* Identity & Session Control */}
        <div className="w-full xl:w-auto flex items-center justify-center xl:justify-end gap-3 md:gap-4 text-xs font-medium text-slate-400 flex-wrap">
          {user.role !== "admin" && (
            <button
              onClick={async () => {
                try {
                  const res = await fetch("/api/auth/make-admin", {
                    method: "POST",
                    headers: { Authorization: `Bearer ${token}` },
                  });
                  if (res.ok) {
                    forceRefresh();
                    setActiveTab("admin");
                  }
                } catch (e) {
                  console.error(e);
                }
              }}
              className="px-2.5 py-1.5 bg-indigo-500/10 hover:bg-indigo-500 hover:text-slate-950 border border-indigo-500/20 text-indigo-400 text-[10px] font-bold uppercase rounded-lg transition-all cursor-pointer whitespace-nowrap shrink-0"
              title="Promote yourself to administrator instantly to test payment approvals"
            >
              Test Admin View
            </button>
          )}

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-850 bg-slate-900/30 shrink-0">
            <UserCheck
              className={`h-3.5 w-3.5 ${user.role === "admin" ? "text-amber-400" : "text-emerald-400"}`}
            />
            <span className="truncate max-w-[100px] font-semibold text-slate-300">
              {user.name} {user.role === "admin" && "(Admin)"}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={forceRefresh}
              className="p-2 hover:bg-slate-900 rounded-xl border border-slate-850 hover:text-white transition cursor-pointer text-slate-500"
              title="Reload indices"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>

            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 py-2 px-3 hover:bg-red-500/10 hover:text-red-400 border border-transparent hover:border-red-500/20 rounded-xl transition cursor-pointer text-slate-400 font-bold"
            >
              <LogOut className="h-3.5 w-3.5" /> Logout
            </button>
          </div>
        </div>
      </header>

      {/* 2. Main Tab Viewport */}
      <main className="flex-1 p-6 md:p-8 overflow-y-auto">
        <AnimatePresence mode="wait">
          {activeTab === "dashboard" && (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.2 }}
            >
              <DashboardTab
                stats={stats}
                pdfs={pdfs}
                authToken={token}
                onRefresh={forceRefresh}
                user={user}
              />
            </motion.div>
          )}

          {activeTab === "chat" && (
            <motion.div
              key="chat"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.2 }}
            >
              <ChatTab
                sessions={sessions}
                pdfs={pdfs}
                authToken={token}
                onRefreshSessions={forceRefresh}
                user={user}
                onRefreshUser={forceRefresh}
                onSwitchToBilling={() => setActiveTab("billing")}
              />
            </motion.div>
          )}

          {activeTab === "billing" && (
            <motion.div
              key="billing"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.2 }}
            >
              <BillingTab
                user={user}
                authToken={token!}
                onRefreshUser={forceRefresh}
              />
            </motion.div>
          )}

          {activeTab === "admin" && user.role === "admin" && (
            <motion.div
              key="admin"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.2 }}
            >
              <AdminTab
                authToken={token!}
                currentUserEmail={user.email}
                onRefreshCurrentUser={forceRefresh}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* 3. Fully Responsive Premium Footer */}
        <footer className="mt-16 pt-8 border-t border-slate-900/85 text-xs text-slate-400 select-none">
          <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 pb-8 px-2 animate-fade-in">
            {/* Column 1: Brand details */}
            <div className="space-y-3 text-left">
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded-md bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center shrink-0">
                  <BrainCircuit className="h-3.5 w-3.5 text-slate-950 stroke-[2.5]" />
                </div>
                <span className="font-bold text-sm tracking-tight text-slate-100">
                  Documind AI
                </span>
              </div>
              <p className="text-[11px] leading-relaxed text-slate-400">
                A high-performance intelligence workspace engineered to extract,
                index, and query unstructured documents at extreme speeds using
                custom semantic vectors.
              </p>
              <div className="text-[10px] text-slate-500 font-mono">
                Engine Version: v2.1.0-Release
              </div>
            </div>

            {/* Column 2: Navigation links */}
            <div className="space-y-4 text-left">
              <h4 className="font-extrabold uppercase text-[10px] tracking-wider text-slate-200">
                Company &amp; Service
              </h4>
              <ul className="space-y-2.5 font-medium text-[11px]">
                <li>
                  <button
                    onClick={() => setShowAbout(true)}
                    className="text-slate-400 hover:text-indigo-400 transition cursor-pointer flex items-center gap-1.5"
                  >
                    <Info className="h-3 w-3 text-indigo-400 shrink-0" />
                    About us
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => setActiveTab("billing")}
                    className="text-slate-400 hover:text-indigo-400 transition cursor-pointer flex items-center gap-1.5"
                  >
                    <CreditCard className="h-3 w-3 text-indigo-400 shrink-0" />
                    Pricing
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => setShowContact(true)}
                    className="text-slate-400 hover:text-indigo-400 transition cursor-pointer flex items-center gap-1.5"
                  >
                    <Mail className="h-3 w-3 text-indigo-400 shrink-0" />
                    Contact us
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => setActiveTab("dashboard")}
                    className="text-slate-400 hover:text-indigo-400 transition cursor-pointer flex items-center gap-1.5"
                  >
                    <LayoutDashboard className="h-3 w-3 text-indigo-400 shrink-0" />
                    Document Vault
                  </button>
                </li>
              </ul>
            </div>

            {/* Column 3: Contact coords */}
            <div className="space-y-4 text-left">
              <h4 className="font-extrabold uppercase text-[10px] tracking-wider text-slate-200">
                Contact Us
              </h4>
              <div className="space-y-2.5 text-[11px] font-medium text-slate-400">
                <div className="flex items-start gap-2">
                  <MapPin className="h-3.5 w-3.5 text-cyan-400 shrink-0 mt-0.5" />
                  <span>Address: Bahir Dar, Ethiopia</span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
                  <a
                    href="mailto:kmulatu21@gmail.com"
                    className="hover:text-cyan-400 transition select-all"
                  >
                    Email: kmulatu21@gmail.com
                  </a>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
                  <a
                    href="tel:0915508167"
                    className="hover:text-cyan-400 transition select-all"
                  >
                    Mobile: 0915508167
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Sub-copyright frame */}
          <div className="border-t border-slate-900/60 bg-slate-950/40 px-4 py-4 text-center text-[10px] text-slate-500 font-medium">
            &copy; {new Date().getFullYear()} Documind AI. All rights reserved.
            Built by Kassahun Mulatu
          </div>
        </footer>
      </main>

      {/* Floating AI Assistant (static website knowledge) */}
      <FloatingAssistant />

      {/* Shared Overlays for authenticated users */}
      <AnimatePresence>
        {showAbout && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/95 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900 border border-slate-850 rounded-2xl w-full max-w-xl overflow-hidden relative shadow-2xl p-6 md:p-8 space-y-5"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-slate-850 pb-4">
                <div className="flex items-center gap-2 text-indigo-400">
                  <BrainCircuit className="h-5 w-5" />
                  <h3 className="text-sm font-bold text-slate-100">
                    About DocuMind AI
                  </h3>
                </div>
                <button
                  onClick={() => setShowAbout(false)}
                  className="p-1.5 rounded-lg hover:bg-slate-850 text-slate-400 hover:text-slate-200 transition cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-4 text-xs text-slate-300 leading-relaxed max-h-[60vh] overflow-y-auto pr-1">
                <div className="space-y-1.5 font-normal">
                  <div className="text-[10px] text-indigo-400 uppercase tracking-widest font-extrabold font-mono">
                    Executive Profile
                  </div>
                  <p className="text-slate-100 font-bold text-[13px]">
                    Kassahun Mulatu{" "}
                    <span className="text-xs font-normal text-slate-500">
                      • CEO &amp; Founder
                    </span>
                  </p>
                  <p className="text-slate-400">
                    Under the visionary leadership of Kassahun Mulatu, DocuMind
                    AI was founded to bridge the gap between heavy, unsearchable
                    documents and rapid-response document insights. We believe
                    your time belongs to analysis, not scanning pages.
                  </p>
                </div>

                <div className="space-y-1.5 font-normal">
                  <div className="text-[10px] text-cyan-400 uppercase tracking-widest font-extrabold font-mono font-bold">
                    Our Mission
                  </div>
                  <p className="text-slate-400">
                    To empower professionals, researchers, students, and
                    businesses with secure, high-utility, context-aware
                    artificial intelligence capable of reading, parsing, and
                    summarizing extremely dense PDF resources in seconds.
                  </p>
                </div>

                <div className="space-y-1.5 font-normal font-medium">
                  <div className="text-[10px] text-purple-400 uppercase tracking-widest font-extrabold font-mono">
                    Vision &amp; Future Statement
                  </div>
                  <p className="text-slate-400">
                    DocuMind AI seeks to become the leading intelligence
                    companion globally for deep knowledge querying, offering
                    unrestricted semantic context searches and absolute
                    structural analysis with uncompromised customer security.
                  </p>
                </div>

                <div className="space-y-1.5 font-normal font-semibold">
                  <div className="text-[10px] text-amber-500 uppercase tracking-widest font-extrabold font-mono">
                    Purpose of the finding
                  </div>
                  <p className="text-slate-400">
                    Faced with massive PDF books and complex research reports,
                    standard keyword searches fall short of grasping context.
                    DocuMind AI uses advanced vector search matching and
                    recursive text parsing to provide precise answers backed by
                    citations.
                  </p>
                </div>
              </div>

              <div className="border-t border-slate-850 pt-4 flex justify-end">
                <button
                  onClick={() => setShowAbout(false)}
                  className="px-4 py-2 bg-slate-950 font-semibold hover:bg-slate-800 text-slate-300 duration-155 rounded-xl text-xs cursor-pointer border border-slate-850"
                >
                  Close Overview
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showContact && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/95 backdrop-blur-md"
            onClick={() => setShowContact(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900 border border-slate-850 rounded-2xl w-full max-w-lg overflow-hidden relative shadow-2xl p-6 md:p-8 space-y-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-slate-850 pb-4">
                <div className="flex items-center gap-2 text-indigo-400">
                  <Mail className="h-5 w-5" />
                  <h3 className="text-sm font-bold text-slate-100 tracking-tight font-bold">
                    Contact Us (CEO: Kassahun Mulatu)
                  </h3>
                </div>
                <button
                  onClick={() => setShowContact(false)}
                  className="p-1.5 rounded-lg hover:bg-slate-850 text-slate-400 hover:text-slate-205 transition cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <ContactForm onClose={() => setShowContact(false)} />
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
