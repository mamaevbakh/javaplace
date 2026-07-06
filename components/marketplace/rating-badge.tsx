import { Star } from "lucide-react"

import { Badge } from "@/components/ui/badge"

/**
 * A vendor with zero reviews shows a neutral "Новый" badge instead of "★ 0.0",
 * which reads as a bad rating and buries legitimate new supply.
 */
export function RatingBadge({
  ratingAvg,
  ratingCount,
}: {
  ratingAvg: string
  ratingCount: number
}) {
  if (ratingCount <= 0) {
    return <Badge variant="outline">Новый</Badge>
  }
  return (
    <Badge variant="secondary">
      <Star className="fill-current" />
      {ratingAvg}
    </Badge>
  )
}
