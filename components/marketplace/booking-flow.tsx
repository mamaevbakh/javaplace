"use client"

import * as React from "react"
import Link from "next/link"
import { CheckCircle2, ChevronLeft } from "lucide-react"

import type { BookingContext } from "@/db/queries"
import { computeSlots } from "@/lib/slots"
import { formatDuration, formatPrice } from "@/lib/format"
import { authenticate, createBooking } from "@/app/actions"
import { getInitData } from "@/components/telegram-init"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

const DAY_COUNT = 14

function buildDays(count: number): Date[] {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(today)
    d.setDate(today.getDate() + i)
    return d
  })
}

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`
}

const weekdayFmt = new Intl.DateTimeFormat("ru-RU", { weekday: "short" })
const dayMonthFmt = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short" })
const fullDateFmt = new Intl.DateTimeFormat("ru-RU", {
  weekday: "long",
  day: "numeric",
  month: "long",
})

function dayTopLabel(d: Date, index: number): string {
  if (index === 0) return "Сегодня"
  if (index === 1) return "Завтра"
  return weekdayFmt.format(d)
}

export function BookingFlow({
  vendor,
  service,
}: {
  vendor: BookingContext["vendor"]
  service: BookingContext["service"]
}) {
  const days = React.useMemo(() => buildDays(DAY_COUNT), [])
  const hasMasters = vendor.masters.length > 0

  const [master, setMaster] = React.useState("any")
  const [date, setDate] = React.useState(() => isoDate(days[0]))
  const [time, setTime] = React.useState<string | null>(null)
  const [pending, startTransition] = React.useTransition()
  const [error, setError] = React.useState<string | null>(null)
  const [bookingRef, setBookingRef] = React.useState<{
    id: string
    status: string
  } | null>(null)

  const slots = React.useMemo(
    () =>
      computeSlots(
        new Date(`${date}T00:00:00`),
        vendor.workingHours,
        service.durationMinutes,
      ),
    [date, vendor.workingHours, service.durationMinutes],
  )

  // Changing the date clears the time so we never hold a slot from another day.
  function selectDate(next: string) {
    setDate(next)
    setTime(null)
  }

  function confirm() {
    if (!time || pending) return
    setError(null)
    const payload = {
      vendorId: vendor.id,
      serviceId: service.id,
      masterId: master === "any" ? null : master,
      startsAt: new Date(`${date}T${time}:00`).toISOString(),
      whenText: `${fullDateFmt.format(selectedDay)}, ${time}`,
    }
    startTransition(async () => {
      let result = await createBooking(payload)
      // Session may not be warm yet on first open — authenticate then retry once.
      if (!result.ok && result.error === "unauthenticated") {
        await authenticate(getInitData())
        result = await createBooking(payload)
      }
      if (result.ok) {
        setBookingRef({ id: result.bookingId, status: result.status })
      } else {
        setError("Не удалось создать бронь. Попробуйте ещё раз.")
      }
    })
  }

  const selectedDay = days.find((d) => isoDate(d) === date) ?? days[0]
  const masterName =
    master === "any"
      ? "Любой мастер"
      : (vendor.masters.find((m) => m.id === master)?.name ?? "Любой мастер")

  const summary = (
    <Card>
      <CardContent className="flex flex-col gap-2 text-sm">
        <Row label="Услуга" value={service.name} />
        <Row label="Партнёр" value={vendor.name} />
        {hasMasters ? <Row label="Мастер" value={masterName} /> : null}
        <Row
          label="Когда"
          value={time ? `${fullDateFmt.format(selectedDay)}, ${time}` : "—"}
        />
        <Row label="Длительность" value={formatDuration(service.durationMinutes)} />
        <div className="flex items-center justify-between border-t pt-2 font-medium">
          <span>Итого</span>
          <span>{formatPrice(service.price)}</span>
        </div>
      </CardContent>
    </Card>
  )

  if (bookingRef) {
    return (
      <main className="mx-auto flex min-h-svh w-full max-w-md flex-col gap-4 px-4 pt-10 pb-10">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <CheckCircle2 />
            </EmptyMedia>
            <EmptyTitle>Вы записаны!</EmptyTitle>
            <EmptyDescription>
              Заявка отправлена партнёру. Номер брони{" "}
              <span className="font-medium text-foreground">
                #{bookingRef.id.slice(0, 8).toUpperCase()}
              </span>
              . Уведомления в Telegram появятся вместе с ботом.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
        {summary}
        <Button variant="outline" nativeButton={false} render={<Link href="/" />}>
          На главную
        </Button>
      </main>
    )
  }

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col gap-5 px-4 pt-3 pb-28">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon-sm"
          nativeButton={false}
          render={<Link href={`/vendor/${vendor.id}`} />}
        >
          <ChevronLeft />
        </Button>
        <div className="flex min-w-0 flex-col">
          <h1 className="truncate font-heading text-lg font-semibold">
            {service.name}
          </h1>
          <p className="truncate text-sm text-muted-foreground">{vendor.name}</p>
        </div>
      </div>

      {hasMasters ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-medium">Мастер</h2>
          <div className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <ToggleGroup
              variant="outline"
              value={[master]}
              onValueChange={(value) => setMaster((value[0] as string) ?? "any")}
              className="w-max"
            >
              <ToggleGroupItem value="any">Любой мастер</ToggleGroupItem>
              {vendor.masters.map((m) => (
                <ToggleGroupItem key={m.id} value={m.id}>
                  {m.name}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
        </section>
      ) : null}

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium">Дата</h2>
        <div className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <ToggleGroup
            variant="outline"
            value={[date]}
            onValueChange={(value) => selectDate((value[0] as string) ?? isoDate(days[0]))}
            className="w-max"
          >
            {days.map((d, i) => (
              <ToggleGroupItem
                key={isoDate(d)}
                value={isoDate(d)}
                className="h-auto flex-col gap-0.5 px-3 py-2"
              >
                <span className="text-xs">{dayTopLabel(d, i)}</span>
                <span className="text-sm font-medium">{dayMonthFmt.format(d)}</span>
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium">Время</h2>
        {slots.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            В этот день нет свободного времени.
          </p>
        ) : (
          <ToggleGroup
            variant="outline"
            value={time ? [time] : []}
            onValueChange={(value) => setTime((value[0] as string) ?? null)}
            className="flex-wrap justify-start"
          >
            {slots.map((slot) => (
              <ToggleGroupItem key={slot} value={slot} className="w-16">
                {slot}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        )}
      </section>

      {summary}

      <div className="fixed inset-x-0 bottom-0 border-t bg-background/95 backdrop-blur">
        <div className="mx-auto w-full max-w-md px-4 py-3">
          {error ? (
            <p className="mb-2 text-center text-sm text-destructive">{error}</p>
          ) : null}
          <Button
            size="lg"
            className="w-full"
            disabled={!time || pending}
            onClick={confirm}
          >
            {pending ? "Создаём бронь…" : time ? "Записаться" : "Выберите время"}
          </Button>
        </div>
      </div>
    </main>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="truncate text-right font-medium">{value}</span>
    </div>
  )
}
