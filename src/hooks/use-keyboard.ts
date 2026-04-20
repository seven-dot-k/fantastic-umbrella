"use client";

import { useEffect, useState } from "react";
import { InputManager } from "@/lib/input-manager";

/**
 * React hook that returns a stable InputManager instance, attaching its
 * keyboard listeners on mount and detaching them on unmount.
 *
 * Uses lazy useState initializer so the manager instance is created once
 * per mount without accessing refs during render.
 */
export function useKeyboard(): InputManager {
  const [manager] = useState(() => new InputManager());

  useEffect(() => {
    manager.attach();
    return () => {
      manager.detach();
    };
  }, [manager]);

  return manager;
}
