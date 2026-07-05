"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { CalendarClock, Check, Phone, User, X } from "lucide-react"

import type { MerchantBooking } from "@/db/queries"
import type { BookingAction } from "@/app/partner/actions"
import { updateBookingStatusAction } from "@/app/partner/actions"
import { formatDateTimeInTz, formatPrice } from "@/lib/format"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"

type BadgeVariant = "default" | "secondary" | "outline" | "destructive"

const STATUS: Record<string, { label: string; variant: BadgeVariant }> = {
  pending: { label: "Ожидает", variant: "secondary" },
  confirmed: { label: "Подтверждена", variant: "default" },
  cancelled: { label: "Отклонена", variant: "destructive" },
  completed: { label: "Завершена", variant: "outline" },
  no_show: { label: "Не пришёл", variant: "destructive" },
}

function clientName(b: MerchantBooking): string {
  const name = [b.user.firstName, b.user.lastName].filter(Boolean).join(" ").trim()
  if (name) return name
  if (b.user.username) return `@${b.user.username}`
  return "Клиент"
}

function isUpcoming(b: MerchantBooking): boolean {
  return new Date(b.startsAt).getTime() >= Date.now()
}

export function BookingsInbox({ bookings }: { bookings: MerchantBooking[] }) {
  // Needs action: pending. Confirmed & still upcoming: awaiting the visit.
  // Everything else (past, cancelled, completed, no_show) is history.
  const pending = bookings
    .filter((b) => b.status === "pending")
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
  const confirmed = bookings
    .filter((b) => b.status === "confirmed" && isUpcoming(b))
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
  const history = bookings.filter(
    (b) => !(b.status === "pending" || (b.status === "confirmed" && isUpcoming(b))),
  )

  if (bookings.length === 0) {
    return (
      <Empty className="mt-6">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <CalendarClock />
          </EmptyMedia>
          <EmptyTitle>Записей пока нет</EmptyTitle>
          <EmptyDescription>
            Когда клиенты запишутся через приложение, заявки появятся здесь.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {pending.length > 0 ? (
        <Section title={`Новые заявки · ${pending.length}`}>
          {pending.map((b) => (
            <BookingRow key={b.id} booking={b} />
          ))}
        </Section>
      ) : null}
      {confirmed.length > 0 ? (
        <Section title="Подтверждённые">
          {confirmed.map((b) => (
            <BookingRow key={b.id} booking={b} />
          ))}
        </Section>
      ) : null}
      {history.length > 0 ? (
        <Section title="История" muted>
          {history.map((b) => (
            <BookingRow key={b.id} booking={b} />
          ))}
        </Section>
      ) : null}
    </div>
  )
}

function Section({
  title,
  muted,
  children,
}: {
  title: string
  muted?: boolean
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className={`text-sm font-medium ${muted ? "text-muted-foreground" : ""}`}>
        {title}
      </h2>
      {children}
    </section>
  )
}

function BookingRow({ booking }: { booking: MerchantBooking }) {
  const router = useRouter()
  const [pending, startTransition] = React.useTransition()

  const status = STATUS[booking.status] ?? {
    label: booking.status,
    variant: "outline" as BadgeVariant,
  }
  const phone = booking.user.phone

  function act(action: BookingAction) {
    startTransition(async () => {
      await updateBookingStatusAction(booking.id, action)
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
          <span className="capitalize">
            {formatDateTimeInTz(new Date(booking.startsAt), booking.vendor.timezone)}
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <User className="size-3.5 shrink-0" />
          <span className="truncate">
            {clientName(booking)}
            {booking.master ? ` · мастер: ${booking.master.name}` : ""}
          </span>
        </div>

        {phone ? (
          <a
            href={`tel:${phone}`}
            className="flex items-center gap-1.5 text-sm text-foreground underline-offset-2 hover:underline"
          >
            <Phone className="size-3.5 shrink-0" />
            {phone}
          </a>
        ) : (
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Phone className="size-3.5 shrink-0" />
            Телефон не указан
          </div>
        )}

        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">
            #{booking.id.slice(0, 8).toUpperCase()}
          </span>
          <span className="text-sm font-medium">{formatPrice(booking.price)}</span>
        </div>

        {booking.status === "pending" ? (
          <div className="flex gap-2 border-t pt-2">
            <Button size="sm" className="flex-1" disabled={pending} onClick={() => act("confirm")}>
              <Check data-icon="inline-start" />
              Подтвердить
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              disabled={pending}
              onClick={() => act("decline")}
            >
              <X data-icon="inline-start" />
              Отклонить
            </Button>
          </div>
        ) : booking.status === "confirmed" ? (
          <div className="flex gap-2 border-t pt-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              disabled={pending}
              onClick={() => act("complete")}
            >
              Пришёл
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="flex-1"
              disabled={pending}
              onClick={() => act("no_show")}
            >
              Не пришёл
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
