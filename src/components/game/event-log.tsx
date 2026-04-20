"use client";

import type { GameEvent } from "@/workflows/schemas/game-state";

interface EventLogProps {
  events: GameEvent[];
}

export function EventLog({ events }: EventLogProps) {
  if (events.length === 0) return null;

  return (
    <div className="border-t border-border p-3">
      <h3 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
        Recent Events
      </h3>
      <div className="space-y-1.5 max-h-32 overflow-y-auto">
        {events.slice(-5).map((event) => (
          <div
            key={event.id}
            className="text-xs text-muted-foreground flex gap-2"
          >
            <span className="font-medium text-foreground whitespace-nowrap">
              {event.personaName}
            </span>
            <span>{event.description}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
