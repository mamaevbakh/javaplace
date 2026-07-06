import Image from "next/image"
import Link from "next/link"
import { MapPin } from "lucide-react"

import type { VendorListItem } from "@/db/queries"
import { formatPriceFrom } from "@/lib/format"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { RatingBadge } from "./rating-badge"

// Card spans the full mobile column up to the max-w-md (448px) content width.
const COVER_SIZES = "(max-width: 448px) 100vw, 416px"

export function VendorCard({ vendor }: { vendor: VendorListItem }) {
  const priceFrom = formatPriceFrom(vendor.priceFrom)
  const cover = vendor.photos?.[0]

  return (
    <Link href={`/vendor/${vendor.id}`} className="block">
      <Card className="gap-3 pt-0 transition-shadow hover:ring-foreground/20">
        <div className="relative flex h-24 items-center justify-center overflow-hidden bg-muted text-4xl">
          {cover ? (
            <Image
              src={cover.url}
              alt={vendor.name}
              fill
              sizes={COVER_SIZES}
              className="object-cover"
            />
          ) : (
            (vendor.coverUrl ?? "🏬")
          )}
        </div>

        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="truncate">{vendor.name}</CardTitle>
            <RatingBadge ratingAvg={vendor.ratingAvg} ratingCount={vendor.ratingCount} />
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
    </Link>
  )
}
