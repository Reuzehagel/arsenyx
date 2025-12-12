import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { HeroSection, FeaturesSection, CTASection } from "@/components/landing";

export default function Home() {
  return (
    <div className="relative min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <HeroSection />
        <FeaturesSection />
        <CTASection />
      </main>
      <Footer />
    </div>
  );
}
