"use client";

import { useTick } from "@pixi/react";
import type { Text as PixiText } from "pixi.js";
import { TextStyle } from "pixi.js";
import { useMemo, useRef } from "react";

interface InteractionPromptProps {
  x: number;
  y: number;
  visible: boolean;
}

/**
 * Floating "Press E" prompt that hovers above a target entity.
 * Gently bobs up and down and fades based on `visible`.
 */
export function InteractionPrompt({ x, y, visible }: InteractionPromptProps) {
  const textRef = useRef<PixiText | null>(null);
  const timeRef = useRef(0);

  const style = useMemo(
    () =>
      new TextStyle({
        fontFamily: "sans-serif",
        fontSize: 14,
        fontWeight: "bold",
        fill: 0xffffff,
        stroke: { color: 0x000000, width: 3 },
        align: "center",
      }),
    [],
  );

  useTick((ticker) => {
    timeRef.current += ticker.deltaTime;
    const text = textRef.current;
    if (text) {
      const bob = Math.sin(timeRef.current * 0.08) * 2;
      text.y = y - 30 + bob;
      text.alpha = visible ? 1 : 0;
    }
  });

  return (
    <pixiText
      ref={textRef}
      text="Press E"
      style={style}
      anchor={0.5}
      x={x}
      y={y - 30}
      alpha={visible ? 1 : 0}
    />
  );
}
