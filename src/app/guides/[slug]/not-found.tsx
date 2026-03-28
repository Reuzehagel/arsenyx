import { FileQuestion, ArrowLeft, BookOpen } from "lucide-react"
import Link from "next/link"

import { Footer } from "@/components/footer"
import { Header } from "@/components/header"
import { Button } from "@/components/ui/button"

export default function GuideNotFound() {
  return (
    <div className="relative flex min-h-screen flex-col">
      <Header />
      <main className="flex flex-1 items-center justify-center">
        <div className="container max-w-md py-16 text-center">
          <div className="bg-muted mb-6 inline-flex size-16 items-center justify-center rounded-full">
            <FileQuestion className="text-muted-foreground size-8" />
          </div>
          <h1 className="mb-2 text-2xl font-bold">Guide Not Found</h1>
          <p className="text-muted-foreground mb-8">
            The guide you&apos;re looking for doesn&apos;t exist or has been
            removed.
          </p>
          <div className="flex flex-col justify-center gap-3 sm:flex-row">
            <Button
              variant="outline"
              className="gap-2"
              render={<Link href="/guides" />}
              nativeButton={false}
            >
              <ArrowLeft data-icon="inline-start" />
              Back to Guides
            </Button>
            <Button
              className="gap-2"
              render={<Link href="/guides" />}
              nativeButton={false}
            >
              <BookOpen data-icon="inline-start" />
              Browse All Guides
            </Button>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
