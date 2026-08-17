export function StreamingDots() {
  return (
    <div
      className="flex items-center gap-1 rounded-2xl bg-accent px-3 py-2 text-xs text-muted-foreground"
      role="status"
      aria-label="正在生成"
    >
      <span className="inline-block h-2 w-2 animate-bounce rounded-full bg-[#A0AEC0]" />
      <span className="inline-block h-2 w-2 animate-bounce rounded-full bg-[#A0AEC0] [animation-delay:120ms]" />
      <span className="inline-block h-2 w-2 animate-bounce rounded-full bg-[#A0AEC0] [animation-delay:240ms]" />
    </div>
  )
}
