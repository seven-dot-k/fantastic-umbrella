"use client";

import type { Persona } from "@/workflows/schemas/game-state";
import { cn } from "@/lib/utils";

interface PersonaCardProps {
  persona: Persona;
  isSelected: boolean;
  onClick: () => void;
}

function getSanityColor(sanity: number): string {
  if (sanity >= 70) return "text-green-500";
  if (sanity >= 40) return "text-yellow-500";
  return "text-red-500";
}

function getMoodEmoji(mood: string): string {
  const moodMap: Record<string, string> = {
    calm: "😌",
    nervous: "😰",
    agitated: "😤",
    angry: "😡",
    scared: "😨",
    sad: "😢",
    distraught: "😭",
    suspicious: "🤨",
    defensive: "😠",
    composed: "😐",
    anxious: "😟",
    furious: "🤬",
    terrified: "😱",
    resigned: "😔",
  };
  return moodMap[mood.toLowerCase()] ?? "😶";
}

export function PersonaCard({ persona, isSelected, onClick }: PersonaCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full text-left rounded-xl border p-4 transition-all",
        "hover:border-primary/50 hover:shadow-md",
        isSelected
          ? "border-primary bg-primary/5 shadow-md"
          : "border-border bg-card",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-sm text-foreground truncate">
            {persona.name}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {persona.occupation}, {persona.age}
          </p>
        </div>
        <span className="text-lg flex-shrink-0" title={persona.mood}>
          {getMoodEmoji(persona.mood)}
        </span>
      </div>

      <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
        {persona.relationship}
      </p>

      <div className="flex items-center gap-2 mt-3">
        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              persona.sanity >= 70
                ? "bg-green-500"
                : persona.sanity >= 40
                  ? "bg-yellow-500"
                  : "bg-red-500",
            )}
            style={{ width: `${persona.sanity}%` }}
          />
        </div>
        <span
          className={cn("text-[10px] font-mono", getSanityColor(persona.sanity))}
        >
          {persona.sanity}
        </span>
      </div>
    </button>
  );
}
