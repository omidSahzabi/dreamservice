export function PulseDots() {
  return (
    <div className="mt-12 flex justify-center gap-2">
      {[...Array(5)].map((_, i) => (
        <div
          key={i}
          className="w-2 h-2 rounded-full bg-white/10 animate-pulse"
          style={{ animationDelay: `${i * 0.2}s` }}
        />
      ))}
    </div>
  );
}
