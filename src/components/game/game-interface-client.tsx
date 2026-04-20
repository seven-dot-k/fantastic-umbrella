"use client";

import dynamic from "next/dynamic";
import type { GameInterfaceProps } from "./game-interface";

// PIXIJS requires browser WebGL/WebGPU APIs; disable SSR by dynamically
// loading the game shell inside a Client Component. Next.js 16 forbids
// `ssr: false` inside Server Components, so this wrapper is required.
const GameInterface = dynamic(
  () =>
    import("@/components/game/game-interface").then((mod) => ({
      default: mod.GameInterface,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-screen w-full items-center justify-center bg-slate-950 text-slate-200">
        <p className="text-sm opacity-75">Loading game engine...</p>
      </div>
    ),
  },
);

export default function GameInterfaceClient(props: GameInterfaceProps) {
  return <GameInterface {...props} />;
}
