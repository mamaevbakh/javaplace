import { and, asc, eq, gt, inArray, lt, ne, sql, type Column } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { db } from "./index";
import { bookings, categories, vendors } from "./schema";

/**
 * Public-visibility condition for a vendor: it's shown only if it has no owning
 * merchant (platform-seeded) or its merchant has been approved (moderation).
 */
function ownerApproved(merchantIdCol: Column) {
  return sql`(${merchantIdCol} is null or exists (select 1 from merchants m where m.id = ${merchantIdCol} and m.status = 'approved'))`;
}

/**
 * All service categories, ordered for the filter row. Cached — categories are
 * effectively static (bust with revalidateTag('categories') if they ever change).
 */
export async function getCategories() {
  "use cache";
  cacheLife("days");
  cacheTag("categories");
  return db.select().from(categories).orderBy(asc(categories.sortOrder));
}

/**
 * Active vendors with their category + first photo (for the card cover), best-rated
 * first. Cached into the home page's static shell; busted by revalidateTag('vendors')
 * on any vendor/service/photo/moderation change.
 *
 * NOTE: for serverless persistence across instances, upgrade to "use cache: remote".
 */
export async function getVendors() {
  "use cache";
  cacheLife("hours");
  cacheTag("vendors");
  return db.query.vendors.findMany({
    where: (v, { eq, and }) => and(eq(v.isActive, true), ownerApproved(v.merchantId)),
    with: {
      category: true,
      photos: {
        orderBy: (p, { asc }) => [asc(p.sortOrder)],
        limit: 1,
        columns: { id: true, url: true },
      },
    },
    orderBy: (v, { desc }) => [desc(v.ratingAvg)],
  });
}

/**
 * A single vendor with category, working hours, and its active services. Cached
 * per id (the arg is part of the cache key); busted by revalidateTag('vendors').
 */
export async function getVendorById(id: string) {
  "use cache";
  cacheLife("hours");
  cacheTag("vendors");
  return db.query.vendors.findFirst({
    where: (v, { eq, and }) => and(eq(v.id, id), ownerApproved(v.merchantId)),
    with: {
      category: true,
      workingHours: true,
      photos: { orderBy: (p, { asc }) => [asc(p.sortOrder)] },
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
    where: (v, { eq, and }) => and(eq(v.id, vendorId), ownerApproved(v.merchantId)),
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

/**
 * Occupied time ranges for a vendor that overlap the [from, to) UTC window.
 * Only "live" bookings (pending/confirmed) hold a slot; cancelled/completed/
 * no_show do not. `excludeBookingId` skips a booking being rescheduled.
 */
export async function getVendorBookedRanges(
  vendorId: string,
  from: Date,
  to: Date,
  excludeBookingId?: string,
) {
  return db
    .select({
      startsAt: bookings.startsAt,
      endsAt: bookings.endsAt,
      masterId: bookings.masterId,
    })
    .from(bookings)
    .where(
      and(
        eq(bookings.vendorId, vendorId),
        inArray(bookings.status, ["pending", "confirmed"]),
        lt(bookings.startsAt, to), // starts before the window ends …
        gt(bookings.endsAt, from), // … and ends after it starts → overlaps
        excludeBookingId ? ne(bookings.id, excludeBookingId) : undefined,
      ),
    );
}

/** One of a user's bookings (for the reschedule screen): its old time + master. */
export async function getUserBooking(bookingId: string, userId: string) {
  return db.query.bookings.findFirst({
    where: (b, { eq, and }) => and(eq(b.id, bookingId), eq(b.userId, userId)),
    columns: { id: true, startsAt: true, masterId: true },
    with: { vendor: { columns: { timezone: true } } },
  });
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
      photos: { orderBy: (p, { asc }) => [asc(p.sortOrder)] },
    },
  });
  return vendor ?? null;
}

/**
 * All bookings across a merchant's vendors (the portal "Записи" inbox), newest
 * first. Includes client contact, service, master, and the vendor (for its
 * timezone). Bookings have no direct merchant link, so we scope by vendor ids.
 */
export async function getMerchantBookings(merchantId: string) {
  const owned = await db
    .select({ id: vendors.id })
    .from(vendors)
    .where(eq(vendors.merchantId, merchantId));
  const vendorIds = owned.map((v) => v.id);
  if (vendorIds.length === 0) return [];

  return db.query.bookings.findMany({
    where: (b, { inArray }) => inArray(b.vendorId, vendorIds),
    with: {
      vendor: { columns: { id: true, name: true, timezone: true } },
      service: { columns: { name: true, durationMinutes: true } },
      master: { columns: { name: true } },
      user: {
        columns: { firstName: true, lastName: true, username: true, phone: true },
      },
    },
    orderBy: (b, { desc }) => [desc(b.startsAt)],
  });
}

/** Count of bookings awaiting the merchant's action (pending), for the nav badge. */
export async function getMerchantPendingCount(merchantId: string): Promise<number> {
  const owned = await db
    .select({ id: vendors.id })
    .from(vendors)
    .where(eq(vendors.merchantId, merchantId));
  const vendorIds = owned.map((v) => v.id);
  if (vendorIds.length === 0) return 0;

  const rows = await db
    .select({ id: bookings.id })
    .from(bookings)
    .where(and(inArray(bookings.vendorId, vendorIds), eq(bookings.status, "pending")));
  return rows.length;
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
export type MerchantBooking = Awaited<ReturnType<typeof getMerchantBookings>>[number];
