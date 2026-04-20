"use client";

import dynamic from "next/dynamic";

// The GamePage wires the AI SDK narrative bridge to the PIXIJS game engine.
// PIXIJS requires browser WebGL/WebGPU APIs, so SSR must be disabled.
// Next.js 16 forbids `ssr: false` inside Server Components, so this page
// is a Client Component.
const GamePage = dynamic(
  () =>
    import("@/components/game/game-page").then((mod) => ({
      default: mod.GamePage,
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

export default function Home() {
  return <GamePage />;
}
