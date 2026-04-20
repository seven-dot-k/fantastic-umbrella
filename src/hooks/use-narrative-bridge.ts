"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { NarrativeBridge } from "@/lib/narrative-bridge";

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

    switch (toolName) {
      case "set_npc_mood": {
        const mood = data.mood as string;
        const personaId = dialogueRef.current.personaId;
        if (personaId && mood) {
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
          optionsRef.current.onClueDiscovered(clue);
        }
        break;
      }
      case "present_dialog_choices": {
        const choices = data.choices as { id: string; label: string }[];
        if (choices && Array.isArray(choices)) {
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
        setDialogue((prev) => ({
          ...prev,
          text: prev.text + delta,
          isStreaming: true,
        }));
      },
      onTextComplete: () => {
        setDialogue((prev) => ({
          ...prev,
          isStreaming: false,
        }));
      },
      onDirective: (toolName, output) => {
        handleDirectiveRef.current(toolName, output);
      },
      onInteractionComplete: () => {
        setDialogue((prev) => ({
          ...prev,
          isStreaming: false,
        }));
      },
      onError: (error) => {
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
    [],
  );

  const sendMessage = useCallback(async (message: string) => {
    const personaId = dialogueRef.current.personaId;
    if (!bridgeRef.current || !personaId) return;

    // Clear choices and append to text
    setDialogue((prev) => ({
      ...prev,
      text: prev.text + `\n\n**You:** ${message}\n\n`,
      isStreaming: true,
      choices: null,
    }));

    await bridgeRef.current.sendMessage(personaId, message);
  }, []);

  const selectChoice = useCallback(
    async (choiceId: string, choiceLabel: string) => {
      const personaId = dialogueRef.current.personaId;
      if (!bridgeRef.current || !personaId) return;

      // Clear choices and send choice label as message
      setDialogue((prev) => ({
        ...prev,
        text: prev.text + `\n\n**You:** ${choiceLabel}\n\n`,
        isStreaming: true,
        choices: null,
      }));

      await bridgeRef.current.sendMessage(personaId, choiceLabel);
    },
    [],
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
