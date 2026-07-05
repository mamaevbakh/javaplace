"use server"

import { updateTag } from "next/cache"
import { redirect } from "next/navigation"
import { and, eq } from "drizzle-orm"
import { del } from "@vercel/blob"

import {
  bookings,
  db,
  masters,
  merchants,
  services,
  vendorPhotos,
  vendors,
  vendorWorkingHours,
} from "@/db"
import { formatDateTimeInTz } from "@/lib/format"
import {
  getCurrentMerchant,
  loginMerchant,
  logoutMerchant,
  registerMerchant,
  type MerchantAuthResult,
} from "@/lib/merchant-auth"
import { merchantLinkToken } from "@/lib/link-token"
import { getMe, isBotConfigured, sendMessage } from "@/lib/telegram-api"
import type {
  MasterInput,
  ServiceInput,
  VendorInput,
  WorkingHoursInput,
} from "@/lib/partner-types"

async function requireMerchant() {
  const merchant = await getCurrentMerchant()
  if (!merchant) redirect("/partner/login")
  return merchant
}

async function assertOwnsVendor(merchantId: string, vendorId: string) {
  const vendor = await db.query.vendors.findFirst({
    where: (v, { eq, and }) => and(eq(v.id, vendorId), eq(v.merchantId, merchantId)),
  })
  return vendor ?? null
}

/**
 * Home list + vendor detail are the only cached surfaces (both tagged "vendors").
 * Bust that tag when public-facing vendor data changes (profile, price, photos,
 * hours, moderation). The portal is dynamic and refreshes client-side
 * (router.refresh), so portal-only mutations — masters, booking status, Telegram —
 * need no revalidation here.
 */
function revalidatePublicVendors() {
  // updateTag (not revalidateTag) in a Server Action: immediate, read-your-writes,
  // so the merchant sees their edit reflected right away.
  updateTag("vendors")
}

/** Keeps vendors.priceFrom in sync with its cheapest active service. */
async function recomputePriceFrom(vendorId: string) {
  const rows = await db
    .select({ price: services.price })
    .from(services)
    .where(and(eq(services.vendorId, vendorId), eq(services.isActive, true)))
  const priceFrom = rows.length ? Math.min(...rows.map((r) => r.price)) : null
  await db
    .update(vendors)
    .set({ priceFrom, updatedAt: new Date() })
    .where(eq(vendors.id, vendorId))
  // Service create/update/delete all funnel through here → one bust covers them.
  revalidatePublicVendors()
}

// --- Auth ---

export async function registerAction(
  email: string,
  password: string,
  name: string,
): Promise<MerchantAuthResult> {
  return registerMerchant(email, password, name)
}

export async function loginAction(
  email: string,
  password: string,
): Promise<MerchantAuthResult> {
  return loginMerchant(email, password)
}

export async function logoutAction(): Promise<void> {
  await logoutMerchant()
  redirect("/partner/login")
}

// --- Vendor CRUD ---

export async function createVendorAction(
  input: VendorInput,
): Promise<{ ok: boolean; vendorId?: string }> {
  const merchant = await requireMerchant()
  if (!input.name.trim()) return { ok: false }

  const [vendor] = await db
    .insert(vendors)
    .values({
      merchantId: merchant.id,
      name: input.name.trim(),
      categoryId: input.categoryId,
      description: input.description.trim() || null,
      address: input.address.trim() || null,
      phone: input.phone.trim() || null,
      latitude: input.latitude,
      longitude: input.longitude,
      coverUrl: input.coverUrl.trim() || null,
      timezone: input.timezone,
      isActive: input.isActive,
    })
    .returning({ id: vendors.id })

  // Default working hours (every day 10:00–20:00) so it's immediately bookable.
  await db.insert(vendorWorkingHours).values(
    Array.from({ length: 7 }, (_, weekday) => ({
      vendorId: vendor.id,
      weekday,
      opensAt: "10:00:00",
      closesAt: "20:00:00",
    })),
  )

  revalidatePublicVendors()
  return { ok: true, vendorId: vendor.id }
}

export async function updateVendorAction(
  vendorId: string,
  input: VendorInput,
): Promise<{ ok: boolean }> {
  const merchant = await requireMerchant()
  const [updated] = await db
    .update(vendors)
    .set({
      name: input.name.trim(),
      categoryId: input.categoryId,
      description: input.description.trim() || null,
      address: input.address.trim() || null,
      phone: input.phone.trim() || null,
      latitude: input.latitude,
      longitude: input.longitude,
      coverUrl: input.coverUrl.trim() || null,
      timezone: input.timezone,
      isActive: input.isActive,
      updatedAt: new Date(),
    })
    .where(and(eq(vendors.id, vendorId), eq(vendors.merchantId, merchant.id)))
    .returning({ id: vendors.id })

  revalidatePublicVendors()
  return { ok: Boolean(updated) }
}

export async function deleteVendorAction(vendorId: string): Promise<void> {
  const merchant = await requireMerchant()
  await db
    .delete(vendors)
    .where(and(eq(vendors.id, vendorId), eq(vendors.merchantId, merchant.id)))
  revalidatePublicVendors()
  redirect("/partner")
}

// --- Service CRUD ---

export async function createServiceAction(
  vendorId: string,
  input: ServiceInput,
): Promise<{ ok: boolean }> {
  const merchant = await requireMerchant()
  const vendor = await assertOwnsVendor(merchant.id, vendorId)
  if (!vendor || !input.name.trim()) return { ok: false }

  await db.insert(services).values({
    vendorId,
    categoryId: vendor.categoryId,
    name: input.name.trim(),
    price: Math.round(input.priceRub * 100),
    durationMinutes: input.durationMinutes,
    description: input.description.trim() || null,
    gender: input.gender,
  })

  await recomputePriceFrom(vendorId)
  return { ok: true }
}

export async function updateServiceAction(
  serviceId: string,
  input: ServiceInput,
): Promise<{ ok: boolean }> {
  const merchant = await requireMerchant()
  const service = await db.query.services.findFirst({
    where: (s, { eq }) => eq(s.id, serviceId),
    with: { vendor: true },
  })
  if (!service || service.vendor.merchantId !== merchant.id) return { ok: false }

  await db
    .update(services)
    .set({
      name: input.name.trim(),
      price: Math.round(input.priceRub * 100),
      durationMinutes: input.durationMinutes,
      description: input.description.trim() || null,
      gender: input.gender,
    })
    .where(eq(services.id, serviceId))

  await recomputePriceFrom(service.vendorId)
  return { ok: true }
}

export async function deleteServiceAction(
  serviceId: string,
): Promise<{ ok: boolean }> {
  const merchant = await requireMerchant()
  const service = await db.query.services.findFirst({
    where: (s, { eq }) => eq(s.id, serviceId),
    with: { vendor: true },
  })
  if (!service || service.vendor.merchantId !== merchant.id) return { ok: false }

  await db.delete(services).where(eq(services.id, serviceId))
  await recomputePriceFrom(service.vendorId)
  return { ok: true }
}

// --- Master CRUD ---

export async function createMasterAction(
  vendorId: string,
  input: MasterInput,
): Promise<{ ok: boolean }> {
  const merchant = await requireMerchant()
  const vendor = await assertOwnsVendor(merchant.id, vendorId)
  if (!vendor || !input.name.trim()) return { ok: false }

  await db.insert(masters).values({
    vendorId,
    name: input.name.trim(),
    bio: input.bio.trim() || null,
    photoUrl: input.photoUrl.trim() || null,
  })
  // Masters aren't shown on the home list or vendor detail (only the booking
  // picker, which is dynamic), so no public cache to bust.
  return { ok: true }
}

export async function updateMasterAction(
  masterId: string,
  input: MasterInput,
): Promise<{ ok: boolean }> {
  const merchant = await requireMerchant()
  const master = await db.query.masters.findFirst({
    where: (m, { eq }) => eq(m.id, masterId),
    with: { vendor: true },
  })
  if (!master || master.vendor.merchantId !== merchant.id) return { ok: false }

  await db
    .update(masters)
    .set({
      name: input.name.trim(),
      bio: input.bio.trim() || null,
      photoUrl: input.photoUrl.trim() || null,
    })
    .where(eq(masters.id, masterId))
  return { ok: true }
}

export async function deleteMasterAction(masterId: string): Promise<{ ok: boolean }> {
  const merchant = await requireMerchant()
  const master = await db.query.masters.findFirst({
    where: (m, { eq }) => eq(m.id, masterId),
    with: { vendor: true },
  })
  if (!master || master.vendor.merchantId !== merchant.id) return { ok: false }

  await db.delete(masters).where(eq(masters.id, masterId))
  return { ok: true }
}

// --- Working hours ---

export async function updateWorkingHoursAction(
  vendorId: string,
  hours: WorkingHoursInput,
): Promise<{ ok: boolean }> {
  const merchant = await requireMerchant()
  const vendor = await assertOwnsVendor(merchant.id, vendorId)
  if (!vendor) return { ok: false }

  await db.delete(vendorWorkingHours).where(eq(vendorWorkingHours.vendorId, vendorId))
  if (hours.length > 0) {
    await db.insert(vendorWorkingHours).values(
      hours.map((h) => ({
        vendorId,
        weekday: h.weekday,
        opensAt: h.opensAt,
        closesAt: h.closesAt,
      })),
    )
  }
  revalidatePublicVendors()
  return { ok: true }
}

// --- Photos (uploaded to Vercel Blob via the client; here we persist the URL) ---

export async function addVendorPhotoAction(
  vendorId: string,
  url: string,
): Promise<{ ok: boolean }> {
  const merchant = await requireMerchant()
  const vendor = await assertOwnsVendor(merchant.id, vendorId)
  if (!vendor || !url) return { ok: false }

  const existing = await db
    .select({ sortOrder: vendorPhotos.sortOrder })
    .from(vendorPhotos)
    .where(eq(vendorPhotos.vendorId, vendorId))
  const nextOrder = existing.length
    ? Math.max(...existing.map((e) => e.sortOrder)) + 1
    : 0

  await db.insert(vendorPhotos).values({ vendorId, url, sortOrder: nextOrder })
  revalidatePublicVendors() // first photo is the home-card cover
  return { ok: true }
}

export async function deleteVendorPhotoAction(
  photoId: string,
): Promise<{ ok: boolean }> {
  const merchant = await requireMerchant()
  const photo = await db.query.vendorPhotos.findFirst({
    where: (p, { eq }) => eq(p.id, photoId),
    with: { vendor: true },
  })
  if (!photo || photo.vendor.merchantId !== merchant.id) return { ok: false }

  await db.delete(vendorPhotos).where(eq(vendorPhotos.id, photoId))
  // Best-effort removal of the underlying blob file.
  try {
    await del(photo.url)
  } catch {
    // ignore — the DB row is gone, which is what the UI reflects
  }
  revalidatePublicVendors()
  return { ok: true }
}

// --- Telegram notifications (merchant opt-in) ---

/** Deep link the merchant opens to connect their Telegram for booking alerts. */
export async function getTelegramConnectLink(): Promise<
  { ok: true; url: string } | { ok: false; error: "not_configured" | "unknown" }
> {
  const merchant = await requireMerchant()
  if (!isBotConfigured()) return { ok: false, error: "not_configured" }
  try {
    const me = await getMe()
    if (!me.username) return { ok: false, error: "unknown" }
    const token = merchantLinkToken(merchant.id)
    return { ok: true, url: `https://t.me/${me.username}?start=${token}` }
  } catch (error) {
    console.error("[telegram connect] getMe failed:", error)
    return { ok: false, error: "unknown" }
  }
}

/** Stop sending Telegram alerts to this merchant. */
export async function disconnectTelegramAction(): Promise<{ ok: boolean }> {
  const merchant = await requireMerchant()
  await db
    .update(merchants)
    .set({ telegramChatId: null, updatedAt: new Date() })
    .where(eq(merchants.id, merchant.id))
  return { ok: true }
}

// --- Bookings (partner inbox / lifecycle) ---

type BookingStatus = "pending" | "confirmed" | "cancelled" | "completed" | "no_show"
export type BookingAction = "confirm" | "decline" | "complete" | "no_show"

// Legal transitions the merchant may drive. "decline" is a partner-side
// cancellation (we reuse `cancelled` — there is no separate `declined` status).
const TRANSITIONS: Record<BookingAction, { from: BookingStatus[]; to: BookingStatus }> = {
  confirm: { from: ["pending"], to: "confirmed" },
  decline: { from: ["pending", "confirmed"], to: "cancelled" },
  complete: { from: ["confirmed"], to: "completed" },
  no_show: { from: ["confirmed"], to: "no_show" },
}

export async function updateBookingStatusAction(
  bookingId: string,
  action: BookingAction,
): Promise<{ ok: boolean; error?: "not_found" | "invalid_transition" }> {
  const merchant = await requireMerchant()

  const booking = await db.query.bookings.findFirst({
    where: (b, { eq }) => eq(b.id, bookingId),
    with: {
      vendor: {
        columns: { merchantId: true, name: true, address: true, timezone: true },
      },
      service: { columns: { name: true } },
      user: { columns: { telegramId: true } },
    },
  })
  if (!booking || booking.vendor.merchantId !== merchant.id) {
    return { ok: false, error: "not_found" }
  }

  const transition = TRANSITIONS[action]
  if (!transition.from.includes(booking.status)) {
    return { ok: false, error: "invalid_transition" }
  }

  await db
    .update(bookings)
    .set({ status: transition.to, updatedAt: new Date() })
    .where(eq(bookings.id, bookingId))

  // Tell the client when the partner confirms or declines. Best-effort.
  if (isBotConfigured() && (action === "confirm" || action === "decline")) {
    try {
      const when = formatDateTimeInTz(booking.startsAt, booking.vendor.timezone)
      const ref = `#${booking.id.slice(0, 8).toUpperCase()}`
      const text =
        action === "confirm"
          ? [
              "✅ <b>Запись подтверждена!</b>",
              "",
              `<b>${booking.service.name}</b>`,
              `📍 ${booking.vendor.name}${booking.vendor.address ? `, ${booking.vendor.address}` : ""}`,
              `🗓 ${when}`,
              "",
              `Номер брони: <b>${ref}</b>`,
              "Ждём вас!",
            ].join("\n")
          : [
              "❌ <b>Запись отклонена</b>",
              "",
              `<b>${booking.service.name}</b>`,
              `📍 ${booking.vendor.name}`,
              `🗓 ${when}`,
              "",
              "К сожалению, партнёр не смог принять запись на это время. Выберите, пожалуйста, другое время.",
            ].join("\n")
      await sendMessage(booking.user.telegramId, text)
    } catch (error) {
      console.error("[booking status] client notify failed:", error)
    }
  }

  return { ok: true }
}
