"use client";

import { useRef, useEffect } from "react";

export type DebugChannel = "ai-sdk" | "game-bridge";

export interface DebugEvent {
  id: string;
  timestamp: number;
  channel: DebugChannel;
  type: string;
  source: string;
  data: unknown;
}

interface DebugPanelProps {
  events: DebugEvent[];
  onClear: () => void;
}

export function DebugPanel({ events, onClear }: DebugPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events]);

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}:${d.getSeconds().toString().padStart(2, "0")}.${d.getMilliseconds().toString().padStart(3, "0")}`;
  };

  const channelColor: Record<string, string> = {
    "ai-sdk": "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
    "game-bridge": "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  };

  const typeColor: Record<string, string> = {
    "text-delta": "text-green-400",
    "text-complete": "text-green-300",
    "tool-call": "text-amber-400",
    "tool-output": "text-amber-300",
    "choices": "text-purple-400",
    "mood-update": "text-blue-400",
    "clue": "text-yellow-400",
    "interaction-start": "text-cyan-400",
    "interaction-complete": "text-cyan-300",
    "message-sent": "text-slate-300",
    "error": "text-red-400",
    "dialogue-state": "text-pink-400",
  };

  return (
    <div className="flex h-full max-w-[470px] flex-col rounded-xl border border-slate-700 bg-slate-900/95 text-slate-200 shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-700 px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-xs font-semibold tracking-wide text-slate-300">
            DEBUG
          </span>
          <span className="text-[10px] text-slate-500">
            {events.length} events
          </span>
        </div>
        <button
          type="button"
          onClick={onClear}
          className="rounded px-2 py-0.5 text-[10px] text-slate-500 hover:bg-slate-800 hover:text-slate-300 transition-colors"
        >
          Clear
        </button>
      </div>

      {/* Event log */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto overflow-x-hidden font-mono text-[11px] leading-relaxed"
      >
        {events.length === 0 && (
          <div className="p-4 text-center text-slate-600 text-xs">
            No events yet. Interact with an NPC to see stream data.
          </div>
        )}
        {events.map((evt) => (
          <div
            key={evt.id}
            className="border-b border-slate-800/50 px-3 py-1.5 hover:bg-slate-800/30"
          >
            <div className="flex items-baseline gap-2">
              <span className="text-slate-600 shrink-0">
                {formatTime(evt.timestamp)}
              </span>
              <span
                className={`shrink-0 rounded border px-1 py-px text-[9px] font-medium ${channelColor[evt.channel] ?? "bg-slate-700 text-slate-400 border-slate-600"}`}
              >
                {evt.channel === "ai-sdk" ? "AI SDK" : "Bridge"}
              </span>
              <span
                className={`font-semibold shrink-0 ${typeColor[evt.type] ?? "text-slate-400"}`}
              >
                {evt.type}
              </span>
              <span className="text-slate-500 truncate">
                {evt.source}
              </span>
            </div>
            {evt.data !== undefined && evt.data !== null && (
              <div className="mt-0.5 text-[10px] text-slate-500 break-all whitespace-pre-wrap max-h-20 overflow-y-auto">
                {typeof evt.data === "string"
                  ? evt.data
                  : JSON.stringify(evt.data, null, 1)}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
