import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Icons } from "@/components/icons";
import type { Feature } from "@/lib/types";

export function FeatureCard({ iconKey, title, description }: Feature) {
  const Icon = Icons[iconKey];

  return (
    <Card className="group relative overflow-hidden transition-all hover:shadow-lg hover:-translate-y-1">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      <CardHeader>
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-secondary mb-2">
          <Icon className="h-6 w-6 text-muted-foreground group-hover:text-foreground transition-colors" />
        </div>
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <CardDescription className="text-sm leading-relaxed">
          {description}
        </CardDescription>
      </CardContent>
    </Card>
  );
}
