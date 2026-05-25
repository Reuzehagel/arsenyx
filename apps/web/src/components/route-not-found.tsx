import type { ReactNode } from "react"

import { Footer } from "@/components/footer"
import { Header } from "@/components/header"

/** Full-page "X not found" state shared by the org / profile / build / item
 *  routes. `action` is an optional CTA (e.g. a Back button) rendered below the
 *  message. */
export function RouteNotFound({
  title,
  message,
  action,
}: {
  title: string
  message: string
  action?: ReactNode
}) {
  return (
    <div className="relative flex min-h-screen flex-col">
      <Header />
      <main className="wrap flex flex-1 flex-col items-center justify-center gap-3 py-12">
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="text-muted-foreground">{message}</p>
        {action}
      </main>
      <Footer />
    </div>
  )
}
