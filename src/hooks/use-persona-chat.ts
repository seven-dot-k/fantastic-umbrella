"use client";

import type { UIMessage, ChatStatus } from "ai";
import { useChat } from "@ai-sdk/react";
import { WorkflowChatTransport } from "@workflow/ai";
import { useState, useCallback, useMemo, useEffect, useRef } from "react";

interface UserMessageData {
  type: "user-message";
  id: string;
  content: string;
  timestamp: number;
}

function isUserMessageMarker(
  part: unknown,
): part is { type: "data-workflow"; data: UserMessageData } {
  if (typeof part !== "object" || part === null) return false;
  const p = part as Record<string, unknown>;
  if (p.type !== "data-workflow" || !("data" in p)) return false;
  const data = p.data as Record<string, unknown>;
  return data?.type === "user-message";
}

export interface UsePersonaChatReturn {
  messages: UIMessage[];
  status: ChatStatus;
  isGenerating: boolean;
  error: Error | undefined;
  runId: string | null;
  isActive: boolean;
  pendingMessage: string | null;
  sendMessage: (text: string) => Promise<void>;
  stop: () => void;
  endChat: () => Promise<void>;
}

/**
 * Hook for chatting with a specific persona in a murder mystery game.
 *
 * The persona chat now runs as a child workflow inside PlayGame. The stream
 * comes from the game workflow's persona-namespaced readable. The runId
 * stored here is the gameId, since all persona chats share the game workflow.
 *
 * Routes:
 * - POST /api/agent/[personaId]/stream — send first chat-message event
 * - GET  /api/agent/[personaId]/stream/[gameId] — reconnect to persona stream
 * - POST /api/agent/[personaId]/stream/[gameId] — send follow-up chat-message
 */
export function usePersonaChat(
  personaId: string,
  gameId: string,
): UsePersonaChatReturn {
  const [runId, setRunId] = useState<string | null>(null);
  const [shouldResume, setShouldResume] = useState(false);
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const sentMessagesRef = useRef<Set<string>>(new Set());
  const sendCounterRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const activityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Check for existing chat session in storage
  const storageKey = `persona-chat-${personaId}`;

  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedRunId = localStorage.getItem(storageKey);
      if (storedRunId) {
        setRunId(storedRunId);
        setShouldResume(true);
      }
    }
  }, [storageKey]);

  const transport = useMemo(
    () =>
      // eslint-disable-next-line react-hooks/refs
      new WorkflowChatTransport({
        api: `/api/agent/${encodeURIComponent(personaId)}/stream`,
        prepareSendMessagesRequest: ({ body, ...rest }) => ({
          ...rest,
          body: { ...(body as Record<string, unknown> | undefined), gameId },
        }),
        onChatSendMessage: (response) => {
          const workflowRunId = response.headers.get("x-workflow-run-id");
          if (workflowRunId) {
            setRunId(workflowRunId);
            localStorage.setItem(storageKey, workflowRunId);
          }
        },
        onChatEnd: () => {
          setRunId(null);
          localStorage.removeItem(storageKey);
          sentMessagesRef.current.clear();
          setPendingMessage(null);
        },
        prepareReconnectToStreamRequest: (opts) => {
          const storedRunId = localStorage.getItem(storageKey);
          if (!storedRunId) {
            throw new Error("No active workflow run ID found");
          }
          const { api: _unusedApi, ...rest } = opts;
          void _unusedApi;
          return {
            ...rest,
            api: `/api/agent/${encodeURIComponent(personaId)}/stream/${encodeURIComponent(storedRunId)}`,
          };
        },
        maxConsecutiveErrors: 5,
      }),
    [personaId, storageKey, gameId],
  );

  const {
    messages: rawMessages,
    sendMessage: baseSendMessage,
    status,
    error,
    stop,
    setMessages,
  } = useChat({
    resume: shouldResume,
    onError: (err) => {
      console.error("Persona chat error:", err);
      setPendingMessage(null);
    },
    transport,
  });

  // Activity-based generating detection (same heuristic as multi-turn chat)
  useEffect(() => {
    if (status !== "streaming") {
      setIsGenerating(false);
      return;
    }
    setIsGenerating(true);
    if (activityTimerRef.current) clearTimeout(activityTimerRef.current);
    activityTimerRef.current = setTimeout(() => setIsGenerating(false), 1000);
    return () => {
      if (activityTimerRef.current) clearTimeout(activityTimerRef.current);
    };
  }, [rawMessages, status]);

  // Process messages — extract user messages from data-workflow markers
  const messages = useMemo(() => {
    const result: UIMessage[] = [];
    const seenMessageIds = new Set<string>();

    for (const msg of rawMessages) {
      if (msg.role === "user") continue;

      if (msg.role === "assistant") {
        let currentAssistantParts: typeof msg.parts = [];
        let partIndex = 0;

        for (const part of msg.parts) {
          if (isUserMessageMarker(part)) {
            const data = part.data;
            if (seenMessageIds.has(data.id)) continue;
            seenMessageIds.add(data.id);

            if (currentAssistantParts.length > 0) {
              result.push({
                ...msg,
                id: `${msg.id}-part-${partIndex++}`,
                parts: currentAssistantParts,
              });
              currentAssistantParts = [];
            }

            if (pendingMessage === data.content) {
              setPendingMessage(null);
            }

            result.push({
              id: data.id,
              role: "user",
              parts: [{ type: "text", text: data.content }],
            } as UIMessage);
            continue;
          }

          currentAssistantParts.push(part);
        }

        if (currentAssistantParts.length > 0) {
          result.push({
            ...msg,
            id: partIndex > 0 ? `${msg.id}-part-${partIndex}` : msg.id,
            parts: currentAssistantParts,
          });
        }
      }
    }

    return result;
  }, [rawMessages, pendingMessage]);

  // Send a follow-up message
  const sendFollowUp = useCallback(
    async (text: string) => {
      if (!runId) throw new Error("No active chat session");

      const sendKey = `${runId}-${text}-${++sendCounterRef.current}`;
      if (sentMessagesRef.current.has(sendKey)) return;
      sentMessagesRef.current.add(sendKey);

      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      const response = await fetch(
        `/api/agent/${encodeURIComponent(personaId)}/stream/${encodeURIComponent(runId)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: text }),
          signal: controller.signal,
        },
      );

      if (!response.ok) {
        sentMessagesRef.current.delete(sendKey);
        let details = "Failed to send message";
        try {
          const errorData = await response.json();
          details = errorData.details || errorData.error || details;
        } catch {
          // response body was not JSON
        }
        throw new Error(details);
      }
    },
    [runId, personaId],
  );

  // Route messages to the appropriate endpoint
  const sendMessage = useCallback(
    async (text: string) => {
      setPendingMessage(text);
      try {
        if (runId) {
          await sendFollowUp(text);
        } else {
          // First message: start new persona chat workflow
          // The transport's prepareSendMessagesRequest injects the gameId
          await baseSendMessage({ text });
        }
      } catch (err) {
        setPendingMessage(null);
        throw err;
      }
    },
    [runId, baseSendMessage, sendFollowUp],
  );

  const endChat = useCallback(async () => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;

    const currentRunId = runId;

    setRunId(null);
    setShouldResume(false);
    localStorage.removeItem(storageKey);
    sentMessagesRef.current.clear();
    setPendingMessage(null);
    setMessages([]);

    try {
      stop();
    } catch {
      // Expected
    }

    // Notify the parent PlayGame workflow to clean up this persona's state
    if (currentRunId) {
      try {
        await fetch(
          `/api/run/${encodeURIComponent(gameId)}/event`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type: "end-persona-chat", personaId }),
          },
        );
      } catch {
        // Game workflow may have ended — that's okay
      }
    }
  }, [runId, gameId, personaId, storageKey, setMessages, stop]);

  return {
    messages,
    status,
    isGenerating,
    error,
    runId,
    isActive: !!runId,
    pendingMessage,
    sendMessage,
    stop,
    endChat,
  };
}
