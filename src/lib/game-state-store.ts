import type { GameState, FullGameState } from "@/workflows/schemas/game-state";

class FullGameStateStore {
  private states = new Map<string, FullGameState>();

  set(gameId: string, state: FullGameState): void {
    this.states.set(gameId, state);
  }

  get(gameId: string): FullGameState | undefined {
    return this.states.get(gameId);
  }

  has(gameId: string): boolean {
    return this.states.has(gameId);
  }

  delete(gameId: string): void {
    this.states.delete(gameId);
  }
}

export const fullGameStateStore = new FullGameStateStore();