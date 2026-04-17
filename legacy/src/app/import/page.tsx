import { Footer } from "@/components/footer"
import { Header } from "@/components/header"

import { ImportOverframeClient } from "./import-overframe-client"

export const metadata = {
  title: "Import from Overframe | ARSENYX",
  description: "Import your Warframe builds from Overframe.",
}

export default function ImportTestPage() {
  return (
    <div className="relative flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <div className="container flex flex-col gap-6 py-6">
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-bold tracking-tight">
              Import from Overframe
            </h1>
            <p className="text-muted-foreground">
              Paste an Overframe build URL and inspect the API response.
            </p>
          </div>

          <ImportOverframeClient />
        </div>
      </main>
      <Footer />
    </div>
  )
}
