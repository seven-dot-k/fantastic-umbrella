import GameInterfaceClient from "@/components/game/game-interface-client";

export default function Home() {
  // Stub props; the bridge plan will wire real game state and callbacks.
  return (
    <GameInterfaceClient
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
