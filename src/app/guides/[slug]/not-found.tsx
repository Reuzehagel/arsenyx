import Link from "next/link";
import { FileQuestion, ArrowLeft, BookOpen } from "lucide-react";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";

export default function GuideNotFound() {
    return (
        <div className="relative min-h-screen flex flex-col">
            <Header />
            <main className="flex-1 flex items-center justify-center">
                <div className="container max-w-md text-center py-16">
                    <div className="inline-flex items-center justify-center size-16 rounded-full bg-muted mb-6">
                        <FileQuestion className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <h1 className="text-2xl font-bold mb-2">Guide Not Found</h1>
                    <p className="text-muted-foreground mb-8">
                        The guide you&apos;re looking for doesn&apos;t exist or has been removed.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                        <Button variant="outline" className="gap-2" render={<Link href="/guides" />} nativeButton={false}>
                                <ArrowLeft className="h-4 w-4" />
                                Back to Guides
                        </Button>
                        <Button className="gap-2" render={<Link href="/guides" />} nativeButton={false}>
                                <BookOpen className="h-4 w-4" />
                                Browse All Guides
                        </Button>
                    </div>
                </div>
            </main>
            <Footer />
        </div>
    );
}
