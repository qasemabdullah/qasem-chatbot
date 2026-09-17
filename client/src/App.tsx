import { useEffect, useRef, useState } from "react";
import "highlight.js/styles/github-dark.css";
import "./App.css";
import Sidebar from "./Sidebar";
import Composer from "./Composer";
import EmptyState from "./EmptyState";
import MessageBubble from "./MessageBubble";
import { loadActiveId, loadConversations, saveActiveId, saveConversations } from "./storage";
import type { ChatMessage, Conversation } from "./types";
import { MenuIcon, PlusIcon } from "./icons";

function createConversation(): Conversation {
  return {
    id: crypto.randomUUID(),
    title: "New chat",
    messages: [],
    createdAt: Date.now(),
  };
}

function titleFromMessage(text: string): string {
  const clean = text.trim().replace(/\s+/g, " ");
  if (!clean) return "New chat";
  return clean.length > 42 ? `${clean.slice(0, 42)}…` : clean;
}

export default function App() {
  const [conversations, setConversations] = useState<Conversation[]>(() => {
    const loaded = loadConversations();
    return loaded.length > 0 ? loaded : [createConversation()];
  });
  const [activeId, setActiveId] = useState<string>(() => {
    const loaded = loadConversations();
    const savedActive = loadActiveId();
    if (savedActive && loaded.some((c) => c.id === savedActive)) return savedActive;
    return loaded[0]?.id ?? crypto.randomUUID();
  });
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const activeConversation = conversations.find((c) => c.id === activeId) ?? conversations[0];

  useEffect(() => {
    saveConversations(conversations);
  }, [conversations]);

  useEffect(() => {
    saveActiveId(activeId);
  }, [activeId]);

  // Keep activeId pointing at a real conversation whenever the list changes
  // (e.g. after deleting the active one).
  useEffect(() => {
    if (!conversations.some((c) => c.id === activeId)) {
      setActiveId(conversations[0].id);
    }
  }, [conversations, activeId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeConversation?.messages]);

  function updateConversation(id: string, updater: (c: Conversation) => Conversation) {
    setConversations((prev) => prev.map((c) => (c.id === id ? updater(c) : c)));
  }

  function handleNewChat() {
    if (isStreaming) return;
    const fresh = createConversation();
    setConversations((prev) => [fresh, ...prev]);
    setActiveId(fresh.id);
    setInput("");
    setError(null);
    setSidebarOpen(false);
  }

  function handleDelete(id: string) {
    fetch("/api/chat/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: id }),
    }).catch(() => {
      // best-effort cleanup - stale server-side history is harmless
    });

    setConversations((prev) => {
      const remaining = prev.filter((c) => c.id !== id);
      return remaining.length > 0 ? remaining : [createConversation()];
    });
  }

  function appendToAssistant(conversationId: string, messageId: string, delta: string) {
    updateConversation(conversationId, (c) => ({
      ...c,
      messages: c.messages.map((m) => (m.id === messageId ? { ...m, content: m.content + delta } : m)),
    }));
  }

  async function sendMessage(text?: string) {
    const content = (text ?? input).trim();
    if (!content || isStreaming) return;

    const conversationId = activeConversation.id;
    const userMessage: ChatMessage = { id: crypto.randomUUID(), role: "user", content };
    const assistantMessage: ChatMessage = { id: crypto.randomUUID(), role: "assistant", content: "" };

    setError(null);
    setInput("");
    updateConversation(conversationId, (c) => ({
      ...c,
      title: c.messages.length === 0 ? titleFromMessage(content) : c.title,
      messages: [...c.messages, userMessage, assistantMessage],
    }));
    setIsStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch("/api/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: conversationId, message: content }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        throw new Error(`Request failed: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";

        for (const chunk of events) {
          const eventMatch = chunk.match(/^event: (.+)$/m);
          const dataMatch = chunk.match(/^data: (.+)$/m);
          if (!eventMatch || !dataMatch) continue;

          const eventType = eventMatch[1];
          const data = JSON.parse(dataMatch[1]);

          if (eventType === "delta") {
            appendToAssistant(conversationId, assistantMessage.id, data.text as string);
          } else if (eventType === "error") {
            setError(data.message as string);
          }
        }
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        // user pressed stop - keep whatever partial content already streamed in
      } else {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  }

  function handleStop() {
    abortRef.current?.abort();
  }

  return (
    <div className="app-shell">
      <Sidebar
        conversations={conversations}
        activeId={activeId}
        onSelect={(id) => {
          setActiveId(id);
          setSidebarOpen(false);
        }}
        onNewChat={handleNewChat}
        onDelete={handleDelete}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="main-pane">
        <header className="top-bar">
          <button
            className="icon-btn sidebar-toggle"
            onClick={() => setSidebarOpen((v) => !v)}
            aria-label="Toggle sidebar"
          >
            <MenuIcon />
          </button>
          <h1>Qasem's Bot</h1>
          <button
            className="icon-btn new-chat-icon"
            onClick={handleNewChat}
            aria-label="New chat"
            disabled={isStreaming}
          >
            <PlusIcon />
          </button>
        </header>

        <main className="messages">
          {activeConversation.messages.length === 0 ? (
            <EmptyState onPick={(text) => sendMessage(text)} />
          ) : (
            activeConversation.messages.map((msg, i) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                isStreaming={isStreaming && i === activeConversation.messages.length - 1}
              />
            ))
          )}
          <div ref={bottomRef} />
        </main>

        {error && <div className="error-banner">{error}</div>}

        <Composer
          value={input}
          onChange={setInput}
          onSend={() => sendMessage()}
          onStop={handleStop}
          isStreaming={isStreaming}
        />
      </div>
    </div>
  );
}
