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

export type Category = Awaited<ReturnType<typeof getCategories>>[number];
export type VendorListItem = Awaited<ReturnType<typeof getVendors>>[number];
export type VendorDetail = NonNullable<Awaited<ReturnType<typeof getVendorById>>>;
export type BookingContext = NonNullable<
  Awaited<ReturnType<typeof getServiceBookingContext>>
>;
