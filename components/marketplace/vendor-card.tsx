import { MapPin, Star } from "lucide-react"

import type { VendorListItem } from "@/db/queries"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

function formatPriceFrom(minorUnits: number | null): string | null {
  if (minorUnits == null) return null
  const rubles = Math.round(minorUnits / 100)
  return `от ${rubles.toLocaleString("ru-RU")} ₽`
}

export function VendorCard({ vendor }: { vendor: VendorListItem }) {
  const priceFrom = formatPriceFrom(vendor.priceFrom)

  return (
    <Card className="cursor-pointer gap-3 pt-0 transition-shadow hover:ring-foreground/20">
      <div className="flex aspect-[5/2] items-center justify-center bg-muted text-5xl">
        {vendor.coverUrl ?? "🏬"}
      </div>

      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="truncate">{vendor.name}</CardTitle>
          <Badge variant="secondary">
            <Star className="fill-current" />
            {vendor.ratingAvg}
          </Badge>
        </div>
        {vendor.category ? (
          <Badge variant="outline">
            {vendor.category.icon} {vendor.category.name}
          </Badge>
        ) : null}
      </CardHeader>

      <CardContent className="flex items-center justify-between gap-3">
        <span className="flex min-w-0 items-center gap-1 text-sm text-muted-foreground">
          <MapPin className="size-3.5 shrink-0" />
          <span className="truncate">{vendor.address}</span>
        </span>
        {priceFrom ? (
          <span className="shrink-0 text-sm font-medium">{priceFrom}</span>
        ) : null}
      </CardContent>
    </Card>
  )
}
