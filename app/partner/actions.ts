"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { and, eq } from "drizzle-orm"

import { db, masters, services, vendors, vendorWorkingHours } from "@/db"
import {
  getCurrentMerchant,
  loginMerchant,
  logoutMerchant,
  registerMerchant,
  type MerchantAuthResult,
} from "@/lib/merchant-auth"
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

  revalidatePath("/partner")
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
      isActive: input.isActive,
      updatedAt: new Date(),
    })
    .where(and(eq(vendors.id, vendorId), eq(vendors.merchantId, merchant.id)))
    .returning({ id: vendors.id })

  revalidatePath("/partner")
  revalidatePath(`/partner/vendors/${vendorId}`)
  return { ok: Boolean(updated) }
}

export async function deleteVendorAction(vendorId: string): Promise<void> {
  const merchant = await requireMerchant()
  await db
    .delete(vendors)
    .where(and(eq(vendors.id, vendorId), eq(vendors.merchantId, merchant.id)))
  revalidatePath("/partner")
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
  revalidatePath(`/partner/vendors/${vendorId}`)
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
  revalidatePath(`/partner/vendors/${service.vendorId}`)
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
  revalidatePath(`/partner/vendors/${service.vendorId}`)
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
  revalidatePath(`/partner/vendors/${vendorId}`)
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
  revalidatePath(`/partner/vendors/${master.vendorId}`)
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
  revalidatePath(`/partner/vendors/${master.vendorId}`)
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
  revalidatePath(`/partner/vendors/${vendorId}`)
  return { ok: true }
}
