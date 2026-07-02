import React, { useState } from "react";
import { motion } from "motion/react";
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  sendPasswordResetEmail 
} from "firebase/auth";
import { auth } from "../lib/firebase";
import { useAuth } from "../context/AuthContext";
import { Brain, ArrowRight, ArrowLeft, Shield, CheckCircle, AlertTriangle, Loader2, UserCheck } from "lucide-react";

interface AuthFormProps {
  onSuccess: () => void;
  onBack: () => void;
}

type AuthMode = "login" | "register" | "forgot";

export default function AuthForm({ onSuccess, onBack }: AuthFormProps) {
  const { loginWithGoogle, loginWithGithub, loginAsGuest } = useAuth();
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setError(null);
    setSuccessMsg(null);
    setLoading(true);
    try {
      await loginWithGoogle();
      onSuccess();
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to sign in with Google. If popups are blocked, please allow them and retry.");
    } finally {
      setLoading(false);
    }
  };

  const handleGithubSignIn = async () => {
    setError(null);
    setSuccessMsg(null);
    setLoading(true);
    try {
      await loginWithGithub();
      onSuccess();
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to sign in with GitHub. If popups are blocked, please allow them and retry.");
    } finally {
      setLoading(false);
    }
  };

  const handleGuestSignIn = async () => {
    setError(null);
    setSuccessMsg(null);
    setLoading(true);
    try {
      await loginAsGuest();
      onSuccess();
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to continue as Guest.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    // Basic validation
    if (!email) {
      setError("Please enter your email address.");
      return;
    }

    if (mode !== "forgot" && !password) {
      setError("Please enter your password.");
      return;
    }

    if (mode === "register" && password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (mode === "register" && password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);

    try {
      if (mode === "login") {
        await signInWithEmailAndPassword(auth, email, password);
        onSuccess();
      } else if (mode === "register") {
        await createUserWithEmailAndPassword(auth, email, password);
        onSuccess();
      } else if (mode === "forgot") {
        await sendPasswordResetEmail(auth, email);
        setSuccessMsg("Reset link has been sent to your email!");
        setTimeout(() => setMode("login"), 4000);
      }
    } catch (err: any) {
      console.error(err);
      let errMsg = "An unexpected error occurred. Please try again.";
      if (err.code === "auth/user-not-found" || err.code === "auth/wrong-password") {
        errMsg = "Invalid email or password.";
      } else if (err.code === "auth/email-already-in-use") {
        errMsg = "This email is already registered.";
      } else if (err.code === "auth/invalid-email") {
        errMsg = "Invalid email format.";
      } else if (err.code === "auth/weak-password") {
        errMsg = "Password is too weak.";
      } else if (err.code === "auth/missing-password") {
        errMsg = "Password is required.";
      } else if (err.message) {
        errMsg = err.message;
      }
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-between text-slate-900 font-sans overflow-hidden relative selection:bg-indigo-500 selection:text-white">
      {/* Dynamic drifting background orbs matching landing page */}
      <motion.div
        className="absolute w-[450px] h-[450px] rounded-full bg-indigo-300/15 blur-3xl pointer-events-none"
        animate={{
          x: [0, 50, -20, 0],
          y: [0, -50, 30, 0],
          scale: [1, 1.1, 0.9, 1],
        }}
        transition={{
          duration: 15,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        style={{ top: "10%", left: "5%" }}
      />
      <motion.div
        className="absolute w-[450px] h-[450px] rounded-full bg-violet-300/15 blur-3xl pointer-events-none"
        animate={{
          x: [0, -30, 50, 0],
          y: [0, 50, -30, 0],
          scale: [1, 0.95, 1.05, 1],
        }}
        transition={{
          duration: 18,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 1,
        }}
        style={{ bottom: "10%", right: "5%" }}
      />

      {/* Auth Header */}
      <header className="h-14 bg-white/70 backdrop-blur-md border-b border-slate-200/40 flex items-center justify-between px-6 shrink-0 z-10">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
        >
          <ArrowLeft size={14} />
          Back to Intro
        </button>
        <div className="flex items-center gap-2">
          <Brain size={18} className="text-indigo-600 animate-pulse" />
          <span className="font-display font-bold text-sm uppercase tracking-wider text-slate-800">
            PersistIQ
          </span>
        </div>
      </header>

      {/* Form Container */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 relative z-10">
        <motion.div
          layout
          initial={{ opacity: 0, y: 30, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-md bg-white/50 backdrop-blur-2xl border border-white/60 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden transition-all duration-300 hover:shadow-indigo-100/40"
        >
          {/* Form Header */}
          <div className="text-center mb-6">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-indigo-50 border border-indigo-100/50 flex items-center justify-center mb-3">
              <Shield size={20} className="text-indigo-600 animate-pulse" />
            </div>
            <h2 className="text-lg sm:text-xl font-display font-bold tracking-tight text-slate-900">
              {mode === "login" && "Authorize Device"}
              {mode === "register" && "Create Developer Account"}
              {mode === "forgot" && "Recover Account Keys"}
            </h2>
            <p className="text-[10px] sm:text-xs text-slate-400 mt-1 font-mono uppercase tracking-wider">
              {mode === "login" && "Establish session pipeline credentials"}
              {mode === "register" && "Initialize your sandbox profile"}
              {mode === "forgot" && "Reset verification codes"}
            </p>
          </div>

          {/* Feedback Messages */}
          {error && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mb-4 p-3 bg-red-50 border border-red-200/50 rounded-xl flex items-start gap-2 text-[11px] text-red-700 leading-relaxed font-semibold shadow-xs"
            >
              <AlertTriangle size={14} className="shrink-0 mt-0.5 text-red-500" />
              <span>{error}</span>
            </motion.div>
          )}

          {successMsg && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mb-4 p-3 bg-emerald-50 border border-emerald-200/50 rounded-xl flex items-start gap-2 text-[11px] text-emerald-700 leading-relaxed font-semibold shadow-xs"
            >
              <CheckCircle size={14} className="shrink-0 mt-0.5 text-emerald-500" />
              <span>{successMsg}</span>
            </motion.div>
          )}

          {/* Form Fields */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 font-mono">
                Developer Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="developer@persistiq.io"
                disabled={loading}
                className="w-full px-3.5 py-2.5 bg-white/70 border border-slate-200/60 rounded-xl text-xs font-mono focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 focus:outline-hidden transition-all text-slate-900 placeholder:text-slate-400"
              />
            </div>

            {mode !== "forgot" && (
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">
                    Security Passkey
                  </label>
                  {mode === "login" && (
                    <button
                      type="button"
                      onClick={() => {
                        setError(null);
                        setMode("forgot");
                      }}
                      className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
                    >
                      Forgot keys?
                    </button>
                  )}
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  disabled={loading}
                  className="w-full px-3.5 py-2.5 bg-white/70 border border-slate-200/60 rounded-xl text-xs font-mono focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 focus:outline-hidden transition-all text-slate-900 placeholder:text-slate-400"
                />
              </div>
            )}

            {mode === "register" && (
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 font-mono">
                  Confirm Passkey
                </label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  disabled={loading}
                  className="w-full px-3.5 py-2.5 bg-white/70 border border-slate-200/60 rounded-xl text-xs font-mono focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 focus:outline-hidden transition-all text-slate-900 placeholder:text-slate-400"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed shadow-md hover:shadow-indigo-200/50 hover:scale-[1.01] transition-all duration-200"
            >
              {loading ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Verifying...
                </>
              ) : (
                <>
                  {mode === "login" && "Connect Workspace"}
                  {mode === "register" && "Register Endpoint"}
                  {mode === "forgot" && "Recover Credentials"}
                  <ArrowRight size={14} />
                </>
              )}
            </button>
          </form>

          {/* Social and Guest Sign-In Options */}
          {mode !== "forgot" && (
            <div className="space-y-4 mt-4">
              <div className="relative flex items-center justify-center">
                <div className="absolute inset-x-0 border-t border-slate-200/40" />
                <span className="relative bg-[#f1f5f9] px-2.5 text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest">
                  Secure OAuth Handshake
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={loading}
                  className="flex items-center justify-center gap-1.5 px-3 py-2.5 border border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-[11px] font-bold rounded-xl cursor-pointer transition-all active:scale-[0.98] disabled:opacity-60 shadow-xs"
                >
                  <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24">
                    <path fill="#EA4335" d="M12.24 10.285V14.4h6.887c-.648 2.41-2.519 4.114-5.136 4.114-3.44 0-6.228-2.788-6.228-6.228s2.788-6.228 6.228-6.228c1.551 0 2.964.568 4.053 1.503l3.058-3.058C19.143 2.5 15.904 1 12.24 1 6.033 1 1 6.033 1 12.24s5.033 11.24 11.24 11.24c5.803 0 10.841-4.22 10.841-11.24 0-.585-.054-1.147-.153-1.695H12.24z"/>
                  </svg>
                  Google
                </button>
                <button
                  type="button"
                  onClick={handleGithubSignIn}
                  disabled={loading}
                  className="flex items-center justify-center gap-1.5 px-3 py-2.5 border border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-[11px] font-bold rounded-xl cursor-pointer transition-all active:scale-[0.98] disabled:opacity-60 shadow-xs"
                >
                  <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
                  </svg>
                  GitHub
                </button>
              </div>

              <button
                type="button"
                onClick={handleGuestSignIn}
                disabled={loading}
                className="w-full py-2.5 bg-white hover:bg-slate-50 border border-dashed border-slate-300 hover:border-indigo-400 hover:text-indigo-600 font-bold text-[10px] uppercase tracking-wider rounded-xl flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed transition-all"
              >
                <UserCheck size={13} />
                Continue as guest
              </button>
            </div>
          )}

          {/* Form Footer Toggles */}
          <div className="mt-5 pt-4 border-t border-slate-200/40 flex justify-between text-[11px]">
            {mode === "login" ? (
              <>
                <span className="text-slate-400">New endpoint?</span>
                <button
                  onClick={() => {
                    setError(null);
                    setMode("register");
                  }}
                  className="font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
                >
                  Create Account
                </button>
              </>
            ) : mode === "register" ? (
              <>
                <span className="text-slate-400">Have account?</span>
                <button
                  onClick={() => {
                    setError(null);
                    setMode("login");
                  }}
                  className="font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
                >
                  Authenticate Instead
                </button>
              </>
            ) : (
              <>
                <span className="text-slate-400">Remember key?</span>
                <button
                  onClick={() => {
                    setError(null);
                    setMode("login");
                  }}
                  className="font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
                >
                  Return to login
                </button>
              </>
            )}
          </div>
        </motion.div>
      </main>

      {/* Elegant minimalist footer */}
      <div className="py-6 text-center text-[11px] text-slate-400 font-medium relative z-10">
        © {new Date().getFullYear()} PersistIQ. All rights reserved.
      </div>
    </div>
  );
}
