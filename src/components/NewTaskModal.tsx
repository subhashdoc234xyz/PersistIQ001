import React, { useState } from "react";
import { X, Sparkles, Loader2 } from "lucide-react";
import { tasksApi } from "../lib/api";

interface NewTaskModalProps {
  onClose: () => void;
  onCreated: () => void;
  id?: string;
}

export default function NewTaskModal({
  onClose,
  onCreated,
  id,
}: NewTaskModalProps) {
  const [topic, setTopic] = useState("");
  const [taskType, setTaskType] = useState<"learning" | "article">("learning");
  const [duration, setDuration] = useState("4_weeks");
  const [focus, setFocus] = useState("practical");
  const [numPages, setNumPages] = useState(3);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!topic.trim() || topic.trim().length < 3) {
      setError("Please enter a topic/subject (min 3 characters).");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await tasksApi.create(
        topic.trim(),
        taskType === "learning" ? duration : undefined,
        taskType === "learning" ? focus : undefined,
        taskType,
        taskType === "article" ? numPages : undefined
      );
      onCreated();
      onClose();
    } catch (e: any) {
      setError(e.message || "Failed to create research task.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      id={id || "new-task-modal"}
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto bg-slate-900/60"
      style={{
        backdropFilter: "blur(8px)",
      }}
    >
      <div className="glass rounded-3xl p-4 sm:p-5 w-full max-w-md shadow-2xl animate-fade-up max-h-[95vh] sm:max-h-[90vh] flex flex-col relative">
        {/* Header */}
        <div className="flex items-center justify-between mb-3 shrink-0">
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600
                            flex items-center justify-center shadow-lg shadow-indigo-200"
            >
              <Sparkles size={16} className="text-white" />
            </div>
            <div>
              <h2 className="font-display font-bold text-slate-800 text-sm sm:text-base">
                {taskType === "learning" ? "Create Learning Roadmap" : "Create Research Article"}
              </h2>
              <p className="text-[10px] text-slate-400 font-medium">
                {taskType === "learning" ? "AI-powered progressive syllabus builder" : "AI-powered comprehensive article generator"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl glass-dark flex items-center justify-center
                             text-slate-400 hover:text-slate-600 transition-all hover:scale-110 cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrollable Content Area */}
        <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-3 sm:space-y-4 mb-3 scrollbar-thin">
          {/* Choose Type Segmented Control */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wider">
              Output Generation Mode
            </label>
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-2xl border border-slate-200/50">
              <button
                type="button"
                onClick={() => setTaskType("learning")}
                className={`py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                  taskType === "learning"
                    ? "bg-white text-indigo-600 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                🎓 Learning Roadmap
              </button>
              <button
                type="button"
                onClick={() => setTaskType("article")}
                className={`py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                  taskType === "article"
                    ? "bg-white text-indigo-600 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                📰 Detailed Article
              </button>
            </div>
          </div>

          {/* Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wider">
              {taskType === "learning" ? "Subject / Skill to Master" : "Article Topic / Subject"}
            </label>
            <textarea
              value={topic}
              onChange={(e) => {
                setTopic(e.target.value);
                setError("");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              placeholder={
                taskType === "learning"
                  ? "e.g. Java programming from basics to advanced, conversational French..."
                  : "e.g. The impact of Quantum Computing on cryptography, rise of micro-frontends..."
              }
              rows={2}
              className="w-full glass-dark rounded-2xl px-4 py-3 text-sm text-slate-700
                         placeholder-slate-300 resize-none focus:outline-none
                         focus:ring-2 focus:ring-indigo-400/50 transition-all"
            />
            {error && <p className="text-xs text-red-500 mt-1.5">{error}</p>}
          </div>

          {/* Custom Options - ONLY for learning roadmap */}
          {taskType === "learning" && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wider">
                  Target Duration
                </label>
                <select
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  className="w-full glass-dark rounded-2xl px-3 py-2 text-xs text-slate-700 bg-white/40 border border-slate-200/50
                             focus:outline-none focus:ring-2 focus:ring-indigo-400/50 transition-all cursor-pointer"
                >
                  <option value="1_week">1-Week Crash Course</option>
                  <option value="4_weeks">4-Week Intensive</option>
                  <option value="12_weeks">12-Week Masterclass</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wider">
                  Audience / Style Focus
                </label>
                <select
                  value={focus}
                  onChange={(e) => setFocus(e.target.value)}
                  className="w-full glass-dark rounded-2xl px-3 py-2 text-xs text-slate-700 bg-white/40 border border-slate-200/50
                             focus:outline-none focus:ring-2 focus:ring-indigo-400/50 transition-all cursor-pointer"
                >
                  <option value="practical">Practical / Hands-on</option>
                  <option value="technical">Technical / Code-heavy</option>
                  <option value="theoretical">Conceptual / Foundations</option>
                </select>
              </div>
            </div>
          )}
          
          {/* Custom Options - ONLY for article */}
          {taskType === "article" && (
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wider">
                Target PDF Page Count
              </label>
              <select
                value={numPages}
                onChange={(e) => setNumPages(Number(e.target.value))}
                className="w-full glass-dark rounded-2xl px-3 py-2 text-xs text-slate-700 bg-white/40 border border-slate-200/50
                           focus:outline-none focus:ring-2 focus:ring-indigo-400/50 transition-all cursor-pointer"
              >
                <option value={1}>1 Page (Compact Summary)</option>
                <option value={2}>2 Pages (Brief Analysis)</option>
                <option value={3}>3 Pages (Standard Article)</option>
                <option value={5}>5 Pages (In-depth Report)</option>
                <option value={10}>10 Pages (Comprehensive Whitepaper)</option>
              </select>
            </div>
          )}

        </div>

        {/* CTA */}
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full py-3 rounded-2xl font-display font-semibold text-sm text-white shrink-0
                           bg-gradient-to-r from-indigo-500 via-violet-500 to-cyan-500
                           hover:opacity-90 active:scale-[0.98] transition-all duration-200
                           disabled:opacity-60 shadow-lg shadow-indigo-200/60
                           flex items-center justify-center gap-2 cursor-pointer"
        >
          {loading ? (
            <>
              <Loader2 size={16} className="animate-spin" /> {taskType === "learning" ? "Architecting Syllabus…" : "Composing Article…"}
            </>
          ) : (
            <>
              <Sparkles size={16} /> {taskType === "learning" ? "Generate Syllabus Roadmap" : "Generate Research Article"}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
