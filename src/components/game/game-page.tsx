"use client";

import { useEffect, useCallback, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useGame } from "@/hooks/use-game";
import { useNarrativeBridge } from "@/hooks/use-narrative-bridge";
import type { DebugEvent } from "@/components/overlay/debug-panel";
import type { NearbyEntity } from "./player";

// PIXIJS requires browser WebGL/WebGPU APIs; disable SSR by dynamically
// loading the game shell inside a Client Component.
const GameInterface = dynamic(
  () =>
    import("@/components/game/game-interface").then((mod) => ({
      default: mod.GameInterface,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-screen w-full items-center justify-center bg-slate-950 text-slate-200">
        <p className="text-sm opacity-75">Loading game engine...</p>
      </div>
    ),
  },
);

/**
 * GamePage - Top-level wiring component.
 *
 * Connects:
 * - useGame() for game lifecycle and state management
 * - useNarrativeBridge() for dialogue/directives streaming
 * - GameInterface for rendering the game and overlays
 *
 * This is the only file that imports both bridge and engine, maintaining clean
 * separation between the backend integration and the PIXIJS game engine.
 */
export function GamePage() {
  const game = useGame();
  const hasStartedRef = useRef(false);
  const [debugEvents, setDebugEvents] = useState<DebugEvent[]>([]);

  const handleDebugEvent = useCallback((event: DebugEvent) => {
    setDebugEvents((prev) => [...prev.slice(-499), event]);
  }, []);

  const clearDebugEvents = useCallback(() => {
    setDebugEvents([]);
  }, []);

  // Start game on mount
  useEffect(() => {
    if (!hasStartedRef.current && !game.gameId) {
      hasStartedRef.current = true;
      game.startGame();
    }
  }, [game.gameId, game.startGame]);

  const bridge = useNarrativeBridge({
    gameId: game.gameId,
    onMoodUpdate: (personaId, mood) => {
      game.updatePersonaMood(personaId, mood);
    },
    onClueDiscovered: (clue) => {
      game.addClue(clue);
    },
    onDebugEvent: handleDebugEvent,
  });

  const handleInteract = useCallback(
    (entity: NearbyEntity) => {
      if (entity.type === "npc") {
        const persona = game.gameState?.personas.find((p) => p.id === entity.id);
        const personaName = persona?.name ?? "Unknown";
        bridge.startInteraction(
          entity.id,
          personaName,
          "Hello, I have some questions for you.",
        );
      } else if (entity.type === "clue") {
        // For environmental clues, we could open a dialogue showing the clue description
        // For now, just log it - clues are tracked in the HUD
        console.log("[GamePage] Clue interaction:", entity.id);
      }
    },
    [game.gameState?.personas, bridge],
  );

  const handleSendMessage = useCallback(
    (message: string) => {
      bridge.sendMessage(message);
    },
    [bridge],
  );

  const handleSelectChoice = useCallback(
    (choiceId: string, choiceLabel: string) => {
      bridge.selectChoice(choiceId, choiceLabel);
    },
    [bridge],
  );

  const handleAccuse = useCallback(
    (personaId: string) => {
      game.accuse(personaId);
    },
    [game],
  );

  const handleCloseDialogue = useCallback(() => {
    bridge.closeDialogue();
  }, [bridge]);

  const handleNewGame = useCallback(() => {
    window.location.reload();
  }, []);

  // Loading state
  if (game.isLoading && !game.gameState) {
    return (
      <div className="flex min-h-screen w-full flex-col items-center justify-center bg-slate-950 text-slate-200">
        <div className="mb-4 h-8 w-8 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
        <p className="text-sm opacity-75">
          {game.statusMessage ?? "Preparing the mystery..."}
        </p>
      </div>
    );
  }

  // Error state
  if (game.error) {
    return (
      <div className="flex min-h-screen w-full flex-col items-center justify-center bg-slate-950 text-slate-200">
        <p className="mb-4 text-red-400">Error: {game.error}</p>
        <button
          onClick={() => {
            hasStartedRef.current = false;
            game.endGame();
          }}
          className="rounded-md bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600"
        >
          Try Again
        </button>
      </div>
    );
  }

  // Game result state
  if (game.gameState?.status === "solved") {
    return (
      <div className="flex min-h-screen w-full flex-col items-center justify-center bg-slate-950 text-slate-200">
        <h1 className="mb-4 text-3xl font-bold text-green-400">Case Solved!</h1>
        <p className="mb-6 text-slate-400">
          You correctly identified the murderer.
        </p>
        <button
          onClick={() => {
            hasStartedRef.current = false;
            game.endGame();
          }}
          className="rounded-md bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600"
        >
          Play Again
        </button>
      </div>
    );
  }

  if (game.gameState?.status === "failed") {
    return (
      <div className="flex min-h-screen w-full flex-col items-center justify-center bg-slate-950 text-slate-200">
        <h1 className="mb-4 text-3xl font-bold text-red-400">Case Failed</h1>
        <p className="mb-6 text-slate-400">
          You accused the wrong person. The real murderer got away.
        </p>
        <button
          onClick={() => {
            hasStartedRef.current = false;
            game.endGame();
          }}
          className="rounded-md bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600"
        >
          Try Again
        </button>
      </div>
    );
  }

  // No game state yet
  if (!game.gameState) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-slate-950 text-slate-200">
        <p className="text-sm opacity-75">Initializing...</p>
      </div>
    );
  }

  // Active game state - render the game interface
  const dialoguePersonaId = bridge.dialogue.isOpen
    ? bridge.dialogue.personaId
    : null;

  return (
    <GameInterface
      personas={game.gameState.personas.map((p) => ({
        id: p.id,
        name: p.name,
        mood: p.mood,
      }))}
      clues={(game.gameState.clues ?? []).map((c) => ({
        id: c.id,
        title: c.title,
        description: c.description,
      }))}
      dialogueText={bridge.dialogue.text}
      dialogueIsStreaming={bridge.dialogue.isStreaming}
      dialogueChoices={bridge.dialogue.choices}
      dialoguePersonaId={dialoguePersonaId}
      onInteract={handleInteract}
      onSendMessage={handleSendMessage}
      onSelectChoice={handleSelectChoice}
      onAccuse={handleAccuse}
      onCloseDialogue={handleCloseDialogue}
      onNewGame={handleNewGame}
      debugEvents={debugEvents}
      onClearDebug={clearDebugEvents}
    />
  );
}
