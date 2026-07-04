import { asc } from "drizzle-orm";
import { db } from "./index";
import { categories } from "./schema";

/** All service categories, ordered for the filter row. */
export async function getCategories() {
  return db.select().from(categories).orderBy(asc(categories.sortOrder));
}

/** Active vendors with their category, best-rated first (home list). */
export async function getVendors() {
  return db.query.vendors.findMany({
    where: (v, { eq }) => eq(v.isActive, true),
    with: { category: true },
    orderBy: (v, { desc }) => [desc(v.ratingAvg)],
  });
}

/** A single vendor with category, working hours, and its active services. */
export async function getVendorById(id: string) {
  return db.query.vendors.findFirst({
    where: (v, { eq }) => eq(v.id, id),
    with: {
      category: true,
      workingHours: true,
      services: {
        where: (s, { eq }) => eq(s.isActive, true),
        orderBy: (s, { asc }) => [asc(s.price)],
      },
    },
  });
}

/** Everything the booking screen needs: the vendor (+ masters, hours) and one service. */
export async function getServiceBookingContext(vendorId: string, serviceId: string) {
  const vendor = await db.query.vendors.findFirst({
    where: (v, { eq }) => eq(v.id, vendorId),
    with: {
      category: true,
      workingHours: true,
      masters: { where: (m, { eq }) => eq(m.isActive, true) },
      services: {
        where: (s, { eq, and }) => and(eq(s.id, serviceId), eq(s.isActive, true)),
      },
    },
  });

  if (!vendor || vendor.services.length === 0) return null;

  const { services, ...rest } = vendor;
  return { vendor: rest, service: services[0] };
}

/** A user's bookings with vendor/service/master, newest first. */
export async function getUserBookings(userId: string) {
  return db.query.bookings.findMany({
    where: (b, { eq }) => eq(b.userId, userId),
    with: { vendor: true, service: true, master: true },
    orderBy: (b, { desc }) => [desc(b.startsAt)],
  });
}

// --- Merchant portal ---

/** Vendors owned by a merchant, with category and a lightweight service count. */
export async function getMerchantVendors(merchantId: string) {
  return db.query.vendors.findMany({
    where: (v, { eq }) => eq(v.merchantId, merchantId),
    with: { category: true, services: { columns: { id: true } } },
    orderBy: (v, { desc }) => [desc(v.createdAt)],
  });
}

/** A single vendor owned by the merchant (or null), with everything for editing. */
export async function getMerchantVendor(merchantId: string, vendorId: string) {
  const vendor = await db.query.vendors.findFirst({
    where: (v, { eq, and }) => and(eq(v.id, vendorId), eq(v.merchantId, merchantId)),
    with: {
      category: true,
      services: { orderBy: (s, { asc }) => [asc(s.price)] },
      workingHours: true,
      masters: true,
    },
  });
  return vendor ?? null;
}

export type Category = Awaited<ReturnType<typeof getCategories>>[number];
export type MerchantVendorListItem = Awaited<
  ReturnType<typeof getMerchantVendors>
>[number];
export type MerchantVendorDetail = NonNullable<
  Awaited<ReturnType<typeof getMerchantVendor>>
>;
export type VendorListItem = Awaited<ReturnType<typeof getVendors>>[number];
export type VendorDetail = NonNullable<Awaited<ReturnType<typeof getVendorById>>>;
export type BookingContext = NonNullable<
  Awaited<ReturnType<typeof getServiceBookingContext>>
>;
export type BookingItem = Awaited<ReturnType<typeof getUserBookings>>[number];
