import { ArrowRight } from "lucide-react"
import Link from "next/link"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { GuideListItem } from "@/lib/guides"

interface RelatedGuidesProps {
  guides: GuideListItem[]
}

export function RelatedGuides({ guides }: RelatedGuidesProps) {
  if (guides.length === 0) return null

  return (
    <Card className="mt-8">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Related Guides</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col gap-3">
          {guides.map((guide) => (
            <li key={guide.id}>
              <Link
                href={`/guides/${guide.slug}`}
                className="group hover:bg-muted/50 -mx-3 flex items-center justify-between rounded-lg px-3 py-2 transition-colors"
              >
                <div className="min-w-0">
                  <h4 className="group-hover:text-primary truncate text-sm font-medium transition-colors">
                    {guide.title}
                  </h4>
                  <p className="text-muted-foreground truncate text-xs">
                    {guide.summary}
                  </p>
                </div>
                <ArrowRight className="text-muted-foreground group-hover:text-primary ml-3 h-4 w-4 shrink-0 transition-all group-hover:translate-x-0.5" />
              </Link>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
