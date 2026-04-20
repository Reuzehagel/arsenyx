import { Icons } from "@/components/icons"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { Feature } from "@/lib/types"

export function FeatureCard({ iconKey, title, description }: Feature) {
  const Icon = Icons[iconKey]

  return (
    <Card className="group relative overflow-hidden transition-[transform,box-shadow] hover:-translate-y-1 hover:shadow-lg">
      <div className="from-primary/5 absolute inset-0 bg-gradient-to-br to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
      <CardHeader>
        <div className="bg-secondary mb-2 flex h-12 w-12 items-center justify-center rounded-lg">
          <Icon className="text-muted-foreground group-hover:text-foreground h-6 w-6 transition-colors" />
        </div>
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <CardDescription className="text-sm leading-relaxed">
          {description}
        </CardDescription>
      </CardContent>
    </Card>
  )
}
