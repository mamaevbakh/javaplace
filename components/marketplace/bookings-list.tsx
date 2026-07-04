"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { CalendarClock, MapPin, RefreshCw } from "lucide-react"

import type { BookingItem } from "@/db/queries"
import { cancelBooking } from "@/app/actions"
import { formatPrice } from "@/lib/format"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

type BadgeVariant = "default" | "secondary" | "outline" | "destructive"

const STATUS: Record<string, { label: string; variant: BadgeVariant }> = {
  pending: { label: "Ожидает", variant: "secondary" },
  confirmed: { label: "Подтверждена", variant: "default" },
  cancelled: { label: "Отменена", variant: "destructive" },
  completed: { label: "Завершена", variant: "outline" },
  no_show: { label: "Не пришли", variant: "destructive" },
}

const dateFmt = new Intl.DateTimeFormat("ru-RU", {
  weekday: "short",
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
})

function isActive(b: BookingItem): boolean {
  return (
    b.status !== "cancelled" &&
    b.status !== "completed" &&
    b.status !== "no_show" &&
    new Date(b.startsAt).getTime() >= Date.now()
  )
}

export function BookingsList({ bookings }: { bookings: BookingItem[] }) {
  const active = bookings.filter(isActive)
  const past = bookings.filter((b) => !isActive(b))

  return (
    <div className="flex flex-col gap-6">
      {active.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-medium">Активные</h2>
          {active.map((b) => (
            <BookingCard key={b.id} booking={b} active />
          ))}
        </section>
      ) : null}
      {past.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-muted-foreground">История</h2>
          {past.map((b) => (
            <BookingCard key={b.id} booking={b} active={false} />
          ))}
        </section>
      ) : null}
    </div>
  )
}

function BookingCard({ booking, active }: { booking: BookingItem; active: boolean }) {
  const router = useRouter()
  const [pending, startTransition] = React.useTransition()
  const [confirming, setConfirming] = React.useState(false)

  const status = STATUS[booking.status] ?? {
    label: booking.status,
    variant: "outline" as BadgeVariant,
  }
  const mapsHref =
    booking.vendor.latitude != null && booking.vendor.longitude != null
      ? `https://maps.google.com/?q=${booking.vendor.latitude},${booking.vendor.longitude}`
      : null

  function cancel() {
    startTransition(async () => {
      await cancelBooking(booking.id)
      setConfirming(false)
      router.refresh()
    })
  }

  return (
    <Card size="sm">
      <CardContent className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <span className="font-medium">{booking.service.name}</span>
          <Badge variant={status.variant}>{status.label}</Badge>
        </div>
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <CalendarClock className="size-3.5 shrink-0" />
          <span className="capitalize">{dateFmt.format(new Date(booking.startsAt))}</span>
        </div>
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <MapPin className="size-3.5 shrink-0" />
          <span className="truncate">{booking.vendor.name}</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">
            #{booking.id.slice(0, 8).toUpperCase()}
          </span>
          <span className="text-sm font-medium">{formatPrice(booking.price)}</span>
        </div>

        {active ? (
          confirming ? (
            <div className="flex items-center gap-2 border-t pt-2">
              <span className="text-sm">Отменить запись?</span>
              <Button
                variant="destructive"
                size="sm"
                disabled={pending}
                onClick={cancel}
                className="ml-auto"
              >
                Да, отменить
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
                Нет
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2 border-t pt-2">
              <Button
                variant="outline"
                size="sm"
                nativeButton={false}
                render={
                  <Link
                    href={`/vendor/${booking.vendorId}/book/${booking.serviceId}?reschedule=${booking.id}`}
                  />
                }
              >
                <RefreshCw data-icon="inline-start" />
                Перенести
              </Button>
              {mapsHref ? (
                <Button
                  variant="outline"
                  size="sm"
                  nativeButton={false}
                  render={<a href={mapsHref} target="_blank" rel="noreferrer" />}
                >
                  <MapPin data-icon="inline-start" />
                  Маршрут
                </Button>
              ) : null}
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto"
                onClick={() => setConfirming(true)}
              >
                Отменить
              </Button>
            </div>
          )
        ) : null}
      </CardContent>
    </Card>
  )
}
