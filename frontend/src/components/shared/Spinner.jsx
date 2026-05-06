export default function Spinner({
  className = "h-5 w-5 border-2 border-white/25 border-t-white",
}) {
  return (
    <span
      className={`inline-block shrink-0 animate-spin rounded-full ${className}`}
      aria-hidden
    />
  );
}
