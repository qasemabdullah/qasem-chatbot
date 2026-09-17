import { useState } from "react";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import type { ChatMessage } from "./types";
import { CheckIcon, CopyIcon } from "./icons";

interface Props {
  message: ChatMessage;
  isStreaming: boolean;
}

function getTextContent(node: unknown): string {
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(getTextContent).join("");
  if (node && typeof node === "object" && "props" in node) {
    return getTextContent((node as { props?: { children?: unknown } }).props?.children);
  }
  return "";
}

function PreBlock(props: React.ComponentPropsWithoutRef<"pre">) {
  const [copied, setCopied] = useState(false);
  const { children, ...rest } = props;
  const codeElement = Array.isArray(children) ? children[0] : children;
  const className =
    (codeElement as { props?: { className?: string } } | undefined)?.props?.className ?? "";
  const language = /language-(\w+)/.exec(className)?.[1] ?? "text";
  const rawText = getTextContent(children);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(rawText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable - nothing we can do
    }
  }

  return (
    <div className="code-block">
      <div className="code-block-header">
        <span>{language}</span>
        <button type="button" onClick={handleCopy}>
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre {...rest}>{children}</pre>
    </div>
  );
}

const markdownComponents: Components = {
  pre: PreBlock,
};

export default function MessageBubble({ message, isStreaming }: Props) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === "user";

  async function handleCopyMessage() {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable
    }
  }

  if (isUser) {
    return (
      <div className="message-row user">
        <div className="bubble user-bubble">{message.content}</div>
      </div>
    );
  }

  return (
    <div className="message-row assistant">
      <div className="avatar">Q</div>
      <div className="assistant-body">
        <div className="assistant-content">
          {message.content ? (
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeHighlight]}
              components={markdownComponents}
            >
              {message.content}
            </ReactMarkdown>
          ) : (
            isStreaming && (
              <span className="typing-dots">
                <span />
                <span />
                <span />
              </span>
            )
          )}
        </div>
        {message.content && !isStreaming && (
          <div className="message-actions">
            <button type="button" onClick={handleCopyMessage} aria-label="Copy response">
              {copied ? <CheckIcon /> : <CopyIcon />}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
