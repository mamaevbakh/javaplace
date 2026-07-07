import { Suspense } from "react"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ChevronLeft, ChevronRight, Clock, MapPin, Navigation, Phone } from "lucide-react"

import { getVendorById } from "@/db/queries"
import { formatDuration, formatPrice, formatWorkingHours } from "@/lib/format"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { PhotoCarousel } from "@/components/marketplace/photo-carousel"
import { RatingBadge } from "@/components/marketplace/rating-badge"

export default function VendorPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  // The back button is static (ships in the shell); the vendor content is cached
  // and streams into the skeleton — instant on a warm cache.
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col gap-4 px-4 pt-3 pb-10">
      <Button
        variant="ghost"
        size="sm"
        className="-ml-2 self-start"
        nativeButton={false}
        render={<Link href="/" />}
      >
        <ChevronLeft data-icon="inline-start" />
        Назад
      </Button>

      <Suspense fallback={<VendorSkeleton />}>
        <VendorContent params={params} />
      </Suspense>
    </main>
  )
}

// Mirrors the real VendorContent layout (cover, header, info, buttons, services)
// so streaming the content in doesn't shift the page.
function VendorSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-4">
      <div className="aspect-video rounded-xl bg-muted" />
      <div className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <div className="h-6 w-1/2 rounded bg-muted" />
          <div className="h-6 w-12 rounded bg-muted" />
        </div>
        <div className="h-5 w-28 rounded bg-muted" />
        <div className="h-4 w-4/5 rounded bg-muted" />
      </div>
      <div className="flex flex-col gap-2">
        <div className="h-4 w-2/3 rounded bg-muted" />
        <div className="h-4 w-1/2 rounded bg-muted" />
      </div>
      <div className="flex gap-2">
        <div className="h-9 flex-1 rounded-lg bg-muted" />
        <div className="h-9 flex-1 rounded-lg bg-muted" />
      </div>
      <div className="h-px bg-border" />
      <div className="h-5 w-24 rounded bg-muted" />
      <div className="flex flex-col gap-3">
        <div className="h-16 rounded-xl bg-muted" />
        <div className="h-16 rounded-xl bg-muted" />
      </div>
    </div>
  )
}

async function VendorContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const vendor = await getVendorById(id)
  if (!vendor) notFound()

  const hours = formatWorkingHours(vendor.workingHours)
  const mapsHref =
    vendor.latitude != null && vendor.longitude != null
      ? `https://maps.google.com/?q=${vendor.latitude},${vendor.longitude}`
      : null

  return (
    <>
      {vendor.photos.length > 0 ? (
        <PhotoCarousel photos={vendor.photos} alt={vendor.name} />
      ) : (
        <div className="flex aspect-video items-center justify-center rounded-xl bg-muted text-7xl">
          {vendor.coverUrl ?? "🏬"}
        </div>
      )}

      <header className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <h1 className="font-heading text-xl font-semibold">{vendor.name}</h1>
          <RatingBadge ratingAvg={vendor.ratingAvg} ratingCount={vendor.ratingCount} />
        </div>
        {vendor.category ? (
          <Badge variant="outline" className="w-fit">
            {vendor.category.icon} {vendor.category.name}
          </Badge>
        ) : null}
        {vendor.description ? (
          <p className="text-sm text-muted-foreground">{vendor.description}</p>
        ) : null}
      </header>

      <div className="flex flex-col gap-2 text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <MapPin className="size-4 shrink-0" />
          <span>{vendor.address}</span>
        </div>
        {hours.length > 0 ? (
          <div className="flex items-start gap-2 text-muted-foreground">
            <Clock className="mt-0.5 size-4 shrink-0" />
            <div className="flex flex-col">
              {hours.map((row) => (
                <span key={row.label}>
                  {row.label}: {row.time}
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <div className="flex gap-2">
        {vendor.phone ? (
          <Button
            variant="outline"
            className="flex-1"
            nativeButton={false}
            render={<a href={`tel:${vendor.phone}`} />}
          >
            <Phone data-icon="inline-start" />
            Позвонить
          </Button>
        ) : null}
        {mapsHref ? (
          <Button
            variant="outline"
            className="flex-1"
            nativeButton={false}
            render={<a href={mapsHref} target="_blank" rel="noreferrer" />}
          >
            <Navigation data-icon="inline-start" />
            Маршрут
          </Button>
        ) : null}
      </div>

      <Separator />

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-base font-medium">Услуги</h2>
        {vendor.services.map((service) => (
          <Link
            key={service.id}
            href={`/vendor/${vendor.id}/book/${service.id}`}
            className="block"
          >
            <Card
              size="sm"
              className="transition-colors hover:ring-foreground/20 active:bg-muted"
            >
              <div className="flex items-center justify-between gap-3 px-(--card-spacing)">
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="font-medium">{service.name}</span>
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Clock className="size-3.5" />
                    {formatDuration(service.durationMinutes)}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <span className="text-base font-semibold">
                    {formatPrice(service.price)}
                  </span>
                  <ChevronRight className="size-5 text-muted-foreground" />
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </section>
    </>
  )
}
