"use client";

import { useState, useCallback } from "react";
import { useGame } from "@/hooks/use-game";
import { PersonaCard } from "./persona-card";
import { PersonaChatPanel } from "./persona-chat-panel";
import { GameResult } from "./game-result";
import { EventLog } from "./event-log";
import { Skull, Search } from "lucide-react";

export function GameInterface() {
  const {
    gameId,
    gameState,
    statusMessage,
    isLoading,
    error,
    startGame,
    accuse,
    endGame,
    refreshState,
  } = useGame();

  const [selectedPersonaId, setSelectedPersonaId] = useState<string | null>(null);
  const [showAccuseConfirm, setShowAccuseConfirm] = useState(false);

  const handleAccuse = useCallback(async () => {
    if (!selectedPersonaId) return;
    setShowAccuseConfirm(false);
    await accuse(selectedPersonaId);
  }, [selectedPersonaId, accuse]);

  const handleNewGame = useCallback(async () => {
    await endGame();
    setSelectedPersonaId(null);
    setShowAccuseConfirm(false);
  }, [endGame]);

  // Game result screen
  if (gameState && gameState.status !== "active") {
    return <GameResult gameState={gameState} onNewGame={handleNewGame} />;
  }

  // Game lobby / start screen
  if (!gameId || !gameState) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="max-w-lg w-full mx-auto p-8 text-center">
          <div className="text-6xl mb-4">🔍</div>
          <h1 className="text-3xl font-bold mb-2">Murder Mystery</h1>
          <p className="text-muted-foreground mb-8">
            A guest has been found dead at the party. As the lead detective,
            interrogate the suspects and identify the killer before they escape.
          </p>

          {error && (
            <div className="text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2 mb-4">
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={startGame}
            disabled={isLoading}
            className="rounded-xl bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {isLoading ? "Generating Mystery..." : "Start Investigation"}
          </button>

          {isLoading && (
            <p className="text-xs text-muted-foreground mt-4 animate-pulse">
              {statusMessage || "Creating characters, motives, and clues..."}
            </p>
          )}
        </div>
      </div>
    );
  }

  const selectedPersona = gameState.personas.find(
    (p) => p.id === selectedPersonaId,
  );

  return (
    <div className="flex h-screen bg-background">
      {/* Left sidebar — scenario + personas */}
      <div className="w-72 flex-shrink-0 border-r border-border flex flex-col">
        {/* Scenario header */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-2 mb-2">
            <Search className="size-4 text-primary" />
            <h1 className="font-bold text-sm">{gameState.scenario.title}</h1>
          </div>
          <p className="text-xs text-muted-foreground">
            {gameState.scenario.setting}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Victim: {gameState.scenario.victimName} &middot;{" "}
            {gameState.scenario.timeOfDeath}
          </p>
        </div>

        {/* Synopsis */}
        <div className="p-4 border-b border-border">
          <p className="text-xs text-muted-foreground leading-relaxed">
            {gameState.scenario.synopsis}
          </p>
        </div>

        {/* Persona list */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-1">
            Suspects
          </h2>
          {gameState.personas.map((persona) => (
            <PersonaCard
              key={persona.id}
              persona={persona}
              isSelected={persona.id === selectedPersonaId}
              onClick={() => {
                setSelectedPersonaId(persona.id);
                refreshState();
              }}
            />
          ))}
        </div>

        {/* Event log */}
        <EventLog events={gameState.events} />

        {/* Accuse button */}
        <div className="p-3 border-t border-border">
          {showAccuseConfirm && selectedPersona ? (
            <div className="space-y-2">
              <p className="text-xs text-center text-muted-foreground">
                Accuse <strong>{selectedPersona.name}</strong> of murder?
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowAccuseConfirm(false)}
                  className="flex-1 rounded-lg border border-border px-3 py-2 text-xs hover:bg-muted transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAccuse}
                  disabled={isLoading}
                  className="flex-1 rounded-lg bg-destructive px-3 py-2 text-xs font-medium text-destructive-foreground hover:bg-destructive/90 transition-colors disabled:opacity-50"
                >
                  Confirm
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                if (selectedPersonaId) setShowAccuseConfirm(true);
              }}
              disabled={!selectedPersonaId || isLoading}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2.5 text-xs font-medium text-destructive hover:bg-destructive/20 transition-colors disabled:opacity-30"
            >
              <Skull className="size-3.5" />
              Accuse Selected Suspect
            </button>
          )}
        </div>
      </div>

      {/* Right panel — chat with selected persona */}
      <div className="flex-1 min-w-0">
        {selectedPersona ? (
          <PersonaChatPanel key={selectedPersona.id} persona={selectedPersona} gameId={gameId} />
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <div className="text-center">
              <Search className="size-8 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Select a suspect to begin interrogation</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
