"use client";

import type { GameState } from "@/workflows/schemas/game-state";

interface GameResultProps {
  gameState: GameState;
  onNewGame: () => void;
}

export function GameResult({ gameState, onNewGame }: GameResultProps) {
  const isSolved = gameState.status === "solved";

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="max-w-md w-full mx-auto p-8 text-center">
        <div className="text-6xl mb-4">{isSolved ? "🎉" : "💀"}</div>
        <h1 className="text-2xl font-bold mb-2">
          {isSolved ? "Case Solved!" : "Case Failed"}
        </h1>
        <p className="text-muted-foreground mb-6">
          {isSolved
            ? "Brilliant detective work! You identified the murderer correctly."
            : "The wrong person was accused. The real killer got away..."}
        </p>

        <div className="bg-card border border-border rounded-xl p-4 mb-6 text-left">
          <h2 className="font-semibold text-sm mb-2">
            {gameState.scenario.title}
          </h2>
          <p className="text-xs text-muted-foreground">
            {gameState.scenario.setting}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Events during investigation: {gameState.events.length}
          </p>
        </div>

        <button
          type="button"
          onClick={onNewGame}
          className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Start New Investigation
        </button>
      </div>
    </div>
  );
}
