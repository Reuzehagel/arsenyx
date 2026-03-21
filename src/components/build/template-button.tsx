import Link from "next/link";
import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { slugify } from "@/lib/warframe/slugs";

interface TemplateButtonProps {
  buildSlug: string;
  itemName: string;
  category: string;
}

export function TemplateButton({ buildSlug, itemName, category }: TemplateButtonProps) {
  return (
    <Button variant="outline" size="sm" asChild>
      <Link
        href={`/create?category=${category}&item=${slugify(itemName)}&fork=${buildSlug}`}
      >
        <Copy data-icon="inline-start" />
        Use as Template
      </Link>
    </Button>
  );
}
