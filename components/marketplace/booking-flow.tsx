"use client"

import * as React from "react"
import Link from "next/link"
import { CheckCircle2, ChevronLeft } from "lucide-react"

import type { BookingContext } from "@/db/queries"
import { formatDuration, formatPrice } from "@/lib/format"
import {
  authenticate,
  createBooking,
  getAvailableSlots,
  rescheduleBooking,
} from "@/app/actions"
import { getInitData } from "@/components/telegram-init"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
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
  rescheduleId,
  reschedule,
  initialPhone,
}: {
  vendor: BookingContext["vendor"]
  service: BookingContext["service"]
  rescheduleId?: string
  reschedule?: { whenText: string; masterId: string | null }
  initialPhone?: string
}) {
  const days = React.useMemo(() => buildDays(DAY_COUNT), [])
  const hasMasters = vendor.masters.length > 0

  const [master, setMaster] = React.useState(reschedule?.masterId ?? "any")
  const [date, setDate] = React.useState(() => isoDate(days[0]))
  const [time, setTime] = React.useState<string | null>(null)
  const [phone, setPhone] = React.useState(initialPhone ?? "")
  const [slots, setSlots] = React.useState<string[]>([])
  const [slotsLoading, setSlotsLoading] = React.useState(true)
  const [slotsError, setSlotsError] = React.useState(false)
  const [pending, startTransition] = React.useTransition()
  const [error, setError] = React.useState<string | null>(null)
  const [bookingRef, setBookingRef] = React.useState<{
    id: string
    status: string
  } | null>(null)

  // Slots are computed on the server (working hours − already-booked ranges, in
  // the vendor's timezone) so the list and the booking write can't disagree.
  const loadSlots = React.useCallback(() => {
    let active = true
    setSlotsLoading(true)
    setSlotsError(false)
    const masterId = master === "any" ? null : master
    getAvailableSlots({
      vendorId: vendor.id,
      serviceId: service.id,
      masterId,
      date,
      excludeBookingId: rescheduleId,
    })
      .then((result) => {
        if (!active) return
        setSlots(result)
        // Drop a held time if it's no longer offered for the new date/master.
        setTime((cur) => (cur && result.includes(cur) ? cur : null))
      })
      .catch(() => {
        if (!active) return
        setSlots([])
        setSlotsError(true) // distinguish a failed load from a genuinely full day
      })
      .finally(() => active && setSlotsLoading(false))
    return () => {
      active = false
    }
  }, [vendor.id, service.id, date, master, rescheduleId])

  // A genuine data-fetch effect; the loading flag it sets is intentional.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  React.useEffect(() => loadSlots(), [loadSlots])

  // Backfill the phone once the session warms and the server passes it (a cold
  // deep-link open renders before auth completes). Never clobbers user edits.
  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (initialPhone) setPhone((cur) => cur || initialPhone)
  }, [initialPhone])

  // Convenience: let the user share their Telegram phone instead of typing it.
  const canShareContact =
    typeof window !== "undefined" && Boolean(window.Telegram?.WebApp?.requestContact)
  function shareContact() {
    window.Telegram?.WebApp?.requestContact?.((shared, response) => {
      const num = response?.responseUnsafe?.contact?.phone_number
      if (shared && num) setPhone(num)
    })
  }

  function confirm() {
    if (!time || pending) return
    if (!phone.trim()) {
      setError("Укажите номер телефона — он нужен партнёру для связи.")
      return
    }
    setError(null)
    const masterId = master === "any" ? null : master
    const whenText = `${fullDateFmt.format(selectedDay)}, ${time}`
    const submit = () =>
      rescheduleId
        ? rescheduleBooking({ bookingId: rescheduleId, masterId, date, time, whenText, phone })
        : createBooking({
            vendorId: vendor.id,
            serviceId: service.id,
            masterId,
            date,
            time,
            whenText,
            phone,
          })

    startTransition(async () => {
      let result = await submit()
      // Session may not be warm yet on first open — authenticate then retry once.
      if (!result.ok && result.error === "unauthenticated") {
        await authenticate(getInitData())
        result = await submit()
      }
      if (result.ok) {
        setBookingRef({ id: result.bookingId, status: result.status })
      } else if (result.error === "slot_taken") {
        setError("Это время только что заняли. Выберите другое.")
        loadSlots()
      } else if (result.error === "in_past") {
        setError("Это время уже прошло. Выберите другое.")
        loadSlots()
      } else if (result.error === "unavailable") {
        setError("Это время недоступно. Выберите другое.")
        loadSlots()
      } else if (result.error === "phone_required") {
        setError("Укажите номер телефона — он нужен партнёру для связи.")
      } else if (result.error === "rate_limited") {
        setError("Слишком много попыток. Подождите немного и попробуйте снова.")
      } else {
        setError("Не удалось сохранить запись. Попробуйте ещё раз.")
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
            <EmptyTitle>{rescheduleId ? "Запись перенесена!" : "Вы записаны!"}</EmptyTitle>
            <EmptyDescription>
              {rescheduleId ? "Новое время сохранено" : "Заявка отправлена партнёру"}. Номер брони{" "}
              <span className="font-medium text-foreground">
                #{bookingRef.id.slice(0, 8).toUpperCase()}
              </span>
              . Уведомления придут в Telegram.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
        {summary}
        <div className="flex flex-col gap-2">
          <Button nativeButton={false} render={<Link href="/bookings" />}>
            Мои записи
          </Button>
          <Button variant="outline" nativeButton={false} render={<Link href="/" />}>
            На главную
          </Button>
        </div>
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

      {reschedule ? (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
          Переносим запись с <span className="font-medium">{reschedule.whenText}</span>.
          Выберите новое время{hasMasters ? " и мастера" : ""}.
        </div>
      ) : null}

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
            onValueChange={(value) => setDate((value[0] as string) ?? isoDate(days[0]))}
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
        {slotsLoading ? (
          <p className="text-sm text-muted-foreground">Загружаем свободное время…</p>
        ) : slotsError ? (
          <div className="flex items-center gap-3">
            <p className="text-sm text-destructive">Не удалось загрузить время.</p>
            <Button variant="outline" size="sm" type="button" onClick={loadSlots}>
              Повторить
            </Button>
          </div>
        ) : slots.length === 0 ? (
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

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium">Телефон для связи</h2>
        <div className="flex gap-2">
          <Input
            type="tel"
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+998 90 123 45 67"
          />
          {canShareContact ? (
            <Button variant="outline" type="button" onClick={shareContact}>
              Из Telegram
            </Button>
          ) : null}
        </div>
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
            disabled={!time || !phone.trim() || pending}
            onClick={confirm}
          >
            {pending
              ? "Создаём бронь…"
              : !time
                ? "Выберите время"
                : !phone.trim()
                  ? "Укажите телефон"
                  : "Записаться"}
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
