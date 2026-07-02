import React from "react";

interface StatusConfigValue {
  label: string;
  color: string;
  dot?: boolean;
  pulse?: boolean;
}

const STATUS_CONFIG: Record<string, StatusConfigValue> = {
  pending: {
    label: "Pending",
    color: "bg-slate-100/80 text-slate-500 border-slate-200",
  },
  searching: {
    label: "Searching",
    color: "bg-blue-50 text-blue-600 border-blue-200",
    dot: true,
  },
  extracting: {
    label: "Extracting",
    color: "bg-violet-50 text-violet-600 border-violet-200",
    dot: true,
  },
  awaiting_approval: {
    label: "Awaiting Approval",
    color: "bg-amber-50 text-amber-600 border-amber-200",
    pulse: true,
  },
  summarizing: {
    label: "Summarizing",
    color: "bg-indigo-50 text-indigo-600 border-indigo-200",
    dot: true,
  },
  completed: {
    label: "Completed",
    color: "bg-emerald-50 text-emerald-600 border-emerald-200",
  },
  failed: {
    label: "Failed",
    color: "bg-red-50 text-red-500 border-red-200",
  },
  cancelled: {
    label: "Stopped",
    color: "bg-slate-100 text-slate-500 border-slate-200",
  },
};

interface StatusBadgeProps {
  status: string;
  id?: string;
}

export default function StatusBadge({ status, id }: StatusBadgeProps) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending;

  return (
    <span
      id={id}
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${cfg.color}`}
    >
      {cfg.dot && (
        <span className="flex gap-0.5">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="w-1 h-1 rounded-full bg-current"
              style={{
                animation: "bounceDot 1.4s ease-in-out infinite",
                animationDelay: `${i * 0.16}s`,
              }}
            />
          ))}
        </span>
      )}
      {cfg.pulse && (
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
        </span>
      )}
      {cfg.label}
    </span>
  );
}
