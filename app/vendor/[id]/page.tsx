import Link from "next/link"
import { notFound } from "next/navigation"
import { connection } from "next/server"
import { ChevronLeft, ChevronRight, Clock, MapPin, Navigation, Phone, Star } from "lucide-react"

import { getVendorById } from "@/db/queries"
import { formatDuration, formatPrice, formatWorkingHours } from "@/lib/format"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"

export default async function VendorPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await connection()
  const { id } = await params
  const vendor = await getVendorById(id)
  if (!vendor) notFound()

  const hours = formatWorkingHours(vendor.workingHours)
  const mapsHref =
    vendor.latitude != null && vendor.longitude != null
      ? `https://maps.google.com/?q=${vendor.latitude},${vendor.longitude}`
      : null

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

      <div className="flex aspect-video items-center justify-center rounded-xl bg-muted text-7xl">
        {vendor.coverUrl ?? "🏬"}
      </div>

      <header className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <h1 className="font-heading text-xl font-semibold">{vendor.name}</h1>
          <Badge variant="secondary">
            <Star className="fill-current" />
            {vendor.ratingAvg}
          </Badge>
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
            <Card size="sm" className="transition-shadow hover:ring-foreground/20">
              <div className="flex items-center justify-between gap-3 px-(--card-spacing)">
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="font-medium">{service.name}</span>
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Clock className="size-3.5" />
                    {formatDuration(service.durationMinutes)}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <span className="font-medium">{formatPrice(service.price)}</span>
                  <ChevronRight className="size-4 text-muted-foreground" />
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </section>
    </main>
  )
}
