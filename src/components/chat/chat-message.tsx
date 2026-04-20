"use client";

import type { UIMessage } from "ai";
import { isToolUIPart, getToolName } from "ai";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";
import { Shimmer } from "@/components/ui/shimmer";
import {
  CheckCircleIcon,
  WrenchIcon,
  XCircleIcon,
  ClockIcon,
} from "lucide-react";


interface ChatMessageProps {
  message: UIMessage;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";

  return (
    <div
      className={cn(
        "group flex w-full max-w-[95%] flex-col gap-2",
        isUser ? "ml-auto items-end" : ""
      )}
    >
      <div
        className={cn(
          "flex w-fit min-w-0 max-w-full flex-col gap-2 text-sm",
          isUser
            ? "ml-auto rounded-2xl bg-secondary px-4 py-3 text-secondary-foreground"
            : "text-foreground"
        )}
      >
        {message.parts.map((part, i) => {
          if (part.type === "text" && part.text.trim()) {
            return isUser ? (
              <span key={i} className="leading-relaxed whitespace-pre-wrap">
                {part.text}
              </span>
            ) : (
              <div key={i} className="prose prose-sm dark:prose-invert max-w-none leading-relaxed">
                <ReactMarkdown>{part.text}</ReactMarkdown>
              </div>
            );
          }

          if (isToolUIPart(part)) {
            const toolName = getToolName(part);
            const label = toolName;
            const isDone = part.state === "output-available";
            const isError = part.state === "output-error";
            const isRunning = !isDone && !isError;

            return (
              <div
                key={i}
                className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs"
              >
                {isRunning ? (
                  <ClockIcon className="size-3.5 animate-pulse text-muted-foreground" />
                ) : isDone ? (
                  <CheckCircleIcon className="size-3.5 text-green-500" />
                ) : (
                  <XCircleIcon className="size-3.5 text-destructive" />
                )}
                {isRunning ? (
                  <Shimmer className="text-xs" duration={1.5}>{label}</Shimmer>
                ) : (
                  <span className="text-muted-foreground">{label}</span>
                )}
              </div>
            );
          }

          return null;
        })}
      </div>
    </div>
  );
}
