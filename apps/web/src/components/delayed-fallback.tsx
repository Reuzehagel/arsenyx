import { Suspense, useEffect, useState, type ReactNode } from "react"

/**
 * Hold rendering for `delayMs` before showing children. Prevents skeleton
 * flash when a Suspense boundary resolves from cache in <200ms — the user
 * sees nothing instead of a loading state that immediately disappears.
 */
export function DelayedFallback({
  delayMs = 200,
  children,
}: {
  delayMs?: number
  children: ReactNode
}) {
  const [show, setShow] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setShow(true), delayMs)
    return () => clearTimeout(t)
  }, [delayMs])
  return show ? <>{children}</> : null
}

/** `<Suspense>` whose fallback is gated by `<DelayedFallback>`. */
export function DelayedSuspense({
  fallback,
  delayMs,
  children,
}: {
  fallback: ReactNode
  delayMs?: number
  children: ReactNode
}) {
  return (
    <Suspense
      fallback={<DelayedFallback delayMs={delayMs}>{fallback}</DelayedFallback>}
    >
      {children}
    </Suspense>
  )
}
