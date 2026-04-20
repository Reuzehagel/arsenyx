import { createFileRoute } from "@tanstack/react-router"

import { Footer } from "@/components/footer"
import { Header } from "@/components/header"
import { HeroSection, FeaturesSection, CTASection } from "@/components/landing"

export const Route = createFileRoute("/")({
  component: Home,
})

function Home() {
  return (
    <div className="relative flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <HeroSection />
        <FeaturesSection />
        <CTASection />
      </main>
      <Footer />
    </div>
  )
}
