"use client";

import { useEffect, useRef, useState } from "react";

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
      className="pointer-events-auto absolute bottom-4 left-1/2 w-[min(720px,90%)] -translate-x-1/2 rounded-xl border border-amber-900/40 bg-[rgba(20,15,30,0.92)] text-slate-100 shadow-2xl backdrop-blur-md"
      role="dialog"
      aria-label="Dialogue"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-amber-900/30 px-4 py-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-amber-200">
            {personaName ?? "Unknown"}
          </span>
          {isStreaming && (
            <span
              className="text-xs text-amber-400/70 animate-pulse"
              aria-live="polite"
            >
              typing...
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md px-2 py-1 text-xs text-slate-400 hover:bg-slate-700/50 hover:text-slate-100 transition-colors"
          aria-label="Close dialogue"
        >
          Close
        </button>
      </div>

      {/* Text area */}
      <div
        ref={textRef}
        className="max-h-40 overflow-y-auto px-4 py-3 text-sm leading-relaxed text-slate-200"
      >
        {text || (
          <span className="text-slate-500 italic">...</span>
        )}
      </div>

      {/* Input / choices */}
      <div className="border-t border-amber-900/30 p-3">
        {choices && choices.length > 0 ? (
          <div className="flex flex-col gap-2">
            {choices.map((choice) => (
              <button
                key={choice.id}
                type="button"
                onClick={() => onSelectChoice(choice.id, choice.label)}
                className="rounded-lg border border-amber-900/40 bg-slate-800/50 px-3 py-2 text-left text-sm text-slate-100 hover:border-amber-500/60 hover:bg-slate-700/60 transition-colors"
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
              className="flex-1 rounded-lg border border-amber-900/40 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-amber-500/60 focus:outline-none disabled:opacity-50"
              autoFocus
            />
            <button
              type="submit"
              disabled={isStreaming || !input.trim()}
              className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-amber-500 transition-colors disabled:opacity-40"
            >
              Send
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
