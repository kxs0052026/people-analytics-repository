interface ErrorPanelProps {
  messages: string[];
}

export function ErrorPanel({ messages }: ErrorPanelProps) {
  if (messages.length === 0) return null;

  return (
    <section className="error-panel">
      <strong>We couldn't process that file:</strong>
      <ul>
        {messages.map((msg, i) => (
          <li key={i}>{msg}</li>
        ))}
      </ul>
    </section>
  );
}
