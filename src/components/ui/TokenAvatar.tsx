import { cn } from "@/lib/utils"

const SIZES = { sm: "h-8 w-8 text-xs", md: "h-10 w-10 text-sm", lg: "h-14 w-14 text-lg" }

/** Deterministic monogram avatar for a token symbol. */
export function TokenAvatar({
  symbol,
  size = "md",
  className,
}: {
  symbol: string
  size?: keyof typeof SIZES
  className?: string
}) {
  const letters = symbol
    .replace(/[^A-Za-z0-9]/g, "")
    .slice(0, 2)
    .toUpperCase()
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-primary/15 font-semibold text-primary ring-1 ring-primary/25",
        SIZES[size],
        className,
      )}
      aria-hidden
    >
      {letters}
    </div>
  )
}
