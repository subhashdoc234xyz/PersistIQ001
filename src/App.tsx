/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import Dashboard from "./components/Dashboard";
import AuthForm from "./components/AuthForm";
import SharedRoadmap from "./components/SharedRoadmap";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { Brain, ArrowRight, Sparkles, Database, Shield, Zap } from "lucide-react";
import { motion } from "motion/react";

function AppContent() {
  const { currentUser } = useAuth();
  const [entered, setEntered] = useState(false);

  // Check if a shared roadmap ID is requested via URL search query
  const [shareId, setShareId] = useState<number | null>(() => {
    const params = new URLSearchParams(window.location.search);
    const idVal = params.get("share");
    if (idVal) {
      const parsed = parseInt(idVal, 10);
      return isNaN(parsed) ? null : parsed;
    }
    return null;
  });

  // Render shared roadmap player if accessed via shared link
  if (shareId !== null) {
    return (
      <SharedRoadmap
        taskId={shareId}
        onGoHome={() => {
          // Clear share parameter from URL address bar without reloading
          const url = new URL(window.location.href);
          url.searchParams.delete("share");
          window.history.pushState({}, "", url.toString());
          setShareId(null);
          setEntered(true);
        }}
      />
    );
  }

  // If user requests to enter and is authenticated, show main dashboard
  if (entered && currentUser) {
    return <Dashboard id="persistiq-app" />;
  }

  // If user requests to enter but is NOT authenticated, show the authentication form
  if (entered && !currentUser) {
    return (
      <AuthForm 
        onSuccess={() => {
          // Authentication succeeded, user can proceed to dashboard
        }} 
        onBack={() => setEntered(false)} 
      />
    );
  }

  // Floating data nodes represent checkpoint packets in transit
  const dataNodes = [
    { id: 1, icon: Database, color: "text-indigo-400 border-indigo-200 bg-indigo-50/60", x: [-40, 100, -20], y: [150, 80, 220], delay: 0 },
    { id: 2, icon: Shield, color: "text-emerald-400 border-emerald-200 bg-emerald-50/60", x: [120, -50, 80], y: [400, 320, 480], delay: 1 },
    { id: 3, icon: Zap, color: "text-amber-400 border-amber-200 bg-amber-50/60", x: [-80, 30, -50], y: [500, 420, 580], delay: 2 },
  ];

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-between text-slate-900 font-sans overflow-hidden relative selection:bg-indigo-500 selection:text-white">
      {/* Decorative ambient blurred orbs with fluid smooth motion */}
      <motion.div
        className="absolute w-[500px] h-[500px] rounded-full bg-indigo-300/20 blur-3xl"
        animate={{
          x: [0, 80, -40, 0],
          y: [0, -80, 60, 0],
          scale: [1, 1.2, 0.85, 1],
        }}
        transition={{
          duration: 16,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        style={{ top: "-15%", left: "-15%", pointerEvents: "none" }}
      />
      <motion.div
        className="absolute w-[500px] h-[500px] rounded-full bg-violet-300/20 blur-3xl"
        animate={{
          x: [0, -60, 90, 0],
          y: [0, 90, -60, 0],
          scale: [1, 0.85, 1.15, 1],
        }}
        transition={{
          duration: 18,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 1.5,
        }}
        style={{ bottom: "-10%", right: "-15%", pointerEvents: "none" }}
      />
      <motion.div
        className="absolute w-[400px] h-[400px] rounded-full bg-cyan-200/20 blur-3xl"
        animate={{
          x: [0, 50, -50, 0],
          y: [0, -30, 40, 0],
          scale: [1, 1.1, 0.9, 1],
        }}
        transition={{
          duration: 14,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 3,
        }}
        style={{ top: "30%", right: "15%", pointerEvents: "none" }}
      />

      {/* Floating Interactive Background Checkpoint Packet Nodes */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none hidden md:block">
        {dataNodes.map((node) => {
          const Icon = node.icon;
          return (
            <motion.div
              key={node.id}
              className={`absolute border rounded-2xl p-3 shadow-md flex items-center justify-center ${node.color} backdrop-blur-xs`}
              animate={{
                x: node.x,
                y: node.y,
                rotate: [0, 10, -10, 0],
                scale: [1, 1.05, 0.95, 1],
              }}
              transition={{
                duration: 15,
                repeat: Infinity,
                ease: "easeInOut",
                delay: node.delay,
              }}
              style={{
                left: node.id === 1 ? "10%" : node.id === 2 ? "78%" : "83%",
                top: "0px",
              }}
            >
              <Icon size={18} className="animate-pulse" />
            </motion.div>
          );
        })}
      </div>

      {/* Landing Header with staggered entry */}
      <motion.header 
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="h-14 bg-white/70 backdrop-blur-md border-b border-slate-200/40 flex items-center justify-between px-6 shrink-0 z-10"
      >
        <div className="flex items-center gap-2">
          <motion.div
            animate={{ rotate: [0, 10, -10, 0] }}
            transition={{ repeat: Infinity, duration: 6, ease: "easeInOut" }}
          >
            <Brain size={20} className="text-indigo-600" />
          </motion.div>
          <span className="font-display font-bold text-sm uppercase tracking-wider text-slate-800">
            PersistIQ
          </span>
        </div>
      </motion.header>

      {/* Main Animated Landing Content */}
      <main className="flex-1 flex flex-col items-center justify-center p-6 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          whileHover={{ y: -2 }}
          className="bg-white/50 backdrop-blur-2xl border border-white/60 shadow-2xl rounded-3xl p-8 sm:p-12 text-center max-w-lg w-full space-y-8 relative overflow-hidden transition-all duration-300 hover:shadow-indigo-100/40"
        >
          {/* Decorative glowing gradient overlay inside glassmorphic card */}
          <div className="absolute -top-24 -left-24 w-48 h-48 bg-indigo-400/20 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-violet-400/20 rounded-full blur-2xl pointer-events-none" />

          {/* Animated Big Logo icon with dynamic ring pulsation */}
          <div className="relative">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", damping: 15, delay: 0.2 }}
              className="w-24 h-24 mx-auto rounded-3xl bg-gradient-to-br from-indigo-500 via-violet-500 to-cyan-500 flex items-center justify-center shadow-2xl shadow-indigo-500/20 relative group cursor-pointer"
              whileHover={{ scale: 1.05 }}
            >
              <Brain size={48} className="text-white relative z-10" />
              
              {/* Pulsing halo ring */}
              <motion.span 
                className="absolute inset-0 rounded-3xl border-2 border-indigo-400/50"
                animate={{ scale: [1, 1.25, 1], opacity: [0.6, 0, 0.6] }}
                transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
              />
              <span className="absolute inset-0 rounded-3xl bg-indigo-600/20 blur-xl opacity-70 group-hover:opacity-100 transition-opacity" />
            </motion.div>
          </div>

          {/* Animated Hero Title & Text */}
          <div className="space-y-4 relative z-10">
            <motion.h1
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="text-4xl sm:text-5xl font-display font-black tracking-tight text-slate-900 leading-tight"
            >
              Meet <span className="shimmer-text bg-gradient-to-r from-indigo-600 via-violet-600 to-cyan-600 bg-clip-text text-transparent">PersistIQ</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.6 }}
              className="text-slate-500 font-medium text-sm leading-relaxed max-w-md mx-auto"
            >
              A premium, stateful AI research workspace that constructs deep, comprehensive articles and syllabus roadmaps. Track tasks interactively with complete persistence.
            </motion.p>
          </div>

          {/* Animated Launch Button with glowing effect & slide-up */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.8 }}
            className="relative inline-block w-full z-10"
          >
            <motion.div 
              className="absolute -inset-1 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 opacity-25 blur-md"
              animate={{ scale: [1, 1.04, 1], opacity: [0.15, 0.3, 0.15] }}
              transition={{ repeat: Infinity, duration: 2.5 }}
            />
            <button
              onClick={() => setEntered(true)}
              className="relative w-full sm:w-auto inline-flex items-center justify-center gap-2 px-10 py-4 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white rounded-xl font-bold text-sm shadow-xl shadow-indigo-200/80 cursor-pointer active:scale-95 hover:scale-[1.03] transition-all duration-200"
            >
              Launch Workspace
              <motion.span
                animate={{ x: [0, 4, 0] }}
                transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
              >
                <ArrowRight size={16} />
              </motion.span>
            </button>
          </motion.div>
        </motion.div>
      </main>

      {/* Elegant, clean minimalist footer */}
      <div className="py-6 text-center text-[11px] text-slate-400 font-medium relative z-10">
        © {new Date().getFullYear()} PersistIQ. All rights reserved.
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
