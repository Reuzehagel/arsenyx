import { Copy } from "lucide-react"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { slugify } from "@/lib/warframe/slugs"

interface TemplateButtonProps {
  buildSlug: string
  itemName: string
  category: string
}

export function TemplateButton({
  buildSlug,
  itemName,
  category,
}: TemplateButtonProps) {
  return (
    <Button
      variant="outline"
      size="sm"
      render={
        <Link
          href={`/create?category=${category}&item=${slugify(itemName)}&fork=${buildSlug}`}
        />
      }
      nativeButton={false}
    >
      <Copy data-icon="inline-start" />
      Copy Build
    </Button>
  )
}
