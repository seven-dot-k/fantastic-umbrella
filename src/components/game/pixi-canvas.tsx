"use client";

import { Application, extend } from "@pixi/react";
import { Container, Graphics, Sprite, Text } from "pixi.js";
import type { ReactNode } from "react";

// Register PIXIJS display objects as JSX intrinsic elements.
// Must run once at module scope before any pixiXxx element is rendered.
extend({ Container, Sprite, Graphics, Text });

interface PixiCanvasProps {
  width: number;
  height: number;
  children: ReactNode;
}

/**
 * Wrapper around @pixi/react's <Application> that provides a sized container
 * for the game canvas. All PIXIJS children render inside this surface.
 */
export function PixiCanvas({ width, height, children }: PixiCanvasProps) {
  return (
    <div
      style={{
        width,
        height,
        position: "relative",
      }}
    >
      <Application width={width} height={height} background="#1a1a2e">
        {children}
      </Application>
    </div>
  );
}
