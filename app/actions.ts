"use server"

import { and, eq, gt, inArray, lt, ne } from "drizzle-orm"

import { db, bookings, users } from "@/db"
import { poolDb } from "@/db/pool"
import { getServiceBookingContext, getVendorBookedRanges } from "@/db/queries"
import { authenticate as resolveUser, getCurrentUser } from "@/lib/auth"
import { formatDateTimeInTz, formatPrice } from "@/lib/format"
import { rateLimit } from "@/lib/rate-limit"
import {
  computeAvailableSlots,
  isRangeAvailable,
  zonedTimeToUtc,
  type BookedRange,
} from "@/lib/slots"
import { isBotConfigured, sendMessage } from "@/lib/telegram-api"

/** Establish a session from Telegram initData (or demo fallback). Called on app open. */
export async function authenticate(initData: string) {
  const user = await resolveUser(initData)
  if (!user) return null
  return { id: user.id, firstName: user.firstName, username: user.username }
}

/** "YYYY-MM-DD" one calendar day later (for the day's UTC upper bound). */
function nextDay(dateStr: string): string {
  const [y, mo, d] = dateStr.split("-").map(Number)
  return new Date(Date.UTC(y, mo - 1, d + 1)).toISOString().slice(0, 10)
}

// ---------------------------------------------------------------------------
// Availability
// ---------------------------------------------------------------------------
export type AvailableSlotsInput = {
  vendorId: string
  serviceId: string
  masterId: string | null
  date: string // YYYY-MM-DD (vendor-local)
  excludeBookingId?: string // ignore this booking (rescheduling)
}

/**
 * Free wall-clock start times ("HH:MM") for a date, computed on the server so
 * the client and the booking write agree on a single source of truth.
 */
export async function getAvailableSlots(input: AvailableSlotsInput): Promise<string[]> {
  const ctx = await getServiceBookingContext(input.vendorId, input.serviceId)
  if (!ctx) return []

  const tz = ctx.vendor.timezone
  const from = zonedTimeToUtc(input.date, "00:00", tz)
  const to = zonedTimeToUtc(nextDay(input.date), "00:00", tz)
  const booked = await getVendorBookedRanges(
    input.vendorId,
    from,
    to,
    input.excludeBookingId,
  )

  return computeAvailableSlots({
    dateStr: input.date,
    timezone: tz,
    hours: ctx.vendor.workingHours,
    durationMinutes: ctx.service.durationMinutes,
    booked,
    masterId: input.masterId,
    masterCount: ctx.vendor.masters.length,
  })
}

// ---------------------------------------------------------------------------
// Booking
// ---------------------------------------------------------------------------
export type CreateBookingInput = {
  vendorId: string
  serviceId: string
  masterId: string | null
  date: string // YYYY-MM-DD (vendor-local)
  time: string // HH:MM (vendor-local wall clock)
  phone: string // client contact — the partner needs it to reach the client
  whenText?: string // human-readable date/time for the confirmation message
}

export type BookingError =
  | "unauthenticated"
  | "invalid_service"
  | "in_past"
  | "unavailable" // outside working hours / malformed slot
  | "slot_taken" // raced with another booking
  | "phone_required"
  | "rate_limited"
  | "unknown"

export type CreateBookingResult =
  | { ok: true; bookingId: string; status: string }
  | { ok: false; error: BookingError }

/**
 * SIReadLock / serialization failures Postgres raises under SERIALIZABLE.
 * Drizzle wraps the driver error, so the Postgres SQLSTATE lands on a nested
 * `.cause` (e.g. 40001 "could not serialize access") — walk the chain.
 */
function isSerializationError(e: unknown): boolean {
  let cur = e as { code?: string; cause?: unknown } | undefined
  for (let i = 0; i < 5 && cur; i++) {
    if (cur.code === "40001" || cur.code === "40P01") return true
    cur = cur.cause as typeof cur
  }
  return false
}

class SlotTakenError extends Error {}

type AtomicInsert = {
  vendorId: string
  masterId: string | null
  startsAt: Date
  endsAt: Date
  capacity: number
  values: typeof bookings.$inferInsert
}

/**
 * Insert a booking only if its range is still free, under SERIALIZABLE isolation
 * so two concurrent requests can't both claim the last slot. Postgres SSI aborts
 * the loser with 40001; we retry once, by which point it sees the committed row.
 */
async function insertBookingAtomic(
  input: AtomicInsert,
): Promise<{ id: string; status: string } | "taken"> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await poolDb.transaction(
        async (tx) => {
          const rows = await tx
            .select({
              startsAt: bookings.startsAt,
              endsAt: bookings.endsAt,
              masterId: bookings.masterId,
            })
            .from(bookings)
            .where(
              and(
                eq(bookings.vendorId, input.vendorId),
                inArray(bookings.status, ["pending", "confirmed"]),
                lt(bookings.startsAt, input.endsAt),
                gt(bookings.endsAt, input.startsAt),
                input.values.id ? ne(bookings.id, input.values.id) : undefined,
              ),
            )
          const free = isRangeAvailable(
            input.startsAt,
            input.endsAt,
            rows as BookedRange[],
            input.masterId,
            input.capacity,
          )
          if (!free) throw new SlotTakenError()

          const [row] = await tx
            .insert(bookings)
            .values(input.values)
            .returning({ id: bookings.id, status: bookings.status })
          return row
        },
        { isolationLevel: "serializable" },
      )
    } catch (e) {
      if (e instanceof SlotTakenError) return "taken"
      if (isSerializationError(e) && attempt === 0) continue // retry once
      throw e
    }
  }
  return "taken"
}

/** Creates a booking for the signed-in user. Price/duration are snapshotted from the service. */
export async function createBooking(
  input: CreateBookingInput,
): Promise<CreateBookingResult> {
  const user = await getCurrentUser()
  if (!user) return { ok: false, error: "unauthenticated" }

  // Cap bookings per user to blunt spam/abuse of the create path.
  if (!(await rateLimit(`booking:${user.id}`, 8, 600)).ok) {
    return { ok: false, error: "rate_limited" }
  }

  const ctx = await getServiceBookingContext(input.vendorId, input.serviceId)
  if (!ctx) return { ok: false, error: "invalid_service" }

  const phone = input.phone?.trim()
  if (!phone) return { ok: false, error: "phone_required" }

  const { vendor, service } = ctx
  const startsAt = zonedTimeToUtc(input.date, input.time, vendor.timezone)
  if (Number.isNaN(startsAt.getTime())) return { ok: false, error: "unknown" }
  const endsAt = new Date(startsAt.getTime() + service.durationMinutes * 60_000)

  if (startsAt.getTime() <= Date.now()) return { ok: false, error: "in_past" }

  // The slot must be a real, in-hours start time (guards crafted requests).
  const structural = computeAvailableSlots({
    dateStr: input.date,
    timezone: vendor.timezone,
    hours: vendor.workingHours,
    durationMinutes: service.durationMinutes,
    masterId: input.masterId,
    masterCount: vendor.masters.length,
  })
  if (!structural.includes(input.time)) return { ok: false, error: "unavailable" }

  const result = await insertBookingAtomic({
    vendorId: input.vendorId,
    masterId: input.masterId,
    startsAt,
    endsAt,
    capacity: Math.max(1, vendor.masters.length),
    values: {
      userId: user.id,
      vendorId: input.vendorId,
      serviceId: input.serviceId,
      masterId: input.masterId,
      startsAt,
      endsAt,
      price: service.price,
      currency: service.currency,
      phone,
      status: "pending",
    },
  })
  if (result === "taken") return { ok: false, error: "slot_taken" }

  // Remember the phone on the profile so repeat bookings pre-fill it.
  if (phone !== user.phone) {
    try {
      await db
        .update(users)
        .set({ phone, updatedAt: new Date() })
        .where(eq(users.id, user.id))
    } catch (error) {
      console.error("[booking] phone save failed:", error)
    }
  }

  // Best-effort Telegram confirmation (§10) — never blocks the booking result.
  if (isBotConfigured()) {
    try {
      const text = [
        "✅ <b>Заявка принята!</b>",
        "",
        `<b>${service.name}</b>`,
        `📍 ${vendor.name}${vendor.address ? `, ${vendor.address}` : ""}`,
        input.whenText ? `🗓 ${input.whenText}` : null,
        `💳 ${formatPrice(service.price)}`,
        "",
        `Номер брони: <b>#${result.id.slice(0, 8).toUpperCase()}</b>`,
        "Мы сообщим, когда партнёр подтвердит запись.",
      ]
        .filter(Boolean)
        .join("\n")
      await sendMessage(user.telegramId, text)
    } catch (error) {
      console.error("[booking] telegram notify failed:", error)
    }

    // Notify the owning merchant if they've connected Telegram alerts.
    if (vendor.merchantId) {
      try {
        const merchant = await db.query.merchants.findFirst({
          where: (m, { eq }) => eq(m.id, vendor.merchantId!),
          columns: { telegramChatId: true },
        })
        if (merchant?.telegramChatId) {
          const clientName =
            [user.firstName, user.lastName].filter(Boolean).join(" ").trim() ||
            (user.username ? `@${user.username}` : "Клиент")
          const portal = process.env.APP_URL
            ? `${process.env.APP_URL}/partner/bookings`
            : "портале партнёра"
          const text = [
            "🔔 <b>Новая заявка!</b>",
            "",
            `<b>${service.name}</b>`,
            `🏬 ${vendor.name}`,
            `🗓 ${formatDateTimeInTz(startsAt, vendor.timezone)}`,
            `👤 ${clientName}`,
            `📞 ${phone}`,
            "",
            `Подтвердите: ${portal}`,
          ].join("\n")
          await sendMessage(merchant.telegramChatId, text)
        }
      } catch (error) {
        console.error("[booking] merchant notify failed:", error)
      }
    }
  }

  return { ok: true, bookingId: result.id, status: result.status }
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
  date: string // YYYY-MM-DD (vendor-local)
  time: string // HH:MM (vendor-local wall clock)
  phone?: string // optional contact update on reschedule
  whenText?: string
}

/** Moves an existing booking to a new time (and optionally master). */
export async function rescheduleBooking(
  input: RescheduleInput,
): Promise<CreateBookingResult> {
  const user = await getCurrentUser()
  if (!user) return { ok: false, error: "unauthenticated" }

  const booking = await db.query.bookings.findFirst({
    where: (b, { eq, and }) => and(eq(b.id, input.bookingId), eq(b.userId, user.id)),
    with: { service: true, vendor: { columns: { timezone: true } } },
  })
  if (!booking) return { ok: false, error: "unknown" }

  const tz = booking.vendor.timezone
  const startsAt = zonedTimeToUtc(input.date, input.time, tz)
  if (Number.isNaN(startsAt.getTime())) return { ok: false, error: "unknown" }
  const endsAt = new Date(startsAt.getTime() + booking.service.durationMinutes * 60_000)
  if (startsAt.getTime() <= Date.now()) return { ok: false, error: "in_past" }

  // Count active masters for capacity, and confirm the slot is still free
  // (excluding this booking itself), under SERIALIZABLE isolation.
  const masterRows = await db.query.masters.findMany({
    where: (m, { eq, and }) => and(eq(m.vendorId, booking.vendorId), eq(m.isActive, true)),
    columns: { id: true },
  })
  const capacity = Math.max(1, masterRows.length)

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const outcome = await poolDb.transaction(
        async (tx) => {
          const rows = await tx
            .select({
              startsAt: bookings.startsAt,
              endsAt: bookings.endsAt,
              masterId: bookings.masterId,
            })
            .from(bookings)
            .where(
              and(
                eq(bookings.vendorId, booking.vendorId),
                inArray(bookings.status, ["pending", "confirmed"]),
                lt(bookings.startsAt, endsAt),
                gt(bookings.endsAt, startsAt),
                ne(bookings.id, input.bookingId),
              ),
            )
          if (!isRangeAvailable(startsAt, endsAt, rows as BookedRange[], input.masterId, capacity)) {
            throw new SlotTakenError()
          }
          await tx
            .update(bookings)
            .set({
              startsAt,
              endsAt,
              masterId: input.masterId,
              status: "pending",
              ...(input.phone?.trim() ? { phone: input.phone.trim() } : {}),
              updatedAt: new Date(),
            })
            .where(and(eq(bookings.id, input.bookingId), eq(bookings.userId, user.id)))
          return "ok" as const
        },
        { isolationLevel: "serializable" },
      )
      if (outcome === "ok") return { ok: true, bookingId: booking.id, status: "pending" }
    } catch (e) {
      if (e instanceof SlotTakenError) return { ok: false, error: "slot_taken" }
      if (isSerializationError(e) && attempt === 0) continue
      throw e
    }
  }
  return { ok: false, error: "slot_taken" }
}
