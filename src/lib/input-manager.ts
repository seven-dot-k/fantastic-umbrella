/**
 * InputManager - tracks keyboard state for WASD movement and E interaction.
 *
 * Used by PIXIJS game components via the `useKeyboard` hook. Attaches DOM
 * keydown/keyup listeners and maintains a Set of currently-pressed keys.
 */
export class InputManager {
  private keys = new Set<string>();
  private onKeyDownBound: (e: KeyboardEvent) => void;
  private onKeyUpBound: (e: KeyboardEvent) => void;

  constructor() {
    this.onKeyDownBound = (e) => this.keys.add(e.key.toLowerCase());
    this.onKeyUpBound = (e) => this.keys.delete(e.key.toLowerCase());
  }

  attach(): void {
    window.addEventListener("keydown", this.onKeyDownBound);
    window.addEventListener("keyup", this.onKeyUpBound);
  }

  detach(): void {
    window.removeEventListener("keydown", this.onKeyDownBound);
    window.removeEventListener("keyup", this.onKeyUpBound);
    this.keys.clear();
  }

  /** True if the key is currently held down. */
  isPressed(key: string): boolean {
    return this.keys.has(key.toLowerCase());
  }

  /**
   * Returns true once if the key is currently pressed, then clears it.
   * Use for single-press interactions (e.g. "E to interact").
   */
  consumePress(key: string): boolean {
    const lower = key.toLowerCase();
    const wasPressed = this.keys.has(lower);
    if (wasPressed) this.keys.delete(lower);
    return wasPressed;
  }
}
