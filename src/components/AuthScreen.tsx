import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Mail,
  Lock,
  User,
  FileText,
  ArrowRight,
  ShieldCheck,
  Database,
  BrainCircuit,
  Sparkles,
  X,
  ShieldAlert,
  Eye,
  EyeOff,
} from "lucide-react";
import { AuthResponse } from "../types";

interface AuthScreenProps {
  onAuthSuccess: (data: AuthResponse) => void;
  showForm: boolean;
  setShowForm: (show: boolean) => void;
}

export default function AuthScreen({
  onAuthSuccess,
  showForm,
  setShowForm,
}: AuthScreenProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Auto scroll to top when form is displayed
  React.useEffect(() => {
    if (showForm) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      const mainContainer =
        document.getElementById("main-landing-container") ||
        document.querySelector(".overflow-y-auto");
      if (mainContainer) {
        mainContainer.scrollTo({ top: 0, behavior: "smooth" });
      }
    }
  }, [showForm]);

  // Manual admin modal verification states
  const [showAdminPrompt, setShowAdminPrompt] = useState(false);
  const [adminPromptEmail, setAdminPromptEmail] = useState("");
  const [adminPromptPassword, setAdminPromptPassword] = useState("");
  const [adminPromptError, setAdminPromptError] = useState("");
  const [adminPromptLoading, setAdminPromptLoading] = useState(false);
  const [showAdminPassword, setShowAdminPassword] = useState(false);

  // Direct fast login for system admin (kmulatu21@gmail.com / admin@docmind)
  const handleAdminQuickAccess = async () => {
    setError("");
    setLoading(true);

    const adminEmail = "kmulatu21@gmail.com";
    const adminPassword = "admin@docmind";

    try {
      const loginRes = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: adminEmail, password: adminPassword }),
      });

      const loginData = await loginRes.json();

      if (!loginRes.ok) {
        throw new Error(
          loginData.error ||
            "Identity verification failed. Admin account error.",
        );
      }

      onAuthSuccess(loginData);
    } catch (err: any) {
      console.error("Admin quick login error:", err);
      setError(err.message || "Connecting to administrative session failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAdminPrompt = () => {
    setAdminPromptEmail("");
    setAdminPromptPassword("");
    setAdminPromptError("");
    setShowAdminPrompt(true);
  };

  const handleVerifyAdminPrompt = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminPromptError("");
    setAdminPromptLoading(true);

    const targetEmail = adminPromptEmail.trim().toLowerCase();
    const targetPassword = adminPromptPassword.trim();

    // Support both strict matching and gracefully trimmed versions
    if (
      targetEmail !== "kmulatu21@gmail.com" ||
      (adminPromptPassword !== "admin@docmind" &&
        targetPassword !== "admin@docmind")
    ) {
      setAdminPromptError(
        "Access Denied: Invalid administrator email or password.",
      );
      setAdminPromptLoading(false);
      return;
    }

    try {
      const loginRes = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: targetEmail, password: "admin@docmind" }), // Send pristine credentials to server
      });

      const loginData = await loginRes.json();

      if (!loginRes.ok) {
        throw new Error(
          loginData.error ||
            "Identity verification failed. Account missing on instance database.",
        );
      }

      onAuthSuccess(loginData);
      setShowAdminPrompt(false);
    } catch (err: any) {
      console.error("Admin manual login error:", err);
      setAdminPromptError(
        err.message || "Connecting to security server failed.",
      );
    } finally {
      setAdminPromptLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setError("");
    setLoading(true);

    const demoEmail = "demo@documind.ai";
    const demoPassword = "demopassword123";
    const demoName = "Demo Scholar";

    try {
      // Step A: First try to log in
      const loginRes = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: demoEmail, password: demoPassword }),
      });

      const loginData = await loginRes.json();

      // Step B: If credentials don't exist yet on database, register the account and sign in
      if (
        !loginRes.ok &&
        (loginRes.status === 401 || loginRes.status === 404)
      ) {
        const regRes = await fetch("/api/auth/register", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: demoName,
            email: demoEmail,
            password: demoPassword,
          }),
        });

        const regData = await regRes.json();
        if (regRes.ok) {
          onAuthSuccess(regData);
          return;
        } else {
          throw new Error(
            regData.error || "Failed to auto-register demo user account",
          );
        }
      }

      if (!loginRes.ok) {
        throw new Error(
          loginData.error || "Failed to connect sandbox user session",
        );
      }

      onAuthSuccess(loginData);
    } catch (err: any) {
      console.error("Demo registration connection error:", err);
      setError(
        err.message || "Connecting to demo sandbox configuration failed",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const url = isLogin ? "/api/auth/login" : "/api/auth/register";
    const payload = isLogin ? { email, password } : { name, email, password };

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      // Some failures may return empty bodies (or non-JSON). Avoid crashing on .json() parsing.
      const resText = await response.text();
      let data: any = {};
      if (resText) {
        try {
          data = JSON.parse(resText);
        } catch {
          data = { error: resText };
        }
      }

      if (!response.ok) {
        // Improve debuggability on Vercel where the server might return non-JSON.
        const serverError = data?.error || data?.message || data?.details;
        const fallback = serverError || resText || "Authentication failed";
        throw new Error(fallback);
      }

      onAuthSuccess(data);
    } catch (err: any) {
      setError(err.message || "Connecting to server failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={`flex-1 w-full bg-slate-950 text-slate-100 flex ${showForm ? "flex-col-reverse" : "flex-col"} lg:flex-row relative overflow-y-auto lg:overflow-hidden font-sans`}
    >
      {/* Decorative Blur Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-500/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-cyan-500/10 blur-[120px] pointer-events-none" />

      {/* Hero Branding Section (Left) */}
      <div className="flex-1 flex flex-col justify-between p-6 sm:p-10 lg:p-16 relative z-10 select-none">
        <div className="max-w-xl my-auto py-6 lg:py-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 text-xs font-medium mb-6">
              <Database className="h-3.5 w-3.5" /> Permanent PDF Intelligence
              Assistant
            </span>
          </motion.div>

          <motion.h1
            className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight text-white mb-6 leading-tight"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            Connect Your PDFs.
            <br />
            <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent">
              Extract AI Insights.
            </span>
          </motion.h1>

          <motion.p
            className="text-slate-400 text-lg leading-relaxed mb-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            DocuMind permanently preserves your academic papers, banks records,
            legal briefs, medical papers, or corporate documents, giving you a
            custom intelligent chat model that speaks precisely based on your
            private uploads.
          </motion.p>

          <motion.div
            className="grid grid-cols-1 sm:grid-cols-2 gap-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            <div className="flex gap-3 p-3.5 rounded-2xl border border-slate-800/80 bg-slate-900/50 backdrop-blur-md">
              <ShieldCheck className="h-5 w-5 text-indigo-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-semibold text-slate-200">
                  Semantic Search Extraction
                </h4>
                <p className="text-xs text-slate-500 mt-1 leading-normal">
                  Deep document similarity logic to query exact paragraph
                  matches.
                </p>
              </div>
            </div>
            <div className="flex gap-3 p-3.5 rounded-2xl border border-slate-800/80 bg-slate-900/50 backdrop-blur-md">
              <FileText className="h-5 w-5 text-cyan-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-semibold text-slate-200">
                  Permanent Memory Bank
                </h4>
                <p className="text-xs text-slate-500 mt-1 leading-normal">
                  Safely persist PDF books, lectures, and files in your
                  workspace.
                </p>
              </div>
            </div>
          </motion.div>
        </div>

        <div className="text-xs text-slate-600">
          © 2026 DocuMind AI Corp. All intellectual structures preserved.
        </div>
      </div>

      {/* Authentication Form Overlay (Right) */}
      <div
        className={`flex-1 flex ${showForm ? "items-start pt-4 sm:pt-10 lg:pt-16" : "items-center"} justify-center p-6 md:p-12 relative z-10`}
      >
        <AnimatePresence mode="wait">
          {!showForm ? (
            <motion.div
              key="onboarding-cta"
              className="w-full max-w-md p-8 rounded-3xl border border-slate-800 bg-slate-900/40 backdrop-blur-xl shadow-2xl relative text-center space-y-6 flex flex-col justify-center items-center py-10"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3 }}
            >
              {/* Pulsing indicator orb */}
              <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500/10 to-cyan-500/10 border border-indigo-550/20 shadow-inner">
                <BrainCircuit className="h-7 w-7 text-indigo-400 stroke-[1.5]" />
                <div className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-cyan-500 ring-4 ring-slate-900/50 animate-ping" />
                <div className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-cyan-400" />
              </div>

              <div className="space-y-2 select-none">
                <h3 className="text-2xl font-bold bg-gradient-to-r from-white via-slate-100 to-slate-450 bg-clip-text text-transparent">
                  Accelerate Reference Retrieval
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed max-w-sm mx-auto">
                  Connect your engineering papers, dense PDF specifications, or
                  research textbooks. Ask questions, locate citations, and
                  acquire verified highlights instantly.
                </p>
              </div>

              {/* Glowing CTA Button */}
              <button
                onClick={() => setShowForm(true)}
                className="group relative w-full py-3.5 rounded-xl bg-gradient-to-r from-indigo-500 to-cyan-500 text-slate-950 font-bold tracking-wider hover:opacity-95 transition-all text-sm flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-indigo-500/15 overflow-hidden active:scale-[0.98]"
              >
                Get started
                <ArrowRight className="h-4 w-4 stroke-[2.5] group-hover:translate-x-0.5 transition-transform" />
              </button>

              <div className="text-[10px] text-slate-500 font-mono select-none">
                Secure File Vaults • Semantic Vector Extraction
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="auth-card"
              className="w-full max-w-md p-8 rounded-3xl border border-slate-800 bg-slate-900/60 backdrop-blur-xl shadow-2xl relative"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3 }}
            >
              {/* Glass accent bar */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-1 bg-gradient-to-r from-indigo-500 to-cyan-500 rounded-b-xl" />

              {/* Close/Return to Onboarding */}
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-slate-300 transition cursor-pointer"
                title="Back to landing"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="text-center mb-8">
                <h2 className="text-2xl font-bold bg-gradient-to-r from-slate-50 to-slate-200 bg-clip-text text-transparent">
                  {isLogin ? "Welcome Back" : "Create Intelligence Base"}
                </h2>
                <p className="text-slate-400 text-sm mt-2">
                  {isLogin
                    ? "Access your private text knowledge model"
                    : "Register and start indexing your PDF database"}
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                {error && (
                  <div className="p-3.5 rounded-xl border border-red-500/20 bg-red-500/10 text-red-400 text-sm text-center">
                    {error}
                  </div>
                )}

                {!isLogin && (
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Full Name
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-500">
                        <User className="h-4.5 w-4.5" />
                      </span>
                      <input
                        type="text"
                        required
                        placeholder="Enter your name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full pl-10.5 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-sm focus:outline-none focus:border-indigo-500 placeholder-slate-600 transition"
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Email Address
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-500">
                      <Mail className="h-4.5 w-4.5" />
                    </span>
                    <input
                      type="email"
                      required
                      placeholder="name@organization.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-10.5 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-sm focus:outline-none focus:border-indigo-500 placeholder-slate-600 transition"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Password
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-500">
                      <Lock className="h-4.5 w-4.5" />
                    </span>
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      placeholder="••••••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-10.5 pr-12 py-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-sm focus:outline-none focus:border-indigo-500 placeholder-slate-600 transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-500 hover:text-slate-300 transition cursor-pointer"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                {!isLogin && (
                  <div className="flex items-start gap-2.5 pt-1 pb-1 select-none text-left">
                    <input
                      type="checkbox"
                      id="terms-agreement"
                      required
                      defaultChecked={true}
                      className="mt-0.5 h-3.5 w-3.5 rounded border-slate-800 bg-slate-950 text-indigo-500 focus:ring-0 cursor-pointer accent-indigo-500"
                    />
                    <label
                      htmlFor="terms-agreement"
                      className="text-[11px] text-slate-400 leading-snug cursor-pointer font-medium"
                    >
                      I agree to the{" "}
                      <span className="text-indigo-400 hover:text-indigo-300 hover:underline font-semibold transition">
                        Terms of Service
                      </span>{" "}
                      and{" "}
                      <span className="text-indigo-400 hover:text-indigo-300 hover:underline font-semibold transition">
                        Privacy Policy
                      </span>
                      .
                    </label>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-indigo-500 to-cyan-500 text-slate-950 font-bold tracking-wide hover:opacity-95 transition-all text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {loading ? (
                    <div className="h-5 w-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      {isLogin ? "Log In Securely" : "Instantiate Vault"}
                      <ArrowRight className="h-4 w-4 stroke-[2.5]" />
                    </>
                  )}
                </button>
              </form>

              {isLogin && (
                <div className="mt-4 flex flex-col items-center gap-3">
                  <span className="text-[10px] text-slate-600 font-bold uppercase tracking-widest">
                    — OR —
                  </span>

                  <button
                    type="button"
                    disabled={loading}
                    onClick={handleOpenAdminPrompt}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500/10 to-amber-600/10 hover:from-amber-505 hover:to-amber-605 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 hover:border-amber-550 hover:text-amber-200 text-amber-300 font-bold tracking-wide transition-all text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <ShieldCheck className="h-4.5 w-4.5 text-amber-400" />
                    Quick Access as System Admin
                  </button>

                  <button
                    type="button"
                    disabled={loading}
                    onClick={handleDemoLogin}
                    className="w-full py-3 rounded-xl bg-slate-950/80 hover:bg-slate-900 border border-indigo-500/30 text-indigo-400 font-bold tracking-wide hover:border-indigo-500/60 hover:text-indigo-300 transition-all text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <Sparkles className="h-4 w-4 text-cyan-400" />
                    Quick Access with Demo Account
                  </button>
                </div>
              )}

              <div className="mt-8 pt-6 border-t border-slate-800/80 text-center">
                <button
                  onClick={() => {
                    setIsLogin(!isLogin);
                    setError("");
                  }}
                  className="text-xs text-indigo-400 font-semibold tracking-wide hover:text-indigo-300 transition focus:outline-none cursor-pointer"
                >
                  {isLogin
                    ? "Don't have an account? Complete Registration"
                    : "Already partitioned an account? Log In"}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Manual Admin Credentials Verification Modal */}
      {showAdminPrompt && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md"
          onClick={() => setShowAdminPrompt(false)}
        >
          <div
            className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden relative shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-slate-850 flex items-center justify-between bg-slate-950/50">
              <div className="flex items-center gap-1.5 text-amber-400">
                <ShieldCheck className="h-4.5 w-4.5" />
                <span className="font-bold text-slate-200 text-sm">
                  Manual Admin Verification
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowAdminPrompt(false)}
                className="p-1.5 rounded-lg hover:bg-slate-850 text-slate-400 hover:text-slate-200 transition cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Body / Auth Form */}
            <form onSubmit={handleVerifyAdminPrompt} className="p-6 space-y-4">
              <p className="text-xs text-slate-400 leading-relaxed">
                Please enter the administrative email and master password
                manually to log in as system level controller.
              </p>

              {adminPromptError && (
                <div className="p-3 rounded-lg border border-red-500/20 bg-red-500/10 text-red-400 text-xs flex items-start gap-2">
                  <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{adminPromptError}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Admin Email Address
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                    <Mail className="h-4 w-4" />
                  </span>
                  <input
                    type="email"
                    required
                    placeholder="Enter admin email"
                    value={adminPromptEmail}
                    onChange={(e) => setAdminPromptEmail(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-xs focus:outline-none focus:border-amber-500 transition"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Admin Password
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                    <Lock className="h-4 w-4" />
                  </span>
                  <input
                    type={showAdminPassword ? "text" : "password"}
                    required
                    placeholder="••••••••"
                    value={adminPromptPassword}
                    onChange={(e) => setAdminPromptPassword(e.target.value)}
                    className="w-full pl-9 pr-10 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-xs focus:outline-none focus:border-amber-500 transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowAdminPassword(!showAdminPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-500 hover:text-slate-300 transition cursor-pointer"
                  >
                    {showAdminPassword ? (
                      <EyeOff className="h-3.5 w-3.5" />
                    ) : (
                      <Eye className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowAdminPrompt(false)}
                  className="px-4 py-2 rounded-xl bg-slate-950 text-slate-400 border border-slate-850 hover:bg-slate-900 text-xs font-bold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={adminPromptLoading}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {adminPromptLoading ? (
                    <div className="h-3.5 w-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>Authorize Session</span>
                      <ArrowRight className="h-3.5 w-3.5 stroke-[2.5]" />
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
