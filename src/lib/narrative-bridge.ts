import { parseJsonEventStream, uiMessageChunkSchema, type UIMessageChunk } from "ai";

export type DirectiveHandler = (toolName: string, output: unknown) => void;
export type TextDeltaHandler = (delta: string) => void;
export type TextCompleteHandler = (fullText: string) => void;
export type InteractionCompleteHandler = () => void;
export type ErrorHandler = (error: string) => void;

export interface NarrativeBridgeConfig {
  gameId: string;
  onTextDelta: TextDeltaHandler;
  onTextComplete: TextCompleteHandler;
  onDirective: DirectiveHandler;
  onInteractionComplete: InteractionCompleteHandler;
  onError?: ErrorHandler;
}

/**
 * NarrativeBridge - Central adapter between the game engine and the AI SDK streaming backend.
 *
 * Wraps `parseJsonEventStream` and `uiMessageChunkSchema` to consume SSE streams,
 * tracks tool call IDs to route directives by tool name, and exposes an event-callback interface.
 */
export class NarrativeBridge {
  private activeToolCalls = new Map<string, { toolName: string }>();
  private config: NarrativeBridgeConfig;
  private abortController: AbortController | null = null;
  private accumulatedText = "";
  private currentRunId: string | null = null;

  constructor(config: NarrativeBridgeConfig) {
    this.config = config;
  }

  /**
   * Start a new interaction with a persona. This is the first message in a conversation.
   */
  async startInteraction(personaId: string, message: string): Promise<void> {
    this.abortController = new AbortController();
    this.accumulatedText = "";
    this.activeToolCalls.clear();

    const response = await fetch(`/api/agent/${personaId}/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        gameId: this.config.gameId,
        messages: [{ role: "user", content: message }],
        trigger: "submit-message",
      }),
      signal: this.abortController.signal,
    });

    if (!response.ok || !response.body) {
      this.config.onError?.(`Failed to start interaction: ${response.status}`);
      return;
    }

    // Extract run ID from response headers for follow-up messages
    const runId = response.headers.get("x-workflow-run-id");
    if (runId) {
      this.currentRunId = runId;
    }

    await this.consumeStream(response.body);
  }

  /**
   * Send a follow-up message to an ongoing persona conversation.
   */
  async sendMessage(personaId: string, message: string): Promise<void> {
    if (!this.currentRunId) {
      this.config.onError?.("No active conversation to send message to");
      return;
    }

    this.accumulatedText = "";
    this.activeToolCalls.clear();

    const response = await fetch(
      `/api/agent/${personaId}/stream/${this.currentRunId}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameId: this.config.gameId,
          message,
        }),
      },
    );

    if (!response.ok || !response.body) {
      this.config.onError?.(`Failed to send message: ${response.status}`);
      return;
    }

    await this.consumeStream(response.body);
  }

  /**
   * Submit an accusation against a persona.
   */
  async submitAccusation(personaId: string): Promise<void> {
    const response = await fetch(`/api/run/${this.config.gameId}/event`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "accuse", personaId }),
    });

    if (!response.ok) {
      this.config.onError?.(`Failed to submit accusation: ${response.status}`);
    }
  }

  /**
   * Cancel the current interaction and abort any in-flight requests.
   */
  cancelCurrentInteraction(): void {
    this.abortController?.abort();
    this.abortController = null;
  }

  /**
   * Get the current run ID for reconnection purposes.
   */
  getRunId(): string | null {
    return this.currentRunId;
  }

  /**
   * Set the run ID for reconnecting to an existing conversation.
   */
  setRunId(runId: string): void {
    this.currentRunId = runId;
  }

  /**
   * Consume an SSE stream and dispatch events to the appropriate handlers.
   */
  private async consumeStream(stream: ReadableStream<Uint8Array>): Promise<void> {
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

  /**
   * Handle a single UIMessageChunk from the stream.
   */
  private handleChunk(chunk: UIMessageChunk): void {
    switch (chunk.type) {
      case "text-delta":
        this.accumulatedText += chunk.delta;
        this.config.onTextDelta(chunk.delta);
        break;
      case "text-end":
        this.config.onTextComplete(this.accumulatedText);
        break;
      case "tool-input-start":
        this.activeToolCalls.set(chunk.toolCallId, { toolName: chunk.toolName });
        break;
      case "tool-output-available": {
        const info = this.activeToolCalls.get(chunk.toolCallId);
        if (info) {
          this.config.onDirective(info.toolName, chunk.output);
        }
        break;
      }
      case "finish":
        this.config.onInteractionComplete();
        break;
      case "error":
        this.config.onError?.(chunk.errorText);
        break;
    }
  }
}
