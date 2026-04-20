import { createFileRoute } from "@tanstack/react-router"

import { Footer } from "@/components/footer"
import { Header } from "@/components/header"
import { SITE_CONFIG } from "@/lib/constants"

export const Route = createFileRoute("/terms")({
  component: TermsPage,
})

function TermsPage() {
  return (
    <div className="relative flex min-h-screen flex-col">
      <Header />
      <main className="container max-w-3xl flex-1 py-12">
        <div className="flex flex-col gap-6">
          <h1 className="text-4xl font-bold tracking-tight">
            Terms of Service
          </h1>
          <p className="text-muted-foreground">
            Last updated: {new Date().toLocaleDateString()}
          </p>

          <div className="prose prose-neutral dark:prose-invert flex max-w-none flex-col gap-8">
            <section>
              <h2 className="mb-4 text-2xl font-semibold">
                1. Acceptance of Terms
              </h2>
              <p>
                By accessing and using {SITE_CONFIG.name}, you agree to be bound
                by these Terms of Service. If you do not agree to these terms,
                please do not use our services.
              </p>
            </section>

            <section>
              <h2 className="mb-4 text-2xl font-semibold">2. Use of Service</h2>
              <p>
                {SITE_CONFIG.name} is an open-source Warframe build planner
                provided &quot;as is&quot;. You agree to use this service only
                for lawful purposes and in accordance with these Terms.
              </p>
            </section>

            <section>
              <h2 className="mb-4 text-2xl font-semibold">3. User Content</h2>
              <p>
                Users may create and share builds. By posting content, you grant
                us a license to use, modify, publicly perform, publicly display,
                reproduce, and distribute such content on and through the
                service. You retain all of your ownership rights in your
                content.
              </p>
            </section>

            <section>
              <h2 className="mb-4 text-2xl font-semibold">4. Disclaimer</h2>
              <p>
                We are not affiliated with Digital Extremes. Warframe content
                and materials are trademarks and copyrights of Digital Extremes
                or its licensors.
              </p>
              <p className="mt-2">
                The service is provided without warranties of any kind, whether
                express or implied. We do not guarantee that the service will be
                uninterrupted or error-free.
              </p>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
