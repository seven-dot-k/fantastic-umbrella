import {
  parseJsonEventStream,
  uiMessageChunkSchema,
  type UIMessageChunk,
} from "ai";

export type DirectiveHandler = (toolName: string, output: unknown) => void;
export type TextDeltaHandler = (delta: string) => void;
export type TextCompleteHandler = (fullText: string) => void;
export type InteractionCompleteHandler = () => void;
export type ErrorHandler = (error: string) => void;

export interface NarrativeBridgeConfig {
  /** The game workflow run id. Used for accusation events. */
  gameId: string;
  onTextDelta: TextDeltaHandler;
  onTextComplete: TextCompleteHandler;
  onDirective: DirectiveHandler;
  onInteractionComplete: InteractionCompleteHandler;
  onError?: ErrorHandler;
}

/**
 * NarrativeBridge
 *
 * Central adapter between the PIXIJS game engine and the Vercel AI SDK
 * streaming backend. Wraps `parseJsonEventStream` + `uiMessageChunkSchema`
 * to consume SSE streams, tracks tool call IDs to route directives by tool
 * name, and exposes an event-callback interface.
 *
 * Stream lifecycle:
 * - `startInteraction(personaId, message)` opens the persona's SSE stream
 *   (POST /api/agent/{personaId}/stream) and begins consuming it. The
 *   returned Promise resolves when the stream ends (usually when the
 *   persona chat is closed or the game ends).
 * - `sendMessage(personaId, message, runId)` is fire-and-forget: it POSTs
 *   the follow-up message. New chunks arrive on the already-open stream
 *   from startInteraction.
 * - `submitAccusation(personaId)` POSTs an accuse event to the game hook.
 *
 * This is an MVP implementation (see DD-01 in the narrative-bridge log).
 * Auto-reconnection / WorkflowChatTransport is deferred to follow-up WI-06.
 */
export class NarrativeBridge {
  private activeToolCalls = new Map<string, { toolName: string }>();
  private config: NarrativeBridgeConfig;
  private abortController: AbortController | null = null;
  private accumulatedText = "";

  constructor(config: NarrativeBridgeConfig) {
    this.config = config;
  }

  /**
   * Open a persona stream and begin consuming it. Resolves when the stream
   * ends. Call this once per dialogue session.
   */
  async startInteraction(personaId: string, message: string): Promise<void> {
    this.abortController = new AbortController();
    this.accumulatedText = "";
    this.activeToolCalls.clear();

    let response: Response;
    try {
      response = await fetch(`/api/agent/${encodeURIComponent(personaId)}/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameId: this.config.gameId,
          message,
        }),
        signal: this.abortController.signal,
      });
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      this.config.onError?.(
        `Failed to start interaction: ${err instanceof Error ? err.message : String(err)}`,
      );
      return;
    }

    if (!response.ok || !response.body) {
      this.config.onError?.(
        `Failed to start interaction: ${response.status}`,
      );
      return;
    }

    try {
      await this.consumeStream(response.body);
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      this.config.onError?.(
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  /**
   * Send a follow-up message to an existing persona dialogue. The new agent
   * turn will be streamed over the already-open connection opened by
   * startInteraction.
   */
  async sendMessage(personaId: string, message: string, runId: string): Promise<void> {
    // Reset per-turn accumulation so text deltas for the new turn start fresh.
    this.accumulatedText = "";
    this.activeToolCalls.clear();

    let response: Response;
    try {
      response = await fetch(
        `/api/agent/${encodeURIComponent(personaId)}/stream/${encodeURIComponent(runId)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message }),
        },
      );
    } catch (err) {
      this.config.onError?.(
        `Failed to send message: ${err instanceof Error ? err.message : String(err)}`,
      );
      return;
    }

    if (!response.ok) {
      this.config.onError?.(`Failed to send message: ${response.status}`);
    }
    // Response body is a JSON ack; new tokens arrive on the persona stream
    // that startInteraction already opened.
  }

  /**
   * Submit an accusation. Posts to the game event hook.
   */
  async submitAccusation(personaId: string): Promise<void> {
    try {
      const response = await fetch(
        `/api/run/${encodeURIComponent(this.config.gameId)}/event`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "accuse", personaId }),
        },
      );

      if (!response.ok) {
        this.config.onError?.(
          `Failed to submit accusation: ${response.status}`,
        );
      }
    } catch (err) {
      this.config.onError?.(
        `Failed to submit accusation: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /**
   * End the persona chat on the server and abort the client stream reader.
   */
  async endPersonaChat(personaId: string): Promise<void> {
    this.cancelCurrentInteraction();
    try {
      await fetch(
        `/api/run/${encodeURIComponent(this.config.gameId)}/event`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "end-persona-chat", personaId }),
        },
      );
    } catch {
      // Best effort — the game workflow may have already ended.
    }
  }

  /**
   * Abort the current SSE reader. Safe to call at any time.
   */
  cancelCurrentInteraction(): void {
    this.abortController?.abort();
    this.abortController = null;
  }

  private async consumeStream(
    stream: ReadableStream<Uint8Array>,
  ): Promise<void> {
    const chunkStream = parseJsonEventStream({
      stream,
      schema: uiMessageChunkSchema,
    });
    const reader = chunkStream.getReader();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!value.success) continue;
        this.handleChunk(value.value);
      }
    } finally {
      reader.releaseLock();
    }
  }

  private handleChunk(chunk: UIMessageChunk): void {
    switch (chunk.type) {
      case "text-delta": {
        const delta = (chunk as { delta?: string }).delta ?? "";
        if (!delta) break;
        this.accumulatedText += delta;
        this.config.onTextDelta(delta);
        break;
      }
      case "text-end": {
        this.config.onTextComplete(this.accumulatedText);
        break;
      }
      case "tool-input-start": {
        const c = chunk as { toolCallId: string; toolName: string };
        this.activeToolCalls.set(c.toolCallId, { toolName: c.toolName });
        break;
      }
      case "tool-output-available": {
        const c = chunk as { toolCallId: string; output: unknown };
        const info = this.activeToolCalls.get(c.toolCallId);
        if (info) {
          this.config.onDirective(info.toolName, c.output);
        }
        break;
      }
      case "finish": {
        this.config.onInteractionComplete();
        break;
      }
      case "error": {
        const c = chunk as { errorText?: string };
        this.config.onError?.(c.errorText ?? "Stream error");
        break;
      }
      default:
        // Other chunk types (start, data-workflow, reasoning, etc.) are ignored
        break;
    }
  }
}
