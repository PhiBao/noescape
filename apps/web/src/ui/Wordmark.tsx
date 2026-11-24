export function Wordmark() {
  return (
    <span className="wordmark" role="img" aria-label="noescape">
      n
      <span className="wordmark__ring" aria-hidden="true">
        <span className="wordmark__dot" />
      </span>
      escape
    </span>
  );
}
