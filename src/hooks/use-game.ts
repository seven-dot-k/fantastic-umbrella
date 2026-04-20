"use client";

import { useState, useCallback, useRef } from "react";
import { uiMessageChunkSchema, parseJsonEventStream } from "ai";
import type { GameState } from "@/workflows/schemas/game-state";

const GAME_STORAGE_KEY = "murder-mystery-game-id";

export interface UseGameReturn {
  gameId: string | null;
  gameState: GameState | null;
  statusMessage: string | null;
  isLoading: boolean;
  error: string | null;
  startGame: () => Promise<void>;
  refreshState: () => Promise<void>;
  accuse: (personaId: string) => Promise<void>;
  endGame: () => Promise<void>;
}

export function useGame(): UseGameReturn {
  const [gameId, setGameId] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem(GAME_STORAGE_KEY);
    }
    return null;
  });
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const startGame = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setStatusMessage("Starting game...");
    setGameState(null);

    abortRef.current?.abort();
    const abortController = new AbortController();
    abortRef.current = abortController;

    try {
      const response = await fetch("/api/run", {
        method: "POST",
        signal: abortController.signal,
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Failed to start game");
      }

      const runId = response.headers.get("x-workflow-run-id");
      if (runId) {
        setGameId(runId);
        localStorage.setItem(GAME_STORAGE_KEY, runId);
      }

      // Parse the raw byte stream into UIMessageChunks
      const chunkStream = parseJsonEventStream({
        stream: response.body!,
        schema: uiMessageChunkSchema,
      });

      const reader = chunkStream.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!value.success) continue;

        const chunk = value.value;
        if (chunk.type === "data-workflow") {
          const data = chunk.data as {
            type: string;
            state?: GameState;
            message?: string;
          };
          if (data.type === "status" && data.message) {
            setStatusMessage(data.message);
          } else if (data.type === "game-state" && data.state) {
            // Defensive: guarantee clues is always an array for consumers.
            const normalized: GameState = {
              ...data.state,
              clues: data.state.clues ?? [],
            };
            setGameState(normalized);
            setStatusMessage(null);
          }
        }
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Failed to start game");
      setStatusMessage(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refreshState = useCallback(async () => {
    if (!gameId) return;

    try {
      const response = await fetch(
        `/api/run/${encodeURIComponent(gameId)}/state`,
      );
      if (!response.ok) {
        if (response.status === 404) {
          // Game expired
          setGameId(null);
          setGameState(null);
          localStorage.removeItem(GAME_STORAGE_KEY);
          return;
        }
        throw new Error("Failed to fetch game state");
      }

      const data = await response.json();
      setGameState(data.gameState);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to refresh state",
      );
    }
  }, [gameId]);

  const accuse = useCallback(
    async (personaId: string) => {
      if (!gameId) return;
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/run/${encodeURIComponent(gameId)}/event`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type: "accuse", personaId }),
          },
        );

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error || "Failed to submit accusation");
        }

        // Refresh state to get the result
        await refreshState();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to submit accusation",
        );
      } finally {
        setIsLoading(false);
      }
    },
    [gameId, refreshState],
  );

  const endGame = useCallback(async () => {
    if (!gameId) return;

    try {
      await fetch(`/api/run/${encodeURIComponent(gameId)}/event`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "end-game" }),
      });
    } catch {
      // Best effort
    }

    setGameId(null);
    setGameState(null);
    localStorage.removeItem(GAME_STORAGE_KEY);
  }, [gameId]);

  return {
    gameId,
    gameState,
    statusMessage,
    isLoading,
    error,
    startGame,
    refreshState,
    accuse,
    endGame,
  };
}
