import { Footer } from "@/components/footer"
import { Header } from "@/components/header"
import { HeroSection, FeaturesSection, CTASection } from "@/components/landing"

export default function Home() {
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
