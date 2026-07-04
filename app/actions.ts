"use server"

import { db, bookings } from "@/db"
import { authenticate as resolveUser, getCurrentUser } from "@/lib/auth"

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

  return { ok: true, bookingId: booking.id, status: booking.status }
}
