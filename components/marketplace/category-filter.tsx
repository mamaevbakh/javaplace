"use client"

import type { Category } from "@/db/queries"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

export function CategoryFilter({
  categories,
  active,
  onChange,
}: {
  categories: Category[]
  active: string
  onChange: (slug: string) => void
}) {
  return (
    <div className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <ToggleGroup
        variant="outline"
        value={[active]}
        onValueChange={(value) => onChange((value[0] as string) ?? "all")}
        className="w-max"
      >
        <ToggleGroupItem value="all">Все</ToggleGroupItem>
        {categories.map((category) => (
          <ToggleGroupItem key={category.id} value={category.slug}>
            {category.icon} {category.name}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  )
}
