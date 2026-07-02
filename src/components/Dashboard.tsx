import React, { useState, useEffect, useCallback } from "react";
import {
  Brain,
  Plus,
  RefreshCw,
  LogOut,
} from "lucide-react";
import { motion } from "motion/react";
import TaskCard from "./TaskCard";
import NewTaskModal from "./NewTaskModal";
import { ResearchTask, tasksApi } from "../lib/api";
import { useAuth } from "../context/AuthContext";

const POLL_INTERVAL = 4000;

interface DashboardProps {
  id?: string;
}

export default function Dashboard({ id }: DashboardProps) {
  const { logout, currentUser } = useAuth();
  const [tasks, setTasks] = useState<ResearchTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [connectionError, setConnectionError] = useState(false);

  const fetchTasks = useCallback(async () => {
    try {
      const data = await tasksApi.getAll();
      setTasks(data);
      setLastRefresh(new Date());
      setConnectionError(false);
    } catch (err) {
      // Gracefully handle connection error state without breaking UI or throwing unhandled promises
      setConnectionError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
    const interval = setInterval(fetchTasks, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchTasks]);

  const stats = {
    total: tasks.length,
    active: tasks.filter((t) =>
      ["searching", "extracting", "summarizing"].includes(t.status)
    ).length,
    paused: tasks.filter((t) => t.status === "awaiting_approval").length,
    done: tasks.filter((t) => t.status === "completed").length,
    failed: tasks.filter((t) => t.status === "failed").length,
  };

  return (
    <div
      id={id || "dashboard-root"}
      className="flex h-screen w-full bg-slate-100 font-sans text-slate-900 overflow-hidden relative selection:bg-indigo-500 selection:text-white"
    >
      {/* Decorative ambient blurred orbs for glassmorphic depth */}
      <motion.div
        className="absolute w-[450px] h-[450px] rounded-full bg-indigo-300/15 blur-3xl pointer-events-none"
        animate={{
          x: [0, 60, -30, 0],
          y: [0, -60, 40, 0],
          scale: [1, 1.15, 0.9, 1],
        }}
        transition={{
          duration: 18,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        style={{ top: "5%", left: "10%" }}
      />
      <motion.div
        className="absolute w-[450px] h-[450px] rounded-full bg-violet-300/15 blur-3xl pointer-events-none"
        animate={{
          x: [0, -40, 60, 0],
          y: [0, 60, -40, 0],
          scale: [1, 0.9, 1.1, 1],
        }}
        transition={{
          duration: 22,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 2,
        }}
        style={{ bottom: "5%", right: "10%" }}
      />

      {/* Sidebar Navigation - Hidden on Mobile, Flex on Desktop */}
      <nav className="hidden sm:flex w-16 h-full bg-slate-900/95 backdrop-blur-md flex flex-col items-center py-6 gap-8 border-r border-slate-800 shrink-0 z-20">
        <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/20 transition-transform hover:scale-105" title="PersistIQ Platform">
          <Brain size={22} className="text-white animate-pulse" />
        </div>
        <div className="flex flex-col gap-6">
          <button
            onClick={fetchTasks}
            className="w-8 h-8 rounded flex items-center justify-center bg-slate-800/50 border border-slate-700 hover:border-slate-500 text-slate-400 cursor-pointer transition-colors"
            title="Refresh Task Queue"
          >
            <RefreshCw size={16} />
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="w-8 h-8 rounded flex items-center justify-center bg-slate-800/50 border border-slate-700 hover:border-indigo-500 text-slate-400 cursor-pointer transition-colors"
            title="Add Research Task"
          >
            <Plus size={16} />
          </button>
        </div>
        <div className="mt-auto flex flex-col gap-4 items-center">
          <button
            onClick={logout}
            className="w-8 h-8 rounded flex items-center justify-center bg-slate-800/50 border border-slate-700 hover:border-red-500 hover:text-red-400 text-slate-400 cursor-pointer transition-colors"
            title={`Log out (${currentUser?.email})`}
          >
            <LogOut size={16} />
          </button>
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white text-[10px] font-bold" title={currentUser?.email || ""}>
            {currentUser?.email ? currentUser.email.substring(0, 2).toUpperCase() : "US"}
          </div>
        </div>
      </nav>

      {/* Main Workspace */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative z-10">
        {/* Top Header Bar */}
        <header className="h-14 bg-white/75 backdrop-blur-md border-b border-slate-200/50 flex items-center justify-between px-3 sm:px-6 shrink-0">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <Brain size={18} className="text-indigo-600 shrink-0 animate-pulse" />
              <h1 className="text-xs sm:text-sm font-bold text-slate-800 tracking-tight whitespace-nowrap">
                <span className="inline sm:hidden">PersistIQ</span>
                <span className="hidden sm:inline">PersistIQ</span>
              </h1>
            </div>
            <span className="h-4 w-px bg-slate-200 hidden xs:inline"></span>
            <div className="hidden xs:flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ${stats.active > 0 ? "bg-emerald-500 animate-pulse" : "bg-slate-300"}`} />
              <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">
                {stats.active > 0 ? "Active" : "Standby"}
              </span>
            </div>
            {connectionError && (
              <span className="flex items-center gap-1 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded text-[8px] text-amber-700 font-bold uppercase tracking-wider font-mono animate-pulse">
                ⚠️ Recon
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            {/* Quick action buttons for mobile only (since sidebar navigation is hidden on mobile) */}
            <div className="flex sm:hidden items-center gap-1.5">
              <button
                onClick={fetchTasks}
                className="w-8 h-8 rounded-lg flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-600 cursor-pointer transition-colors"
                title="Refresh Task Queue"
              >
                <RefreshCw size={14} />
              </button>
              <button
                onClick={logout}
                className="w-8 h-8 rounded-lg flex items-center justify-center bg-slate-100 hover:bg-red-50 text-slate-600 hover:text-red-500 cursor-pointer transition-colors"
                title={`Log out (${currentUser?.email})`}
              >
                <LogOut size={14} />
              </button>
            </div>

            {lastRefresh && (
              <span className="text-[9px] sm:text-[10px] text-slate-400 font-mono hidden md:inline">
                Updated: {lastRefresh.toLocaleTimeString()}
              </span>
            )}
            <button
              onClick={() => setShowModal(true)}
              className="px-2.5 py-1.5 sm:px-4 sm:py-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white text-[11px] sm:text-xs font-bold rounded-lg cursor-pointer transition-all shadow-md hover:shadow-indigo-200/50 hover:scale-[1.02] flex items-center gap-1 sm:gap-1.5"
            >
              <Plus size={14} />
              <span className="hidden xs:inline">Create Roadmap</span>
              <span className="inline xs:hidden">New</span>
            </button>
          </div>
        </header>

        {/* Content Grid */}
        <div className="flex-1 flex flex-col overflow-hidden p-3 sm:p-6 max-w-5xl mx-auto w-full">
          {/* Center Focus: Research Tasks List with beautiful glassmorphism */}
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="flex-1 bg-white/70 backdrop-blur-xl border border-white/40 rounded-2xl flex flex-col shadow-xl hover:shadow-2xl transition-all duration-300 overflow-hidden"
          >
            <div className="border-b border-slate-100/50 p-4 flex justify-between items-center bg-white/40 shrink-0">
              <h2 className="text-xs sm:text-sm font-bold text-slate-700 tracking-tight flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                Research & Syllabus Roadmaps
              </h2>
              <div className="flex gap-1.5 items-center">
                <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full font-semibold">Total: {tasks.length}</span>
              </div>
            </div>

            <div className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-4 bg-transparent">
              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="border border-slate-100 rounded-xl p-4 bg-white/80 animate-pulse shadow-xs">
                      <div className="h-4 bg-slate-200 rounded-full w-3/4 mb-3" />
                      <div className="h-2 bg-slate-200 rounded-full w-full mb-2" />
                      <div className="h-2 bg-slate-200 rounded-full w-1/2" />
                    </div>
                  ))}
                </div>
              ) : tasks.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-8">
                  <div className="w-16 h-16 rounded-2xl bg-white border border-slate-100 flex items-center justify-center mb-4 shadow-xs">
                    <Brain size={32} className="text-indigo-400" />
                  </div>
                  <h3 className="font-display font-bold text-slate-700 text-base mb-2">
                    No active research tasks
                  </h3>
                  <p className="text-slate-400 text-xs mb-5 leading-relaxed max-w-xs mx-auto">
                    Start your first durable research task. The agent checkpoints every step so it never loses progress.
                  </p>
                  <button
                    id="start-first-research-btn"
                    onClick={() => setShowModal(true)}
                    className="px-5 py-2 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700 cursor-pointer transition-all shadow-md hover:scale-[1.02]"
                  >
                    Start First Research
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {tasks.map((task) => (
                    <TaskCard key={task.id} task={task} onRefresh={fetchTasks} />
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </div>

      {showModal && (
        <NewTaskModal
          onClose={() => setShowModal(false)}
          onCreated={fetchTasks}
        />
      )}
    </div>
  );
}
