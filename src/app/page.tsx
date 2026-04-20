"use client";

import dynamic from "next/dynamic";

const GamePage = dynamic(
  () =>
    import("@/components/game/game-page").then((mod) => ({
      default: mod.GamePage,
    })),
  { ssr: false },
);

export default function Home() {
  return <GamePage />;
}
