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

export type Category = Awaited<ReturnType<typeof getCategories>>[number];
export type VendorListItem = Awaited<ReturnType<typeof getVendors>>[number];
