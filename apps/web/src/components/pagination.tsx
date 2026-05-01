import {
  Pagination as PaginationRoot,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"

// Compact page range with ellipses around the current window. For pages ≤ 7
// returns [1..pages]; otherwise keeps first, last, current±1 and fills gaps
// with "…" markers. Stable, order-preserving.
function pageRange(current: number, pages: number): Array<number | "ellipsis"> {
  if (pages <= 7) {
    return Array.from({ length: pages }, (_, i) => i + 1)
  }
  const out: Array<number | "ellipsis"> = [1]
  const start = Math.max(2, current - 1)
  const end = Math.min(pages - 1, current + 1)
  if (start > 2) out.push("ellipsis")
  for (let i = start; i <= end; i++) out.push(i)
  if (end < pages - 1) out.push("ellipsis")
  out.push(pages)
  return out
}

export function Pagination({
  page,
  total,
  limit,
  onPage,
  href,
}: {
  page: number
  total: number
  limit: number
  onPage: (p: number) => void
  // Optional builder so users can right-click → open page in new tab.
  // Falls back to "#" with preventDefault on click.
  href?: (p: number) => string
}) {
  const pages = Math.max(1, Math.ceil(total / limit))
  if (pages <= 1) return null

  const items = pageRange(page, pages)
  const linkHref = (p: number) => href?.(p) ?? "#"

  const handle = (p: number) => (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault()
    onPage(p)
  }

  return (
    <PaginationRoot>
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious
            href={linkHref(page - 1)}
            onClick={handle(page - 1)}
            aria-disabled={page <= 1}
            className={page <= 1 ? "pointer-events-none opacity-50" : ""}
          />
        </PaginationItem>
        {items.map((it, i) =>
          it === "ellipsis" ? (
            <PaginationItem key={`e${i}`}>
              <PaginationEllipsis />
            </PaginationItem>
          ) : (
            <PaginationItem key={it}>
              <PaginationLink
                href={linkHref(it)}
                onClick={handle(it)}
                isActive={it === page}
              >
                {it}
              </PaginationLink>
            </PaginationItem>
          ),
        )}
        <PaginationItem>
          <PaginationNext
            href={linkHref(page + 1)}
            onClick={handle(page + 1)}
            aria-disabled={page >= pages}
            className={page >= pages ? "pointer-events-none opacity-50" : ""}
          />
        </PaginationItem>
      </PaginationContent>
    </PaginationRoot>
  )
}
