"use client";

import { useRef, useEffect, useCallback, useMemo, useState } from "react";
import { useMultiTurnChat } from "@/hooks/use-multi-turn-chat";
import { isToolUIPart, getToolName } from "ai";
import { ChatMessage } from "./chat-message";
import { ChatInput } from "./chat-input";
import type { DataProductContent, DataCategoryContent } from "@/lib/schemas/data-parts";
import { Package, Link2, Check, PlusIcon } from "lucide-react";

function isDataProductContent(part: unknown): part is DataProductContent {
  return typeof part === "object" && part !== null && (part as { type?: string }).type === "data-product-content";
}

function isDataCategoryContent(part: unknown): part is DataCategoryContent {
  return typeof part === "object" && part !== null && (part as { type?: string }).type === "data-category-content";
}

export function ChatInterface() {
  const {
    messages,
    sendMessage,
    status,
    isGenerating,
    error,
    pendingMessage,
    endSession,
    isActive,
    runId,
  } = useMultiTurnChat();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div className="flex h-screen bg-background">
      {/* Main content area — chat + optional side panel */}
      <div className="flex flex-1 overflow-hidden">
        {/* Chat column */}
        <div className="flex flex-col flex-1 min-w-0">
          {/* Subtle top bar */}
          <header className="flex items-center justify-between px-6 py-3 border-b border-border">
            <div className="flex items-center gap-2.5">
              <div className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Package className="size-3.5" />
              </div>
              <span className="font-semibold text-sm text-foreground">CatalogManager</span>
            </div>
            <div className="flex items-center gap-3">
              {isActive && runId && (
                <button
                  type="button"
                  onClick={() => {
                    const url = new URL(window.location.href);
                    url.searchParams.set("session", runId);
                    navigator.clipboard.writeText(url.toString());
                    setLinkCopied(true);
                    setTimeout(() => setLinkCopied(false), 2000);
                  }}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  {linkCopied ? (
                    <><Check className="size-3" /> Copied</>
                  ) : (
                    <><Link2 className="size-3" /> Share</>
                  )}
                </button>
              )}
              {isActive && (
                <button
                  type="button"
                  onClick={() => endSession()}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <><PlusIcon className="size-3" /> New Session</>
                </button>
              )}
              <span className="text-xs text-muted-foreground">
                {isGenerating && (
                  <span className="flex items-center gap-1.5">
                    <span className="size-1.5 rounded-full bg-green-500 animate-pulse" />
                    Generating
                  </span>
                )}
              </span>
            </div>
          </header>

          {/* Error */}
          {error && (
            <div className="mx-6 mt-3 p-3 rounded-lg border border-destructive/50 bg-destructive/10 text-destructive text-sm">
              {error.message}
            </div>
          )}

          {/* Messages area */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto">
            <div className="mx-auto max-w-2xl flex flex-col gap-6 p-6">
              {messages.length === 0 && !pendingMessage && (
                <div className="flex flex-col items-center justify-center py-32 text-center">
                  <div className="flex size-12 items-center justify-center rounded-2xl bg-secondary mb-4">
                    <Package className="size-6 text-muted-foreground" />
                  </div>
                  <h2 className="text-lg font-semibold text-foreground mb-1">CatalogManager AI</h2>
                  <p className="text-sm text-muted-foreground mb-6 max-w-md">
                    Optimize product descriptions, category content, and SEO metadata using your brand voice.
                  </p>
                  <div className="flex flex-wrap justify-center gap-2">
                    {[
                      "Optimize descriptions for electronics",
                      "Generate SEO data for all products",
                      "Update the Sports category description",
                    ].map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => sendMessage(suggestion)}
                        className="cursor-pointer rounded-full border border-border px-4 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((message) => (
                <ChatMessage key={message.id} message={message} />
              ))}

              {/* Pending message */}
              {pendingMessage && (
                <div className="flex w-full max-w-[95%] flex-col gap-2 ml-auto items-end">
                  <div className="rounded-2xl bg-secondary px-4 py-3 text-sm text-secondary-foreground opacity-60">
                    {pendingMessage}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Input */}
          <div className="mx-auto w-full max-w-2xl">
            <ChatInput
              onSend={(text) => sendMessage(text)}
              disabled={isGenerating || hasPendingApproval}
            />
          </div>
        </div>

        {/* Side panel — slides in when table data exists */}
        {hasTableData && (
          <div className="w-[520px] shrink-0 border-l border-border">
            <CatalogPanel
              productItems={productItems}
              categoryItems={categoryItems}
              pendingSaveToolCallIds={pendingSaveToolCallIds}
              onApprove={handleApprove}
              onReject={handleReject}
            />
          </div>
        )}
      </div>
    </div>
  );
}
