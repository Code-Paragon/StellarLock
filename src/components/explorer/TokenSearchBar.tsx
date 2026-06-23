import { useState, type FormEvent } from "react"
import { useNavigate } from "react-router-dom"
import { Search } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/Button"
import { TOKENS, findToken } from "@/lib/mock-data"
import { trackEvent } from "@/lib/analytics"
import { cn } from "@/lib/utils"

export function TokenSearchBar({ className, autoFocus }: { className?: string; autoFocus?: boolean }) {
  const { t } = useTranslation()
  const [query, setQuery] = useState("")
  const navigate = useNavigate()

  function submit(e: FormEvent) {
    e.preventDefault()
    const value = query.trim()
    if (!value) return
    const match = findToken(value)
    trackEvent("explorer_search")
    navigate(`/explore/${match ? match.address : value}`)
  }

  return (
    <div className={cn("w-full", className)}>
      <form
        onSubmit={submit}
        className="flex items-center gap-2 rounded-xl border border-border bg-card p-2 shadow-lg shadow-black/20 focus-within:border-primary/50"
      >
        <Search className="ml-2 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus={autoFocus}
          placeholder={t("search.placeholder")}
          aria-label={t("search.ariaLabel")}
          className="h-10 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        <Button type="submit" size="md" className="shrink-0">
          {t("search.submit")}
        </Button>
      </form>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span>{t("search.try")}</span>
        {Object.values(TOKENS)
          .slice(0, 3)
          .map((tok) => (
            <button
              key={tok.symbol}
              onClick={() => navigate(`/explore/${tok.address}`)}
              className="rounded-full border border-border bg-secondary px-2.5 py-1 font-medium text-foreground transition-colors hover:border-primary/40 cursor-pointer"
            >
              {tok.symbol}
            </button>
          ))}
      </div>
    </div>
  )
}
