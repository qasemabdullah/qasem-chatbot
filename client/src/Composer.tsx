import { useEffect, useRef } from "react";
import { SendIcon, StopIcon } from "./icons";

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  onStop: () => void;
  isStreaming: boolean;
}

export default function Composer({ value, onChange, onSend, onStop, isStreaming }: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [value]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!isStreaming) onSend();
    }
  }

  return (
    <form
      className="composer"
      onSubmit={(e) => {
        e.preventDefault();
        if (isStreaming) onStop();
        else onSend();
      }}
    >
      <div className="composer-inner">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Message Qasem's Bot..."
          rows={1}
        />
        <button
          type="submit"
          className={`send-btn ${isStreaming ? "stop" : ""}`}
          disabled={!isStreaming && !value.trim()}
          aria-label={isStreaming ? "Stop generating" : "Send message"}
        >
          {isStreaming ? <StopIcon /> : <SendIcon />}
        </button>
      </div>
      <p className="composer-hint">Qasem's Bot runs locally via Ollama and can make mistakes.</p>
    </form>
  );
}
