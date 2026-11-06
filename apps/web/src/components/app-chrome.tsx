import type { ReactNode } from "react"

import { Footer } from "@/components/footer"
import { Header } from "@/components/header"

/** Site header + footer around a page. Rendered once by the `_app` layout
 *  route so the header survives navigation; the root not-found/error pages,
 *  which render outside that layout, wrap themselves in it. */
export function AppChrome({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col">
      <Header />
      <main className="flex flex-1 flex-col">{children}</main>
      <Footer />
    </div>
  )
}
