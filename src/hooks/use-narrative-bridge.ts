"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { NarrativeBridge } from "@/lib/narrative-bridge";
import type { Clue } from "@/workflows/schemas/game-state";

export interface DialogueChoice {
  id: string;
  label: string;
}

export interface DialogueState {
  personaId: string | null;
  text: string;
  isStreaming: boolean;
  choices: DialogueChoice[] | null;
}

export interface UseNarrativeBridgeOptions {
  /** Current game workflow run id. If null, the bridge is not yet ready. */
  gameId: string | null;
  /** Invoked when a persona explicitly updates its visible mood. */
  onMoodUpdate?: (personaId: string, mood: string) => void;
  /** Invoked when a persona reveals a clue. */
  onClueDiscovered?: (clue: Clue) => void;
  /** Optional: invoked on bridge-layer errors (stream failures, etc). */
  onError?: (error: string) => void;
}

export interface NarrativeBridgeControls {
  dialogue: DialogueState;
  isReady: boolean;
  startInteraction: (personaId: string, message: string) => Promise<void>;
  sendMessage: (message: string) => Promise<void>;
  selectChoice: (choiceId: string, choiceLabel: string) => Promise<void>;
  submitAccusation: (personaId: string) => Promise<void>;
  closeDialogue: () => Promise<void>;
}

/**
 * useNarrativeBridge — Wraps the `NarrativeBridge` class lifecycle in a React
 * hook. Manages the dialogue panel state and dispatches tool directives.
 *
 * - Stores the active persona id and the accumulated dialogue text.
 * - Forwards `set_npc_mood` / `add_clue` directives to caller-provided
 *   callbacks. Renders `present_dialog_choices` results locally as button
 *   options in the dialogue panel.
 * - `startInteraction` opens the persona SSE stream and resolves when the
 *   stream ends. `sendMessage` fires follow-up messages over the same
 *   persistent stream.
 */
export function useNarrativeBridge(
  options: UseNarrativeBridgeOptions,
): NarrativeBridgeControls {
  const { gameId, onMoodUpdate, onClueDiscovered, onError } = options;

  const [dialogue, setDialogue] = useState<DialogueState>({
    personaId: null,
    text: "",
    isStreaming: false,
    choices: null,
  });

  const bridgeRef = useRef<NarrativeBridge | null>(null);
  const currentPersonaRef = useRef<string | null>(null);

  // Keep callbacks up to date without re-creating the bridge.
  const onMoodUpdateRef = useRef(onMoodUpdate);
  const onClueDiscoveredRef = useRef(onClueDiscovered);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onMoodUpdateRef.current = onMoodUpdate;
    onClueDiscoveredRef.current = onClueDiscovered;
    onErrorRef.current = onError;
  }, [onMoodUpdate, onClueDiscovered, onError]);

  // Create / recreate the bridge whenever gameId becomes available or changes.
  useEffect(() => {
    if (!gameId) {
      bridgeRef.current = null;
      return;
    }

    const bridge = new NarrativeBridge({
      gameId,
      onTextDelta: (delta) => {
        setDialogue((prev) => ({
          ...prev,
          text: prev.text + delta,
          isStreaming: true,
        }));
      },
      onTextComplete: () => {
        setDialogue((prev) => ({ ...prev, isStreaming: false }));
      },
      onDirective: (toolName, output) => {
        switch (toolName) {
          case "set_npc_mood": {
            const out = output as {
              personaId?: string;
              mood?: string;
            } | null;
            if (out?.personaId && out?.mood) {
              onMoodUpdateRef.current?.(out.personaId, out.mood);
            }
            break;
          }
          case "add_clue": {
            const out = output as { clue?: Clue } | null;
            if (out?.clue) {
              onClueDiscoveredRef.current?.(out.clue);
            }
            break;
          }
          case "present_dialog_choices": {
            const out = output as {
              choices?: DialogueChoice[];
            } | null;
            if (out?.choices && out.choices.length > 0) {
              setDialogue((prev) => ({
                ...prev,
                choices: out.choices ?? null,
              }));
            }
            break;
          }
          default:
            // add_event, get_current_state and other tools are handled via the
            // workflow's own game-state stream — no client-side directive needed.
            break;
        }
      },
      onInteractionComplete: () => {
        setDialogue((prev) => ({ ...prev, isStreaming: false }));
      },
      onError: (error) => {
        setDialogue((prev) => ({ ...prev, isStreaming: false }));
        onErrorRef.current?.(error);
      },
    });

    bridgeRef.current = bridge;

    return () => {
      bridge.cancelCurrentInteraction();
      if (bridgeRef.current === bridge) {
        bridgeRef.current = null;
      }
    };
  }, [gameId]);

  const startInteraction = useCallback(
    async (personaId: string, message: string) => {
      const bridge = bridgeRef.current;
      if (!bridge) return;

      currentPersonaRef.current = personaId;
      setDialogue({
        personaId,
        text: "",
        isStreaming: true,
        choices: null,
      });

      // Fire-and-forget: bridge.startInteraction resolves only when the
      // stream closes. We still want the caller's Promise to resolve
      // immediately so the UI isn't blocked.
      void bridge.startInteraction(personaId, message);
    },
    [],
  );

  const sendMessage = useCallback(
    async (message: string) => {
      const bridge = bridgeRef.current;
      const personaId = currentPersonaRef.current;
      if (!bridge || !personaId || !gameId) return;

      setDialogue((prev) => ({
        ...prev,
        text: "",
        isStreaming: true,
        choices: null,
      }));

      await bridge.sendMessage(personaId, message, gameId);
    },
    [gameId],
  );

  const selectChoice = useCallback(
    async (_choiceId: string, choiceLabel: string) => {
      setDialogue((prev) => ({ ...prev, choices: null }));
      await sendMessage(choiceLabel);
    },
    [sendMessage],
  );

  const submitAccusation = useCallback(
    async (personaId: string) => {
      const bridge = bridgeRef.current;
      if (!bridge) return;
      await bridge.submitAccusation(personaId);
    },
    [],
  );

  const closeDialogue = useCallback(async () => {
    const bridge = bridgeRef.current;
    const personaId = currentPersonaRef.current;

    currentPersonaRef.current = null;
    setDialogue({
      personaId: null,
      text: "",
      isStreaming: false,
      choices: null,
    });

    if (bridge && personaId) {
      await bridge.endPersonaChat(personaId);
    } else if (bridge) {
      bridge.cancelCurrentInteraction();
    }
  }, []);

  return {
    dialogue,
    isReady: gameId !== null,
    startInteraction,
    sendMessage,
    selectChoice,
    submitAccusation,
    closeDialogue,
  };
}
