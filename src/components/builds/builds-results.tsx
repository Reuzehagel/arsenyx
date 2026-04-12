"use client"

import type { ReactNode } from "react"

import { BuildList, useBuildLayout } from "@/components/build/build-list"

/**
 * Client wrapper that provides view mode context to server-rendered build cards.
 * Used by the community builds page where BuildCard is a server component.
 */
export function BuildsResults({
  children,
  count,
  renderCard,
}: {
  children?: ReactNode
  count?: number
  renderCard?: (layout: "grid" | "list") => ReactNode
}) {
  const layout = useBuildLayout()

  return (
    <BuildList count={count}>
      {renderCard ? renderCard(layout) : children}
    </BuildList>
  )
}
