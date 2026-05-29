import { Badge } from "@/components/ui/badge"

/**
 * Endo cost + (conditional) forma count badges shown in the build viewer and
 * create-editor headers. Renders as a fragment so each header can supply its
 * own wrapping flex container.
 */
export function EndoFormaBadges({
  totalEndoCost,
  formaCount,
}: {
  totalEndoCost: number
  formaCount: number
}) {
  return (
    <>
      <Badge
        variant="secondary"
        className="bg-muted/50 hover:bg-muted gap-1.5 px-2 py-0.5 text-xs font-semibold"
      >
        <img
          src="/icons/currency/Endo.png"
          alt=""
          aria-hidden
          className="size-4"
        />
        {totalEndoCost.toLocaleString("en-US")}
      </Badge>
      {formaCount > 0 && (
        <Badge
          variant="secondary"
          className="bg-muted/50 hover:bg-muted gap-1.5 px-2 py-0.5 text-xs font-semibold"
        >
          <img
            src="/icons/currency/Forma.png"
            alt=""
            aria-hidden
            className="size-[18px] object-contain"
          />
          {formaCount}
        </Badge>
      )}
    </>
  )
}
