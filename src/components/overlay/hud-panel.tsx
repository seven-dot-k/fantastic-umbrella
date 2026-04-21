"use client";

import { useState } from "react";

const MOOD_COLOR_CLASSES: Record<string, string> = {
  calm: "bg-[#4a90d9]",
  nervous: "bg-[#f5d547]",
  defensive: "bg-[#e74c3c]",
  suspicious: "bg-[#e67e22]",
  angry: "bg-[#c0392b]",
  relieved: "bg-[#2ecc71]",
};

const DEFAULT_DOT_CLASS = "bg-[#95a5a6]";

export interface HudPersona {
  id: string;
  name: string;
  mood: string;
}

export interface HudClue {
  id: string;
  title: string;
  description: string;
}

interface HudPanelProps {
  personas: HudPersona[];
  clues: HudClue[];
}

/**
 * Left-side HUD overlay. Shows suspect list (mood dot + name + mood text)
 * and a collapsible evidence inventory.
 */
export function HudPanel({ personas, clues }: HudPanelProps) {
  const [cluesOpen, setCluesOpen] = useState(true);

  return (
    <div
      className="pointer-events-auto flex h-full w-[220px] flex-col gap-4 rounded-xl border border-amber-900/40 bg-[#41281D] p-3 text-slate-100 shadow-xl backdrop-blur-md"
      aria-label="Investigation HUD"
    >
      {/* Suspects section */}
      <section>
        <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-amber-300/80">
          Suspects
        </h2>
        {personas.length === 0 ? (
          <p className="text-xs italic text-slate-500">No suspects yet.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {personas.map((p) => (
              <li
                key={p.id}
                className="flex items-center gap-2 rounded-md px-1 py-1"
              >
                <span
                  className={`inline-block h-2.5 w-2.5 flex-shrink-0 rounded-full ${
                    MOOD_COLOR_CLASSES[p.mood.toLowerCase()] ?? DEFAULT_DOT_CLASS
                  }`}
                  aria-hidden="true"
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{p.name}</div>
                  <div className="truncate text-[11px] capitalize text-slate-400">
                    {p.mood}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Clues section (collapsible) */}
      <section className="flex min-h-0 flex-1 flex-col">
        <button
          type="button"
          onClick={() => setCluesOpen((v) => !v)}
          className="mb-2 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-amber-300/80 hover:text-amber-200"
          aria-expanded={cluesOpen}
        >
          <span>Evidence ({clues.length})</span>
          <span aria-hidden="true">{cluesOpen ? "−" : "+"}</span>
        </button>
        {cluesOpen && (
          <div className="min-h-0 flex-1 overflow-y-auto">
            {clues.length === 0 ? (
              <p className="text-xs italic text-slate-500">
                No evidence collected.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {clues.map((clue) => (
                  <li
                    key={clue.id}
                    className="rounded-md border border-amber-900/30 bg-slate-900/40 p-2"
                  >
                    <div className="text-xs font-semibold text-amber-200">
                      {clue.title}
                    </div>
                    <div className="mt-0.5 line-clamp-2 text-[11px] text-slate-400">
                      {clue.description}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
