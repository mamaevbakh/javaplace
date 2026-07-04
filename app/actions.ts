"use server"

import { and, eq } from "drizzle-orm"

import { db, bookings } from "@/db"
import { authenticate as resolveUser, getCurrentUser } from "@/lib/auth"
import { formatPrice } from "@/lib/format"
import { isBotConfigured, sendMessage } from "@/lib/telegram-api"

/** Establish a session from Telegram initData (or demo fallback). Called on app open. */
export async function authenticate(initData: string) {
  const user = await resolveUser(initData)
  if (!user) return null
  return { id: user.id, firstName: user.firstName, username: user.username }
}

export type CreateBookingInput = {
  vendorId: string
  serviceId: string
  masterId: string | null
  startsAt: string // ISO string
  whenText?: string // human-readable date/time for the confirmation message
}

export type CreateBookingResult =
  | { ok: true; bookingId: string; status: string }
  | { ok: false; error: "unauthenticated" | "invalid_service" | "unknown" }

/** Creates a booking for the signed-in user. Price/duration are snapshotted from the service. */
export async function createBooking(
  input: CreateBookingInput,
): Promise<CreateBookingResult> {
  const user = await getCurrentUser()
  if (!user) return { ok: false, error: "unauthenticated" }

  const service = await db.query.services.findFirst({
    where: (s, { eq }) => eq(s.id, input.serviceId),
  })
  if (!service || service.vendorId !== input.vendorId || !service.isActive) {
    return { ok: false, error: "invalid_service" }
  }

  const startsAt = new Date(input.startsAt)
  if (Number.isNaN(startsAt.getTime())) return { ok: false, error: "unknown" }
  const endsAt = new Date(startsAt.getTime() + service.durationMinutes * 60_000)

  const [booking] = await db
    .insert(bookings)
    .values({
      userId: user.id,
      vendorId: input.vendorId,
      serviceId: input.serviceId,
      masterId: input.masterId,
      startsAt,
      endsAt,
      price: service.price,
      currency: service.currency,
      phone: user.phone,
      status: "pending",
    })
    .returning({ id: bookings.id, status: bookings.status })

  // Best-effort Telegram confirmation (§10) — never blocks the booking result.
  if (isBotConfigured()) {
    try {
      const vendor = await db.query.vendors.findFirst({
        where: (v, { eq }) => eq(v.id, input.vendorId),
      })
      const text = [
        "✅ <b>Заявка принята!</b>",
        "",
        `<b>${service.name}</b>`,
        vendor ? `📍 ${vendor.name}${vendor.address ? `, ${vendor.address}` : ""}` : null,
        input.whenText ? `🗓 ${input.whenText}` : null,
        `💳 ${formatPrice(service.price)}`,
        "",
        `Номер брони: <b>#${booking.id.slice(0, 8).toUpperCase()}</b>`,
        "Мы сообщим, когда партнёр подтвердит запись.",
      ]
        .filter(Boolean)
        .join("\n")
      await sendMessage(user.telegramId, text)
    } catch (error) {
      console.error("[booking] telegram notify failed:", error)
    }
  }

  return { ok: true, bookingId: booking.id, status: booking.status }
}

/** Cancels a booking owned by the current user. */
export async function cancelBooking(bookingId: string): Promise<{ ok: boolean }> {
  const user = await getCurrentUser()
  if (!user) return { ok: false }

  const [updated] = await db
    .update(bookings)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(and(eq(bookings.id, bookingId), eq(bookings.userId, user.id)))
    .returning({ id: bookings.id })

  return { ok: Boolean(updated) }
}

export type RescheduleInput = {
  bookingId: string
  masterId: string | null
  startsAt: string // ISO string
  whenText?: string
}

/** Moves an existing booking to a new time (and optionally master). */
export async function rescheduleBooking(
  input: RescheduleInput,
): Promise<CreateBookingResult> {
  const user = await getCurrentUser()
  if (!user) return { ok: false, error: "unauthenticated" }

  const booking = await db.query.bookings.findFirst({
    where: (b, { eq, and }) =>
      and(eq(b.id, input.bookingId), eq(b.userId, user.id)),
    with: { service: true },
  })
  if (!booking) return { ok: false, error: "unknown" }

  const startsAt = new Date(input.startsAt)
  if (Number.isNaN(startsAt.getTime())) return { ok: false, error: "unknown" }
  const endsAt = new Date(startsAt.getTime() + booking.service.durationMinutes * 60_000)

  await db
    .update(bookings)
    .set({
      startsAt,
      endsAt,
      masterId: input.masterId,
      status: "pending",
      updatedAt: new Date(),
    })
    .where(and(eq(bookings.id, input.bookingId), eq(bookings.userId, user.id)))

  return { ok: true, bookingId: booking.id, status: "pending" }
}
