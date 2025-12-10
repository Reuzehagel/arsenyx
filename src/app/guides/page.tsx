import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Star, Users, ExternalLink } from "lucide-react";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { GuideList } from "@/components/guides";
import { getGuides, getAllTags } from "@/lib/guides";
import { CURATED_RESOURCES } from "@/lib/guides/curated-resources";

export const metadata: Metadata = {
    title: "Guides | ARSENIX",
    description:
        "Learn about Warframe mechanics, farming strategies, and game systems with in-depth guides.",
};

// ISR: Revalidate every hour
export const revalidate = 3600;

export default function GuidesPage() {
    const guides = getGuides();
    const allTags = getAllTags();

    return (
        <div className="relative min-h-screen flex flex-col">
            <Header />
            <main className="flex-1">
                <div className="container py-6 space-y-8">
                    {/* Page Header */}
                    <div className="space-y-2">
                        <h1 className="text-3xl font-bold tracking-tight">Guides</h1>
                        <p className="text-muted-foreground">
                            Learn about Warframe mechanics, farming strategies, and game systems.
                        </p>
                    </div>

                    {/* Curated Section */}
                    {CURATED_RESOURCES.length > 0 && (
                        <section className="space-y-4">
                            <div className="flex items-center gap-2">
                                <Star className="h-5 w-5 text-yellow-500" />
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
                                                    <div className="flex items-center gap-2">
                                                        {resource.icon && (
                                                            <span className="text-xl">{resource.icon}</span>
                                                        )}
                                                        <CardTitle className="text-lg group-hover:underline">
                                                            {resource.title}
                                                        </CardTitle>
                                                    </div>
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

                    {/* Community Section */}
                    <section className="space-y-4">
                        <div className="flex items-center gap-2">
                            <Users className="h-5 w-5 text-muted-foreground" />
                            <h2 className="text-xl font-semibold">Community</h2>
                        </div>
                        <Suspense>
                            <GuideList
                                initialGuides={guides}
                                allTags={allTags}
                                newGuideButton={
                                    <Button asChild className="gap-2 shrink-0">
                                        <Link href="/guides/new">
                                            <Plus className="h-4 w-4" />
                                            New Guide
                                        </Link>
                                    </Button>
                                }
                            />
                        </Suspense>
                    </section>
                </div>
            </main>
            <Footer />
        </div>
    );
}

