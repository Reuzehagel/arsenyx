import { createFileRoute } from "@tanstack/react-router"

import { Footer } from "@/components/footer"
import { Header } from "@/components/header"
import { SITE_CONFIG } from "@/lib/constants"

export const Route = createFileRoute("/privacy")({
  component: PrivacyPage,
})

function PrivacyPage() {
  return (
    <div className="relative flex min-h-screen flex-col">
      <Header />
      <main className="container max-w-3xl flex-1 py-12">
        <div className="flex flex-col gap-6">
          <h1 className="text-4xl font-bold tracking-tight">Privacy Policy</h1>
          <p className="text-muted-foreground">
            Last updated: {new Date().toLocaleDateString()}
          </p>

          <div className="prose prose-neutral dark:prose-invert flex max-w-none flex-col gap-8">
            <section>
              <h2 className="mb-4 text-2xl font-semibold">
                1. Information We Collect
              </h2>
              <p>
                {SITE_CONFIG.name} is designed to be privacy-friendly. We
                minimize the data we collect.
              </p>
              <ul className="mt-2 flex list-disc flex-col gap-2 pl-6">
                <li>
                  <strong>Authentication Data:</strong> If you sign in, we store
                  your basic profile information provided by the authentication
                  provider (e.g., GitHub, Discord).
                </li>
                <li>
                  <strong>Usage Data:</strong> We may collect anonymous
                  analytics data to understand how our service is used and to
                  improve it.
                </li>
                <li>
                  <strong>User Content:</strong> Builds and guides you create
                  and save are stored in our database.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="mb-4 text-2xl font-semibold">
                2. How We Use Your Information
              </h2>
              <p>
                We use the collected information solely for providing and
                improving the service. We do not sell your personal data to
                third parties.
              </p>
            </section>

            <section>
              <h2 className="mb-4 text-2xl font-semibold">
                3. Cookies and Local Storage
              </h2>
              <p>
                We use cookies and local storage to maintain your session and
                store your preferences. These are essential for the functioning
                of the application.
              </p>
            </section>

            <section>
              <h2 className="mb-4 text-2xl font-semibold">
                4. Third-Party Services
              </h2>
              <p>
                Our service may use third-party services for authentication,
                hosting, and analytics. Please review their respective privacy
                policies for more information.
              </p>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
