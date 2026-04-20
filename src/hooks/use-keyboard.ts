"use client";

import { useEffect, useRef } from "react";
import { InputManager } from "@/lib/input-manager";

/**
 * React hook that returns a stable InputManager instance, attaching its
 * keyboard listeners on mount and detaching them on unmount.
 */
export function useKeyboard(): InputManager {
  const manager = useRef<InputManager | null>(null);
  if (manager.current === null) {
    manager.current = new InputManager();
  }

  useEffect(() => {
    const instance = manager.current;
    instance?.attach();
    return () => {
      instance?.detach();
    };
  }, []);

  return manager.current;
}
