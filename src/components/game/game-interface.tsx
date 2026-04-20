"use client";

import { useCallback, useMemo, useState } from "react";
import { useKeyboard } from "@/hooks/use-keyboard";
import {
  createDefaultMapLayout,
  type MapLayout,
} from "@/lib/game-config";
import { ClueObject } from "./clue-object";
import { GameWorld } from "./game-world";
import { InteractionPrompt } from "./interaction-prompt";
import { Npc } from "./npc";
import { PixiCanvas } from "./pixi-canvas";
import { Player, type NearbyEntity } from "./player";
import { AccusationModal } from "@/components/overlay/accusation-modal";
import {
  DialoguePanel,
  type DialogueChoice,
} from "@/components/overlay/dialogue-panel";
import { HudPanel } from "@/components/overlay/hud-panel";

export interface GameInterfacePersona {
  id: string;
  name: string;
  mood: string;
}

export interface GameInterfaceClue {
  id: string;
  title: string;
  description: string;
}

export interface GameInterfaceProps {
  /** Game state from the backend */
  personas: GameInterfacePersona[];
  clues: GameInterfaceClue[];
  /** Dialogue state (driven by bridge in the bridge plan) */
  dialogueText: string;
  dialogueIsStreaming: boolean;
  dialogueChoices: DialogueChoice[] | null;
  dialoguePersonaId: string | null;
  /** Callbacks for external integration */
  onInteract: (entity: NearbyEntity) => void;
  onSendMessage: (message: string) => void;
  onSelectChoice: (choiceId: string, choiceLabel: string) => void;
  onAccuse: (personaId: string) => void;
  onCloseDialogue: () => void;
}

/**
 * Top-level game shell.
 *
 * - Renders the PIXIJS canvas with GameWorld and entities (Player, NPCs,
 *   clues, interaction prompt).
 * - Renders DOM overlays (HUD, dialogue, accusation modal) absolutely
 *   positioned over the canvas.
 * - Owns only engine-local state (nearby entity, accusation modal visibility).
 *   All backend-driven state and actions flow through props/callbacks.
 */
export function GameInterface({
  personas,
  clues,
  dialogueText,
  dialogueIsStreaming,
  dialogueChoices,
  dialoguePersonaId,
  onInteract,
  onSendMessage,
  onSelectChoice,
  onAccuse,
  onCloseDialogue,
}: GameInterfaceProps) {
  const inputManager = useKeyboard();

  const mapLayout: MapLayout = useMemo(
    () => createDefaultMapLayout(personas.map((p) => p.id)),
    [personas],
  );

  const [nearby, setNearby] = useState<NearbyEntity | null>(null);
  const [showAccusation, setShowAccusation] = useState(false);

  const handleNearbyEntity = useCallback((entity: NearbyEntity | null) => {
    setNearby(entity);
  }, []);

  const handleInteract = useCallback(
    (entity: NearbyEntity) => {
      if (entity.type === "accusation") {
        setShowAccusation(true);
        return;
      }
      onInteract(entity);
    },
    [onInteract],
  );

  const handleAccuse = useCallback(
    (personaId: string) => {
      setShowAccusation(false);
      onAccuse(personaId);
    },
    [onAccuse],
  );

  const handleCancelAccusation = useCallback(() => {
    setShowAccusation(false);
  }, []);

  // Look up the prompt position from the current nearby entity.
  const promptPosition = useMemo(() => {
    if (!nearby) return null;
    if (nearby.type === "npc") {
      const found = mapLayout.npcs.find((n) => n.personaId === nearby.id);
      return found ? { x: found.x, y: found.y } : null;
    }
    if (nearby.type === "clue") {
      const found = mapLayout.clues.find((c) => c.clueId === nearby.id);
      return found ? { x: found.x, y: found.y } : null;
    }
    return {
      x: mapLayout.accusationPoint.x,
      y: mapLayout.accusationPoint.y,
    };
  }, [nearby, mapLayout]);

  const dialoguePersona = dialoguePersonaId
    ? personas.find((p) => p.id === dialoguePersonaId) ?? null
    : null;
  const dialogueIsOpen = dialoguePersonaId !== null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 p-4">
      <div
        className="relative select-none overflow-hidden rounded-2xl border border-amber-900/30 shadow-2xl"
        style={{ width: mapLayout.width, height: mapLayout.height }}
      >
        {/* Layer 0: PIXIJS canvas */}
        <div className="absolute inset-0 z-0">
          <PixiCanvas width={mapLayout.width} height={mapLayout.height}>
            <GameWorld mapLayout={mapLayout}>
              {mapLayout.clues.map((c) => (
                <ClueObject key={c.clueId} x={c.x} y={c.y} />
              ))}
              {mapLayout.npcs.map((placement) => {
                const persona = personas.find(
                  (p) => p.id === placement.personaId,
                );
                return (
                  <Npc
                    key={placement.personaId}
                    x={placement.x}
                    y={placement.y}
                    name={persona?.name ?? placement.personaId}
                    mood={persona?.mood ?? "calm"}
                    spriteSeed={placement.personaId}
                  />
                );
              })}
              <Player
                inputManager={inputManager}
                mapLayout={mapLayout}
                spawnX={mapLayout.playerSpawn.x}
                spawnY={mapLayout.playerSpawn.y}
                onNearbyEntity={handleNearbyEntity}
                onInteract={handleInteract}
              />
              {promptPosition && (
                <InteractionPrompt
                  x={promptPosition.x}
                  y={promptPosition.y}
                  visible={nearby !== null}
                />
              )}
            </GameWorld>
          </PixiCanvas>
        </div>

        {/* Overlay container (pointer-events pass-through) */}
        <div className="pointer-events-none absolute inset-0 z-10">
          {/* HUD: left side */}
          <div className="absolute left-3 top-3 bottom-3">
            <HudPanel personas={personas} clues={clues} />
          </div>

          {/* Dialogue: bottom */}
          <DialoguePanel
            isOpen={dialogueIsOpen}
            personaName={dialoguePersona?.name ?? null}
            text={dialogueText}
            isStreaming={dialogueIsStreaming}
            choices={dialogueChoices}
            onSendMessage={onSendMessage}
            onSelectChoice={onSelectChoice}
            onClose={onCloseDialogue}
          />
        </div>

        {/* Accusation modal (its own z-30 layer, covers canvas + overlays) */}
        <AccusationModal
          isOpen={showAccusation}
          personas={personas}
          onAccuse={handleAccuse}
          onCancel={handleCancelAccusation}
        />

        {/* Controls hint */}
        <div className="pointer-events-none absolute right-3 top-3 z-10 rounded-md border border-amber-900/30 bg-[rgba(20,15,30,0.75)] px-3 py-1.5 text-[11px] text-slate-300 backdrop-blur-sm">
          WASD to move &middot; E to interact
        </div>
      </div>
    </div>
  );
}
