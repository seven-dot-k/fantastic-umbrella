"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  GameInterface,
  type GameInterfaceClue,
  type GameInterfacePersona,
} from "./game-interface";
import type { NearbyEntity } from "./player";
import { useGame } from "@/hooks/use-game";
import { useNarrativeBridge } from "@/hooks/use-narrative-bridge";
import type { Clue } from "@/workflows/schemas/game-state";

/**
 * GamePage
 *
 * Integration layer that wires the game lifecycle (`useGame`) and the
 * streaming narrative bridge (`useNarrativeBridge`) to the prop-driven
 * `GameInterface` component from the engine plan.
 *
 * This is the only file that imports both the engine (`GameInterface`) and
 * the bridge (`useNarrativeBridge`) — a deliberate seam that keeps each
 * plan's responsibilities isolated.
 *
 * Local state kept here:
 * - `moodOverrides`: per-persona mood patches received via `set_npc_mood`.
 *   The backend default stream only publishes the initial game state; the
 *   bridge surfaces mood changes that happen during dialogue.
 * - `discoveredClues`: clues appended via `add_clue` directives from the
 *   bridge. Merged with any clues that arrive in the main game state.
 */
export function GamePage() {
  const game = useGame();

  const [moodOverrides, setMoodOverrides] = useState<Record<string, string>>(
    {},
  );
  const [discoveredClues, setDiscoveredClues] = useState<Clue[]>([]);
  const [bridgeError, setBridgeError] = useState<string | null>(null);

  const bridge = useNarrativeBridge({
    gameId: game.gameId,
    onMoodUpdate: useCallback((personaId: string, mood: string) => {
      setMoodOverrides((prev) => ({ ...prev, [personaId]: mood }));
    }, []),
    onClueDiscovered: useCallback((clue: Clue) => {
      setDiscoveredClues((prev) => {
        if (prev.some((c) => c.id === clue.id)) return prev;
        return [...prev, clue];
      });
    }, []),
    onError: useCallback((error: string) => {
      console.error("[GamePage] Bridge error:", error);
      setBridgeError(error);
    }, []),
  });

  // Start a new game on mount when no session is already persisted.
  // If a gameId was restored from localStorage, refresh its state instead.
  useEffect(() => {
    if (game.gameId) {
      game.refreshState();
    } else {
      game.startGame();
    }
    // Intentionally run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Merge backend personas with local mood overrides.
  const personas: GameInterfacePersona[] = useMemo(() => {
    const base = game.gameState?.personas ?? [];
    return base.map((p) => ({
      id: p.id,
      name: p.name,
      mood: moodOverrides[p.id] ?? p.mood,
    }));
  }, [game.gameState, moodOverrides]);

  // Merge backend clues with bridge-discovered clues (id-deduped).
  const clues: GameInterfaceClue[] = useMemo(() => {
    const backendClues = game.gameState?.clues ?? [];
    const seen = new Set<string>();
    const merged: GameInterfaceClue[] = [];
    for (const c of [...backendClues, ...discoveredClues]) {
      if (seen.has(c.id)) continue;
      seen.add(c.id);
      merged.push({
        id: c.id,
        title: c.title,
        description: c.description,
      });
    }
    return merged;
  }, [game.gameState, discoveredClues]);

  const handleInteract = useCallback(
    (entity: NearbyEntity) => {
      if (entity.type === "npc") {
        void bridge.startInteraction(
          entity.id,
          "Hello, I have some questions for you.",
        );
        return;
      }
      // Environment clue inspection: deferred to WI-03 (LLM-driven
      // environment clue descriptions). The engine surfaces the clue list
      // in the HUD inventory as soon as it is discovered.
      // Accusation entities are handled internally by GameInterface.
    },
    [bridge],
  );

  const handleSendMessage = useCallback(
    (message: string) => {
      void bridge.sendMessage(message);
    },
    [bridge],
  );

  const handleSelectChoice = useCallback(
    (id: string, label: string) => {
      void bridge.selectChoice(id, label);
    },
    [bridge],
  );

  const handleAccuse = useCallback(
    (personaId: string) => {
      void bridge.submitAccusation(personaId);
    },
    [bridge],
  );

  const handleCloseDialogue = useCallback(() => {
    void bridge.closeDialogue();
  }, [bridge]);

  // Loading / error gate before the engine renders.
  if (!game.gameState) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-slate-950 text-slate-200">
        <div className="flex flex-col items-center gap-3 text-center">
          <p className="text-sm opacity-80">
            {game.statusMessage ?? "Preparing the investigation..."}
          </p>
          {game.error && (
            <p className="text-xs text-red-400">{game.error}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      <GameInterface
        personas={personas}
        clues={clues}
        dialogueText={bridge.dialogue.text}
        dialogueIsStreaming={bridge.dialogue.isStreaming}
        dialogueChoices={bridge.dialogue.choices}
        dialoguePersonaId={bridge.dialogue.personaId}
        onInteract={handleInteract}
        onSendMessage={handleSendMessage}
        onSelectChoice={handleSelectChoice}
        onAccuse={handleAccuse}
        onCloseDialogue={handleCloseDialogue}
      />
      {bridgeError && (
        <div
          className="pointer-events-auto fixed bottom-4 right-4 z-50 max-w-xs rounded-md border border-red-700 bg-red-900/90 px-3 py-2 text-xs text-red-100 shadow-lg"
          role="alert"
        >
          <div className="font-semibold">Bridge error</div>
          <div className="opacity-80">{bridgeError}</div>
          <button
            type="button"
            onClick={() => setBridgeError(null)}
            className="mt-1 text-[11px] underline opacity-75 hover:opacity-100"
          >
            Dismiss
          </button>
        </div>
      )}
    </>
  );
}
