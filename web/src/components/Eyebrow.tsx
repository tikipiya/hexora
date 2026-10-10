export function Eyebrow({ children }: { children: string }) {
  return (
    <div className="flex items-center justify-center gap-4 mb-6">
      <span
        className="h-px flex-1 max-w-[120px] bg-gradient-to-r from-transparent to-[rgba(186,215,247,0.12)]"
        aria-hidden
      />
      <span
        className="font-dotdigital text-[15px] tracking-[0.1em] uppercase text-moon-mist"
      >
        {children}
      </span>
      <span
        className="h-px flex-1 max-w-[120px] bg-gradient-to-l from-transparent to-[rgba(186,215,247,0.12)]"
        aria-hidden
      />
    </div>
  );
}
