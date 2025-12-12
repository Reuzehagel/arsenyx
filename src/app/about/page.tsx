import Link from "next/link";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { Icons } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { SITE_CONFIG, EXTERNAL_LINKS } from "@/lib/constants";

export default function AboutPage() {
    return (
        <div className="relative min-h-screen flex flex-col">
            <Header />
            <main className="flex-1 container py-12 max-w-3xl">
                <div className="space-y-8">
                    <div className="space-y-4">
                        <h1 className="text-4xl font-bold tracking-tight">About {SITE_CONFIG.name}</h1>
                        <p className="text-xl text-muted-foreground">
                            {SITE_CONFIG.description}
                        </p>
                    </div>

                    <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8">
                        <section>
                            <h2 className="text-2xl font-semibold mb-4">Our Mission</h2>
                            <p>
                                Arsenix was built with one goal in mind: to be the fastest, most modern Warframe build planner.
                                We believe that planning your loadout should be as fluid and fast as the game itself.
                                Focused on keyboard-first navigation and immediate feedback, we're rethinking how Tennos
                                share and optimize their builds.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-2xl font-semibold mb-4">Open Source</h2>
                            <p>
                                We believe in the power of community. That's why Arsenix is fully open source.
                                Anyone can contribute code, suggest features, or report bugs. We're building this together.
                            </p>
                            <div className="flex gap-4 mt-6">
                                <Button asChild>
                                    <Link href={EXTERNAL_LINKS.github} target="_blank" rel="noopener noreferrer">
                                        <Icons.github className="mr-2 h-4 w-4" />
                                        View on GitHub
                                    </Link>
                                </Button>
                            </div>
                        </section>

                        <section>
                            <h2 className="text-2xl font-semibold mb-4">Community Focused</h2>
                            <p>
                                From real-time stats updates to seamless sharing, every feature is designed to help the Warframe community.
                                Data is automatically synced with Warframe Community Developers (WFCD) to ensure accuracy.
                            </p>
                        </section>
                    </div>
                </div>
            </main>
            <Footer />
        </div>
    );
}
