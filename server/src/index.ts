import "dotenv/config";
import express from "express";
import cors from "cors";

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
const MODEL = process.env.OLLAMA_MODEL ?? "llama3.2";
const SYSTEM_PROMPT =
  process.env.CHATBOT_SYSTEM_PROMPT ??
  "You are a helpful, friendly assistant. Keep responses concise unless the user asks for detail.";
const PORT = process.env.PORT ? Number(process.env.PORT) : 3001;

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface OllamaChatChunk {
  message?: { content?: string };
  done?: boolean;
  done_reason?: string;
}

const app = express();
app.use(cors());
app.use(express.json());

// In-memory conversation history per session. Fine for a single-process dev
// server; swap for a real store (Redis, DB) before running multiple instances.
const conversations = new Map<string, ChatMessage[]>();

function getHistory(sessionId: string): ChatMessage[] {
  let history = conversations.get(sessionId);
  if (!history) {
    history = [];
    conversations.set(sessionId, history);
  }
  return history;
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/api/chat/stream", async (req, res) => {
  const { sessionId, message } = req.body as {
    sessionId?: string;
    message?: string;
  };

  if (!sessionId || typeof sessionId !== "string") {
    res.status(400).json({ error: "sessionId is required" });
    return;
  }
  if (!message || typeof message !== "string" || !message.trim()) {
    res.status(400).json({ error: "message is required" });
    return;
  }

  const history = getHistory(sessionId);
  history.push({ role: "user", content: message });

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const send = (event: string, data: unknown) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  // Abort the upstream Ollama request if the client disconnects or presses
  // "stop" - otherwise generation keeps running server-side for nothing.
  const controller = new AbortController();
  res.on("close", () => controller.abort());

  let assistantText = "";

  try {
    const ollamaResponse = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...history],
        stream: true,
      }),
      signal: controller.signal,
    });

    if (!ollamaResponse.ok || !ollamaResponse.body) {
      throw new Error(
        `Ollama request failed (${ollamaResponse.status}). Is Ollama running and is the "${MODEL}" model pulled?`,
      );
    }

    const reader = ollamaResponse.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let doneReason = "end_turn";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.trim()) continue;
        const chunk = JSON.parse(line) as OllamaChatChunk;
        const delta = chunk.message?.content ?? "";
        if (delta) {
          assistantText += delta;
          send("delta", { text: delta });
        }
        if (chunk.done) {
          doneReason = chunk.done_reason ?? "end_turn";
        }
      }
    }

    history.push({ role: "assistant", content: assistantText });
    send("done", { stopReason: doneReason });
    res.end();
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      // User pressed stop (or disconnected) - keep whatever the model
      // produced so far as real conversation context for the next turn.
      if (assistantText) {
        history.push({ role: "assistant", content: assistantText });
      } else {
        history.pop();
      }
      return;
    }

    // Roll back the unanswered user turn so a retry starts clean.
    history.pop();
    console.error("Chat stream error:", error);

    const errorMessage =
      error instanceof Error
        ? error.message
        : "Something went wrong. Please try again.";

    send("error", { message: errorMessage });
    res.end();
  }
});

app.post("/api/chat/reset", (req, res) => {
  const { sessionId } = req.body as { sessionId?: string };
  if (sessionId) conversations.delete(sessionId);
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Chatbot server listening on http://localhost:${PORT}`);
  console.log(`Using Ollama model "${MODEL}" at ${OLLAMA_BASE_URL}`);
});
