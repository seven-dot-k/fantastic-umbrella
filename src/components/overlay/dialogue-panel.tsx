"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import ReactMarkdown from "react-markdown";

export interface DialogueChoice {
  id: string;
  label: string;
}

interface DialoguePanelProps {
  isOpen: boolean;
  personaName: string | null;
  text: string;
  isStreaming: boolean;
  choices: DialogueChoice[] | null;
  onSendMessage: (message: string) => void;
  onSelectChoice: (choiceId: string, choiceLabel: string) => void;
  onClose: () => void;
}

/**
 * Bottom-of-screen dialogue overlay. Pure UI shell — fires callbacks for
 * all user actions and never imports bridge/AI logic directly.
 */
export function DialoguePanel({
  isOpen,
  personaName,
  text,
  isStreaming,
  choices,
  onSendMessage,
  onSelectChoice,
  onClose,
}: DialoguePanelProps) {
  const [input, setInput] = useState("");
  const textRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (textRef.current) {
      textRef.current.scrollTop = textRef.current.scrollHeight;
    }
  }, [text]);

  // Parse text into speaker-attributed segments
  const segments = useMemo(() => {
    if (!text) return [];
    // Split on the **You:** markers that the bridge injects
    const parts = text.split(/\n\n\*\*You:\*\*\s*/);
    const result: { speaker: "npc" | "player"; content: string }[] = [];

    // First part is always NPC text
    if (parts[0]?.trim()) {
      result.push({ speaker: "npc", content: parts[0].trim() });
    }

    // Subsequent parts start with player text, then NPC response
    for (let i = 1; i < parts.length; i++) {
      const segment = parts[i];
      // The player message ends at the next double newline (NPC response follows)
      const nlIdx = segment.indexOf("\n\n");
      if (nlIdx === -1) {
        // Only player text, no NPC response yet (streaming)
        result.push({ speaker: "player", content: segment.trim() });
      } else {
        const playerText = segment.slice(0, nlIdx).trim();
        const npcText = segment.slice(nlIdx + 2).trim();
        if (playerText) result.push({ speaker: "player", content: playerText });
        if (npcText) result.push({ speaker: "npc", content: npcText });
      }
    }
    return result;
  }, [text]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;
    onSendMessage(trimmed);
    setInput("");
  };

  return (
    <div
      className="pointer-events-auto absolute bottom-4 left-1/2 w-[min(720px,90%)] -translate-x-1/2 rounded-xl border border-amber-900/40 bg-[#5A2A2A] text-slate-100 shadow-2xl backdrop-blur-md"
      role="dialog"
      aria-label="Dialogue"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-amber-900/30 px-4 py-1.5">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-amber-200">
            {personaName ?? "Unknown"}
          </span>
          {isStreaming && (
            <span
              className="text-[10px] text-amber-400/70 animate-pulse"
              aria-live="polite"
            >
              typing...
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md px-2 py-0.5 text-[10px] text-slate-400 hover:bg-slate-700/50 hover:text-slate-100 transition-colors"
          aria-label="Close dialogue"
        >
          Close
        </button>
      </div>

      {/* Text area — speaker-attributed segments with markdown */}
      <div
        ref={textRef}
        className="max-h-40 overflow-y-auto px-4 py-2 text-xs leading-relaxed"
      >
        {segments.length === 0 ? (
          <span className="text-slate-500 italic">...</span>
        ) : (
          <div className="flex flex-col gap-2">
            {segments.map((seg, i) =>
              seg.speaker === "player" ? (
                <div key={i} className="flex justify-end">
                  <div className="max-w-[80%] rounded-lg bg-amber-800/40 px-3 py-1.5">
                    <span className="text-[10px] font-semibold text-amber-300">You</span>
                    <div className="text-slate-200">{seg.content}</div>
                  </div>
                </div>
              ) : (
                <div key={i} className="flex justify-start">
                  <div className="max-w-[80%] rounded-lg bg-slate-800/40 px-3 py-1.5">
                    <span className="text-[10px] font-semibold text-cyan-300">
                      {personaName ?? "NPC"}
                    </span>
                    <div className="prose-invert text-slate-200 [&_p]:m-0 [&_p]:leading-relaxed [&_strong]:text-amber-200">
                      <ReactMarkdown>{seg.content}</ReactMarkdown>
                    </div>
                  </div>
                </div>
              ),
            )}
          </div>
        )}
      </div>

      {/* Input / choices */}
      <div className="border-t border-amber-900/30 p-2">
        {choices && choices.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {choices.map((choice) => (
              <button
                key={choice.id}
                type="button"
                onClick={() => onSelectChoice(choice.id, choice.label)}
                className="rounded-md border border-amber-900/40 bg-slate-800/50 px-2.5 py-1 text-xs text-slate-100 hover:border-amber-500/60 hover:bg-slate-700/60 transition-colors"
              >
                {choice.label}
              </button>
            ))}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Say something..."
              disabled={isStreaming}
              className="flex-1 rounded-md border border-amber-900/40 bg-slate-900/60 px-2.5 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:border-amber-500/60 focus:outline-none disabled:opacity-50"
              autoFocus
            />
            <button
              type="submit"
              disabled={isStreaming || !input.trim()}
              className="rounded-md bg-amber-600 px-3 py-1.5 text-xs font-medium text-slate-950 hover:bg-amber-500 transition-colors disabled:opacity-40"
            >
              Send
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
