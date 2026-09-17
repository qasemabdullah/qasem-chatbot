import type { Conversation } from "./types";
import { PlusIcon, TrashIcon } from "./icons";

interface SidebarProps {
  conversations: Conversation[];
  activeId: string;
  onSelect: (id: string) => void;
  onNewChat: () => void;
  onDelete: (id: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({
  conversations,
  activeId,
  onSelect,
  onNewChat,
  onDelete,
  isOpen,
  onClose,
}: SidebarProps) {
  return (
    <>
      {isOpen && <div className="sidebar-overlay" onClick={onClose} />}
      <aside className={`sidebar ${isOpen ? "open" : ""}`}>
        <button className="new-chat-btn" onClick={onNewChat}>
          <PlusIcon />
          New chat
        </button>
        <nav className="conversation-list">
          {conversations.map((c) => (
            <div
              key={c.id}
              className={`conversation-item ${c.id === activeId ? "active" : ""}`}
              onClick={() => onSelect(c.id)}
            >
              <span className="conversation-title">{c.title}</span>
              <button
                className="delete-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(c.id);
                }}
                aria-label="Delete conversation"
              >
                <TrashIcon />
              </button>
            </div>
          ))}
        </nav>
        <div className="sidebar-footer">Qasem's Bot · running locally via Ollama</div>
      </aside>
    </>
  );
}
