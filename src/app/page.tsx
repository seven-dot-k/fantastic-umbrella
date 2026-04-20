import dynamic from "next/dynamic";

// PIXIJS requires browser WebGL/WebGPU APIs; disable SSR for the entire shell.
const GameInterface = dynamic(
  () =>
    import("@/components/game/game-interface").then((mod) => ({
      default: mod.GameInterface,
    })),
  { ssr: false },
);

export default function Home() {
  return (
    <GameInterface
      personas={[]}
      clues={[]}
      dialogueText=""
      dialogueIsStreaming={false}
      dialogueChoices={null}
      dialoguePersonaId={null}
      onInteract={() => {}}
      onSendMessage={() => {}}
      onSelectChoice={() => {}}
      onAccuse={() => {}}
      onCloseDialogue={() => {}}
    />
  );
}
