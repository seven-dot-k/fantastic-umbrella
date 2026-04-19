"use client";

import type { UIMessage, UIDataTypes, ChatStatus } from "ai";
import { useChat } from "@ai-sdk/react";
import { WorkflowChatTransport } from "@workflow/ai";
import { useState, useCallback, useMemo, useEffect, useRef } from "react";

const STORAGE_KEY = "workflow-run-id";

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

export interface UseMultiTurnChatReturn {
  messages: UIMessage[];
  status: ChatStatus;
  isGenerating: boolean;
  error: Error | undefined;
  runId: string | null;
  isActive: boolean;
  pendingMessage: string | null;
  sendMessage: (text: string) => Promise<void>;
  stop: () => void;
  endSession: () => Promise<void>;
}

export function useMultiTurnChat(): UseMultiTurnChatReturn {
  const [runId, setRunId] = useState<string | null>(null);
  const [shouldResume, setShouldResume] = useState(false);
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const sentMessagesRef = useRef<Set<string>>(new Set());
  const seenFromStreamRef = useRef<Set<string>>(new Set());
  const sendCounterRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const activityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Check for existing session on mount (URL param takes priority over localStorage)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const sessionParam = params.get("session");
      const storedRunId = sessionParam || localStorage.getItem(STORAGE_KEY);
      if (storedRunId) {
        setRunId(storedRunId);
        localStorage.setItem(STORAGE_KEY, storedRunId);
        setShouldResume(true);
      }
    }
  }, []);

  const transport = useMemo(
    () =>
      new WorkflowChatTransport({
        api: "/api/chat",
        onChatSendMessage: (response) => {
          const workflowRunId = response.headers.get("x-workflow-run-id");
          if (workflowRunId) {
            setRunId(workflowRunId);
            localStorage.setItem(STORAGE_KEY, workflowRunId);
          }
        },
        onChatEnd: () => {
          setRunId(null);
          localStorage.removeItem(STORAGE_KEY);
          sentMessagesRef.current.clear();
          seenFromStreamRef.current.clear();
          setPendingMessage(null);
        },
        prepareReconnectToStreamRequest: ({ api, ...rest }) => {
          const storedRunId = localStorage.getItem(STORAGE_KEY);
          if (!storedRunId) {
            throw new Error("No active workflow run ID found");
          }
          return {
            ...rest,
            api: `/api/chat/${encodeURIComponent(storedRunId)}/stream`,
          };
        },
        maxConsecutiveErrors: 5,
      }),
    [],
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
      console.error("Chat error:", err);
      setPendingMessage(null);
    },
    transport,
  });

  // The durable stream stays open across turns (preventClose: true), so `status`
  // remains "streaming" even when the agent is idle waiting for user input. We can't
  // rely on status alone to show a "Generating" indicator. Instead, treat new chunks
  // arriving as proof of activity and use a 1-second idle timeout to detect when
  // generation has paused. This is a heuristic — the timeout balances responsiveness
  // (clearing the indicator quickly) against false negatives (brief pauses mid-generation).
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

  // Process messages from the stream — extract user messages from data-workflow markers
  const messages = useMemo(() => {
    const result: UIMessage[] = [];
    const seenMessageIds = new Set<string>();

    for (const msg of rawMessages) {
      // useChat adds optimistic local user messages, but in a durable workflow the
      // server is the source of truth for conversation history. User messages are
      // echoed back as data-workflow markers in the assistant stream. We drop the
      // local copies here and reconstruct user messages from those markers so the
      // UI always reflects the canonical server-side conversation state.
      if (msg.role === "user") {
        continue;
      }

      if (msg.role === "assistant") {
        let currentAssistantParts: typeof msg.parts = [];
        let partIndex = 0;

        for (const part of msg.parts) {
          if (isUserMessageMarker(part)) {
            const data = part.data;

            if (seenMessageIds.has(data.id)) {
              continue;
            }
            seenMessageIds.add(data.id);

            // Flush accumulated assistant parts before inserting user message
            if (currentAssistantParts.length > 0) {
              result.push({
                ...msg,
                id: `${msg.id}-part-${partIndex++}`,
                parts: currentAssistantParts,
              });
              currentAssistantParts = [];
            }

            seenFromStreamRef.current.add(data.content);

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

  // Send a follow-up message via hook resumption
  const sendFollowUp = useCallback(
    async (text: string) => {
      if (!runId) {
        throw new Error("No active session to send follow-up to");
      }

      // Use a counter-based dedup key to prevent rapid double-sends of the same message
      const sendKey = `${runId}-${text}-${++sendCounterRef.current}`;
      if (sentMessagesRef.current.has(sendKey)) {
        return;
      }
      sentMessagesRef.current.add(sendKey);

      // Abort any in-flight follow-up before sending a new one
      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      const response = await fetch(`/api/chat/${encodeURIComponent(runId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
        signal: controller.signal,
      });

      if (!response.ok) {
        sentMessagesRef.current.delete(sendKey);
        let details = "Failed to send follow-up message";
        try {
          const errorData = await response.json();
          details = errorData.details || errorData.error || details;
        } catch {
          // response body was not JSON — use default message
        }
        throw new Error(details);
      }
    },
    [runId],
  );

  // Route messages to the appropriate endpoint
  const sendMessage = useCallback(
    async (text: string) => {
      setPendingMessage(text);

      try {
        if (runId) {
          // Follow-up: send via hook resumption
          await sendFollowUp(text);
        } else {
          // First message: start new workflow
          await baseSendMessage({ text });
        }
      } catch (err) {
        setPendingMessage(null);
        throw err;
      }
    },
    [runId, baseSendMessage, sendFollowUp],
  );

  const endSession = useCallback(async () => {
    // Abort any in-flight follow-up requests
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;

    // Capture runId before clearing state
    const currentRunId = runId;

    // Clear storage and state BEFORE stopping the stream. The transport's
    // reconnect logic reads the run ID from localStorage — if we called stop()
    // first, the transport could race to reconnect with the stale ID before we
    // clear it, causing a spurious reconnection attempt to a dead workflow.
    setRunId(null);
    setShouldResume(false);
    localStorage.removeItem(STORAGE_KEY);
    sentMessagesRef.current.clear();
    seenFromStreamRef.current.clear();
    setPendingMessage(null);
    setMessages([]);

    // Remove ?session= from the URL so a page refresh won't resume
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (url.searchParams.has("session")) {
        url.searchParams.delete("session");
        window.history.replaceState({}, "", url.toString());
      }
    }

    try {
      stop();
    } catch {
      // Expected AbortError when stopping an active stream
    }

    if (currentRunId) {
      // Best-effort: send /done to close the server-side workflow.
      // If this fails, the workflow will eventually time out on its own.
      try {
        await fetch(`/api/chat/${encodeURIComponent(currentRunId)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: "/done" }),
        });
      } catch {
        // Workflow will eventually time out on its own
      }
    }
  }, [runId, setMessages, stop]);

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
    endSession,
  };
}
