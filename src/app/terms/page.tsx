import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { SITE_CONFIG } from "@/lib/constants";

export default function TermsPage() {
  return (
    <div className="relative min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 container py-12 max-w-3xl">
        <div className="space-y-6">
          <h1 className="text-4xl font-bold tracking-tight">Terms of Service</h1>
          <p className="text-muted-foreground">
            Last updated: {new Date().toLocaleDateString()}
          </p>

          <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8">
            <section>
              <h2 className="text-2xl font-semibold mb-4">1. Acceptance of Terms</h2>
              <p>
                By accessing and using {SITE_CONFIG.name}, you agree to be bound by these
                Terms of Service. If you do not agree to these terms, please do not use our services.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">2. Use of Service</h2>
              <p>
                {SITE_CONFIG.name} is an open-source Warframe build planner provided "as is".
                You agree to use this service only for lawful purposes and in accordance with these Terms.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">3. User Content</h2>
              <p>
                Users may create and share builds. By posting content, you grant us a license to use,
                modify, publicly perform, publicly display, reproduce, and distribute such content
                on and through the service. You retain all of your ownership rights in your content.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">4. Disclaimer</h2>
              <p>
                We are not affiliated with Digital Extremes. Warframe content and materials are
                trademarks and copyrights of Digital Extremes or its licensors.
              </p>
              <p className="mt-2">
                The service is provided without warranties of any kind, whether express or implied.
                We do not guarantee that the service will be uninterrupted or error-free.
              </p>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
