import { Button } from "@/components/ui/button"

export function Pagination({
  page,
  total,
  limit,
  onPage,
  showTotal = true,
}: {
  page: number
  total: number
  limit: number
  onPage: (p: number) => void
  showTotal?: boolean
}) {
  const pages = Math.max(1, Math.ceil(total / limit))
  if (pages <= 1) return null
  return (
    <div className="text-muted-foreground flex items-center justify-between text-sm">
      <span>
        Page {page} of {pages}
        {showTotal ? ` · ${total} total` : ""}
      </span>
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="secondary"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
        >
          Previous
        </Button>
        <Button
          size="sm"
          variant="secondary"
          disabled={page >= pages}
          onClick={() => onPage(page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  )
}
