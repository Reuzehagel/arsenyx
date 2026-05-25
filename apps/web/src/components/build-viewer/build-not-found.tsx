import { RouteNotFound } from "@/components/route-not-found"

export function BuildNotFound() {
  return (
    <RouteNotFound
      title="Build not found"
      message="This build may have been deleted or is private."
    />
  )
}
