export function Background() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 grid-bg opacity-80" />
      <div className="absolute inset-x-0 top-0 h-[480px] spotlight opacity-60" />
    </div>
  );
}
