import type { Metadata } from "next";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { Star, ExternalLink } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CURATED_RESOURCES } from "@/lib/guides/curated-resources";

export const metadata: Metadata = {
    title: "Guides | ARSENYX",
    description:
        "Learn about Warframe mechanics, farming strategies, and game systems with in-depth guides.",
};

export default function GuidesPage() {
    return (
        <div className="relative min-h-screen flex flex-col">
            <Header />
            <main className="flex-1">
                <div className="container py-6 flex flex-col gap-8">
                    {/* Page Header */}
                    <div className="flex flex-col gap-2">
                        <h1 className="text-3xl font-bold tracking-tight">Guides</h1>
                        <p className="text-muted-foreground">
                            Learn about Warframe mechanics, farming strategies, and game systems.
                        </p>
                    </div>

                    {/* Curated Resources */}
                    {CURATED_RESOURCES.length > 0 && (
                        <section className="flex flex-col gap-4">
                            <div className="flex items-center gap-2">
                                <Star className="h-5 w-5 text-warning" />
                                <h2 className="text-xl font-semibold">Curated</h2>
                            </div>
                            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                {CURATED_RESOURCES.map((resource) => (
                                    <a
                                        key={resource.id}
                                        href={resource.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="group"
                                    >
                                        <Card className="h-full transition-colors hover:bg-accent/50">
                                            <CardHeader>
                                                <div className="flex items-start justify-between gap-2">
                                                    <CardTitle className="text-lg group-hover:underline">
                                                        {resource.title}
                                                    </CardTitle>
                                                    <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
                                                </div>
                                                <CardDescription>{resource.description}</CardDescription>
                                            </CardHeader>
                                        </Card>
                                    </a>
                                ))}
                            </div>
                        </section>
                    )}
                </div>
            </main>
            <Footer />
        </div>
    );
}
