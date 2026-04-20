"use client";

import { useState } from "react";

const MOOD_COLOR_CLASSES: Record<string, string> = {
  calm: "border-[#4a90d9]",
  nervous: "border-[#f5d547]",
  defensive: "border-[#e74c3c]",
  suspicious: "border-[#e67e22]",
  angry: "border-[#c0392b]",
  relieved: "border-[#2ecc71]",
};

const DEFAULT_BORDER = "border-slate-500";

export interface AccusationPersona {
  id: string;
  name: string;
  mood: string;
}

interface AccusationModalProps {
  isOpen: boolean;
  personas: AccusationPersona[];
  onAccuse: (personaId: string) => void;
  onCancel: () => void;
}

/**
 * Full-screen accusation modal. Presents a grid of NPC cards; the player
 * picks one and confirms. Pure UI shell — fires onAccuse / onCancel callbacks.
 */
export function AccusationModal({
  isOpen,
  personas,
  onAccuse,
  onCancel,
}: AccusationModalProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Reset selection on close by tracking prior isOpen via derived state.
  const [wasOpen, setWasOpen] = useState(isOpen);
  if (wasOpen !== isOpen) {
    setWasOpen(isOpen);
    if (!isOpen) setSelectedId(null);
  }

  if (!isOpen) return null;

  return (
    <div
      className="pointer-events-auto absolute inset-0 z-30 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Accuse a suspect"
    >
      <div className="w-[min(640px,90%)] rounded-2xl border border-amber-900/50 bg-[rgba(20,15,30,0.96)] p-6 text-slate-100 shadow-2xl">
        <h2 className="mb-1 text-center text-xl font-bold text-amber-200">
          Who is the murderer?
        </h2>
        <p className="mb-5 text-center text-xs text-slate-400">
          Choose carefully. A false accusation ends the investigation.
        </p>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {personas.map((p) => {
            const isSelected = p.id === selectedId;
            const moodBorder =
              MOOD_COLOR_CLASSES[p.mood.toLowerCase()] ?? DEFAULT_BORDER;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelectedId(p.id)}
                className={`flex flex-col items-center gap-2 rounded-xl border-2 bg-slate-900/60 p-4 transition-colors ${
                  isSelected
                    ? `${moodBorder} ring-2 ring-amber-400/60`
                    : `${moodBorder} opacity-75 hover:opacity-100`
                }`}
                aria-pressed={isSelected}
              >
                <span className="text-sm font-semibold text-slate-100">
                  {p.name}
                </span>
                <span className="text-[11px] capitalize text-slate-400">
                  {p.mood}
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => selectedId && onAccuse(selectedId)}
            disabled={!selectedId}
            className="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-slate-50 hover:bg-red-600 transition-colors disabled:opacity-40"
          >
            Confirm Accusation
          </button>
        </div>
      </div>
    </div>
  );
}
