interface Props {
  onPick: (text: string) => void;
}

const SUGGESTIONS = [
  "Explain recursion like I'm five",
  "Write a short poem about the ocean",
  "Give me 3 tips to stay focused while studying",
  "What's a fun fact about space?",
];

export default function EmptyState({ onPick }: Props) {
  return (
    <div className="empty-state">
      <div className="empty-avatar">Q</div>
      <h2>Qasem's Bot</h2>
      <p>Ask me anything — I run locally, so it's completely free.</p>
      <div className="suggestions">
        {SUGGESTIONS.map((s) => (
          <button key={s} onClick={() => onPick(s)}>
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
