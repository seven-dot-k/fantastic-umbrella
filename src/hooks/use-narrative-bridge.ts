"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { NarrativeBridge } from "@/lib/narrative-bridge";
import type { DebugEvent, DebugChannel } from "@/components/overlay/debug-panel";

export interface DialogueState {
  isOpen: boolean;
  personaId: string | null;
  personaName: string | null;
  text: string;
  isStreaming: boolean;
  choices: { id: string; label: string }[] | null;
}

interface UseNarrativeBridgeOptions {
  gameId: string | null;
  onMoodUpdate: (personaId: string, mood: string) => void;
  onClueDiscovered: (clue: {
    id: string;
    title: string;
    description: string;
    relatedNpcIds: string[];
    discoveredAt: number;
    discoveredFrom: string;
  }) => void;
  onDebugEvent?: (event: DebugEvent) => void;
}

export interface NarrativeBridgeControls {
  dialogue: DialogueState;
  startInteraction: (personaId: string, personaName: string, message: string) => Promise<void>;
  sendMessage: (message: string) => Promise<void>;
  selectChoice: (choiceId: string, choiceLabel: string) => Promise<void>;
  submitAccusation: (personaId: string) => Promise<void>;
  closeDialogue: () => void;
}

/**
 * useNarrativeBridge - React hook that wraps the NarrativeBridge class lifecycle.
 *
 * Manages bridge instance, dialogue state, and directive dispatch.
 * This hook becomes the primary interface between React state and the streaming bridge.
 */
export function useNarrativeBridge(
  options: UseNarrativeBridgeOptions,
): NarrativeBridgeControls {
  const [dialogue, setDialogue] = useState<DialogueState>({
    isOpen: false,
    personaId: null,
    personaName: null,
    text: "",
    isStreaming: false,
    choices: null,
  });

  const bridgeRef = useRef<NarrativeBridge | null>(null);
  const optionsRef = useRef(options);
  const dialogueRef = useRef(dialogue);
  const debugSeqRef = useRef(0);

  const emitDebug = useCallback(
    (channel: DebugChannel, type: string, source: string, data?: unknown) => {
      optionsRef.current.onDebugEvent?.({
        id: `dbg-${++debugSeqRef.current}`,
        timestamp: Date.now(),
        channel,
        type,
        source,
        data,
      });
    },
    [],
  );

  // Update refs synchronously via useEffect to avoid refs-during-render lint errors
  useEffect(() => {
    optionsRef.current = options;
  });

  useEffect(() => {
    dialogueRef.current = dialogue;
  });

  // Directive handler using refs to avoid stale closures
  const handleDirectiveRef = useRef((toolName: string, output: unknown) => {
    const data = output as Record<string, unknown>;

    // Debug: log every tool output
    optionsRef.current.onDebugEvent?.({
      id: `dbg-${++debugSeqRef.current}`,
      timestamp: Date.now(),
      channel: "ai-sdk",
      type: "tool-output",
      source: `directive:${toolName}`,
      data: output,
    });

    switch (toolName) {
      case "set_npc_mood": {
        const mood = data.mood as string;
        const personaId = dialogueRef.current.personaId;
        if (personaId && mood) {
          optionsRef.current.onDebugEvent?.({
            id: `dbg-${++debugSeqRef.current}`,
            timestamp: Date.now(),
            channel: "game-bridge",
            type: "mood-update",
            source: personaId,
            data: { mood },
          });
          optionsRef.current.onMoodUpdate(personaId, mood);
        }
        break;
      }
      case "add_clue": {
        const clue = data.clue as {
          id: string;
          title: string;
          description: string;
          relatedNpcIds: string[];
          discoveredAt: number;
          discoveredFrom: string;
        };
        if (clue) {
          optionsRef.current.onDebugEvent?.({
            id: `dbg-${++debugSeqRef.current}`,
            timestamp: Date.now(),
            channel: "game-bridge",
            type: "clue",
            source: clue.discoveredFrom,
            data: { title: clue.title, description: clue.description },
          });
          optionsRef.current.onClueDiscovered(clue);
        }
        break;
      }
      case "present_dialog_choices": {
        const choices = data.choices as { id: string; label: string }[];
        if (choices && Array.isArray(choices)) {
          optionsRef.current.onDebugEvent?.({
            id: `dbg-${++debugSeqRef.current}`,
            timestamp: Date.now(),
            channel: "game-bridge",
            type: "choices",
            source: dialogueRef.current.personaId ?? "unknown",
            data: choices,
          });
          setDialogue((prev) => ({
            ...prev,
            choices,
          }));
        }
        break;
      }
    }
  });

  // Create/update bridge when gameId changes
  useEffect(() => {
    if (!options.gameId) {
      bridgeRef.current = null;
      return;
    }

    bridgeRef.current = new NarrativeBridge({
      gameId: options.gameId,
      onTextDelta: (delta) => {
        optionsRef.current.onDebugEvent?.({
          id: `dbg-${++debugSeqRef.current}`,
          timestamp: Date.now(),
          channel: "ai-sdk",
          type: "text-delta",
          source: "stream",
          data: delta.length > 80 ? delta.slice(0, 80) + "…" : delta,
        });
        setDialogue((prev) => ({
          ...prev,
          text: prev.text + delta,
          isStreaming: true,
        }));
      },
      onTextComplete: () => {
        optionsRef.current.onDebugEvent?.({
          id: `dbg-${++debugSeqRef.current}`,
          timestamp: Date.now(),
          channel: "ai-sdk",
          type: "text-complete",
          source: "stream",
          data: null,
        });
        setDialogue((prev) => ({
          ...prev,
          isStreaming: false,
        }));
      },
      onDirective: (toolName, output) => {
        handleDirectiveRef.current(toolName, output);
      },
      onInteractionComplete: () => {
        optionsRef.current.onDebugEvent?.({
          id: `dbg-${++debugSeqRef.current}`,
          timestamp: Date.now(),
          channel: "ai-sdk",
          type: "interaction-complete",
          source: "stream",
          data: null,
        });
        setDialogue((prev) => ({
          ...prev,
          isStreaming: false,
        }));
      },
      onError: (error) => {
        optionsRef.current.onDebugEvent?.({
          id: `dbg-${++debugSeqRef.current}`,
          timestamp: Date.now(),
          channel: "ai-sdk",
          type: "error",
          source: "stream",
          data: error,
        });
        console.error("[NarrativeBridge] Error:", error);
        setDialogue((prev) => ({
          ...prev,
          isStreaming: false,
        }));
      },
    });

    return () => {
      bridgeRef.current?.cancelCurrentInteraction();
      bridgeRef.current = null;
    };
  }, [options.gameId]);

  const startInteraction = useCallback(
    async (personaId: string, personaName: string, message: string) => {
      if (!bridgeRef.current) return;

      emitDebug("game-bridge", "interaction-start", personaId, { personaName, message });

      // Open dialogue panel and reset state
      setDialogue({
        isOpen: true,
        personaId,
        personaName,
        text: "",
        isStreaming: true,
        choices: null,
      });

      await bridgeRef.current.startInteraction(personaId, message);
    },
    [emitDebug],
  );

  const sendMessage = useCallback(async (message: string) => {
    const personaId = dialogueRef.current.personaId;
    if (!bridgeRef.current || !personaId) return;

    emitDebug("game-bridge", "message-sent", personaId, { message });

    // Clear choices and append to text
    setDialogue((prev) => ({
      ...prev,
      text: prev.text + `\n\n**You:** ${message}\n\n`,
      isStreaming: true,
      choices: null,
    }));

    await bridgeRef.current.sendMessage(personaId, message);
  }, [emitDebug]);

  const selectChoice = useCallback(
    async (choiceId: string, choiceLabel: string) => {
      const personaId = dialogueRef.current.personaId;
      if (!bridgeRef.current || !personaId) return;

      emitDebug("game-bridge", "message-sent", personaId, { choiceId, choiceLabel });

      // Clear choices and send choice label as message
      setDialogue((prev) => ({
        ...prev,
        text: prev.text + `\n\n**You:** ${choiceLabel}\n\n`,
        isStreaming: true,
        choices: null,
      }));

      await bridgeRef.current.sendMessage(personaId, choiceLabel);
    },
    [emitDebug],
  );

  const submitAccusation = useCallback(async (personaId: string) => {
    if (!bridgeRef.current) return;
    await bridgeRef.current.submitAccusation(personaId);
  }, []);

  const closeDialogue = useCallback(() => {
    bridgeRef.current?.cancelCurrentInteraction();
    setDialogue({
      isOpen: false,
      personaId: null,
      personaName: null,
      text: "",
      isStreaming: false,
      choices: null,
    });
  }, []);

  return {
    dialogue,
    startInteraction,
    sendMessage,
    selectChoice,
    submitAccusation,
    closeDialogue,
  };
}
