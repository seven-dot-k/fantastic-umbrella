"use client";

import { useRef, useEffect } from "react";
import { usePersonaChat } from "@/hooks/use-persona-chat";
import { ChatMessage } from "@/components/chat/chat-message";
import { ChatInput } from "@/components/chat/chat-input";
import type { Persona } from "@/workflows/schemas/game-state";

interface PersonaChatPanelProps {
  persona: Persona;
  gameId: string;
}

export function PersonaChatPanel({ persona, gameId }: PersonaChatPanelProps) {
  const {
    messages,
    sendMessage,
    isGenerating,
    error,
    pendingMessage,
  } = usePersonaChat(persona.id, gameId);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
        <div>
          <h2 className="font-semibold text-sm">{persona.name}</h2>
          <p className="text-xs text-muted-foreground">
            {persona.occupation} &middot; Mood: {persona.mood} &middot; Sanity:{" "}
            {persona.sanity}
          </p>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && !pendingMessage && (
          <div className="text-center text-sm text-muted-foreground mt-8">
            <p>Begin your interrogation of {persona.name}.</p>
            <p className="mt-1 text-xs">
              Ask questions to uncover the truth about the murder.
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <ChatMessage key={msg.id} message={msg} />
        ))}

        {pendingMessage && (
          <div className="flex w-full max-w-[95%] flex-col gap-2 ml-auto items-end">
            <div className="flex w-fit min-w-0 max-w-full flex-col gap-2 text-sm ml-auto rounded-2xl bg-secondary px-4 py-3 text-secondary-foreground opacity-60">
              <span className="leading-relaxed whitespace-pre-wrap">
                {pendingMessage}
              </span>
            </div>
          </div>
        )}

        {isGenerating && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <div className="flex gap-1">
              <span className="animate-bounce" style={{ animationDelay: "0ms" }}>·</span>
              <span className="animate-bounce" style={{ animationDelay: "150ms" }}>·</span>
              <span className="animate-bounce" style={{ animationDelay: "300ms" }}>·</span>
            </div>
            <span>{persona.name} is thinking...</span>
          </div>
        )}

        {error && (
          <div className="text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2">
            Error: {error.message}
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-4 border-t border-border">
        <ChatInput
          onSend={sendMessage}
          disabled={isGenerating}
        />
      </div>
    </div>
  );
}
