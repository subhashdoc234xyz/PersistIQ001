import React from "react";

const STEP_PROGRESS: Record<string, number | null> = {
  pending: 0,
  searching: 20,
  search_complete: 35,
  extracting: 50,
  extract_complete: 65,
  awaiting_approval: 70,
  approved: 75,
  summarizing: 88,
  completed: 100,
  failed: null,
  cancelled: null,
};

interface ProgressBarProps {
  step: string;
  id?: string;
}

export default function ProgressBar({ step, id }: ProgressBarProps) {
  const pct = STEP_PROGRESS[step];

  if (pct === null) {
    const isCancelled = step === "cancelled" || step === "stopped";
    return (
      <div id={id} className={`h-1.5 w-full rounded-full ${isCancelled ? "bg-slate-100" : "bg-red-100"}`}>
        <div className={`h-full w-full rounded-full ${isCancelled ? "bg-slate-400/50" : "bg-red-400/60"}`} />
      </div>
    );
  }

  return (
    <div id={id} className="h-1.5 w-full rounded-full bg-white/50 overflow-hidden">
      <div
        className="h-full rounded-full progress-glow transition-all duration-700 ease-out"
        style={{
          width: `${pct ?? 0}%`,
          background: "linear-gradient(90deg, #6366f1, #8b5cf6, #06b6d4)",
          backgroundSize: "200% auto",
          animation: (pct ?? 0) < 100 ? "shimmer 2s linear infinite" : "none",
        }}
      />
    </div>
  );
}
