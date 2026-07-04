/**
 * Database schema — Telegram service-marketplace (booking).
 *
 * Design notes:
 * - This DB is the marketplace's source of truth for browse/search/map/booking.
 *   Partner-CRM sync is layered on later via the nullable `externalId` columns
 *   (vendors/services/masters) and `crmBookingId` on bookings.
 * - Availability is COMPUTED (vendorWorkingHours + existing bookings + service
 *   duration), not stored as slot rows.
 * - Money is stored as an integer in minor units (e.g. kopecks). Single currency
 *   per row via `currency` (default RUB).
 * - Geo is plain lat/lng (doublePrecision). PostGIS can be added later for fast
 *   radius queries; v1 computes distance in-query/app.
 */
import { relations } from "drizzle-orm";
import {
  pgTable,
  pgEnum,
  uuid,
  text,
  bigint,
  integer,
  boolean,
  timestamp,
  numeric,
  doublePrecision,
  time,
  primaryKey,
  index,
} from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------
export const bookingStatus = pgEnum("booking_status", [
  "pending", // slot held, awaiting confirmation (CRM/user)
  "confirmed",
  "cancelled",
  "completed",
  "no_show",
]);

export const serviceGender = pgEnum("service_gender", ["male", "female", "unisex"]);

export const discountType = pgEnum("discount_type", ["percent", "fixed"]);

// ---------------------------------------------------------------------------
// Users (Telegram-based; no separate registration)
// ---------------------------------------------------------------------------
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  telegramId: bigint("telegram_id", { mode: "number" }).notNull().unique(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  username: text("username"),
  photoUrl: text("photo_url"),
  languageCode: text("language_code"),
  phone: text("phone"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Categories (barbershop, salon, massage, spa, ...)
// ---------------------------------------------------------------------------
export const categories = pgTable("categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  icon: text("icon"),
  sortOrder: integer("sort_order").notNull().default(0),
});

// ---------------------------------------------------------------------------
// Vendors / partners
// ---------------------------------------------------------------------------
export const vendors = pgTable(
  "vendors",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    categoryId: uuid("category_id").references(() => categories.id),
    name: text("name").notNull(),
    description: text("description"),
    address: text("address"),
    latitude: doublePrecision("latitude"),
    longitude: doublePrecision("longitude"),
    phone: text("phone"),
    coverUrl: text("cover_url"),
    ratingAvg: numeric("rating_avg", { precision: 2, scale: 1 }).notNull().default("0"),
    ratingCount: integer("rating_count").notNull().default(0),
    priceFrom: integer("price_from"), // minor units
    currency: text("currency").notNull().default("RUB"),
    externalId: text("external_id"), // CRM sync seam
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("vendors_category_idx").on(t.categoryId),
    index("vendors_geo_idx").on(t.latitude, t.longitude),
  ],
);

// ---------------------------------------------------------------------------
// Vendor working hours (drives "open now" + slot computation)
// ---------------------------------------------------------------------------
export const vendorWorkingHours = pgTable(
  "vendor_working_hours",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    vendorId: uuid("vendor_id")
      .notNull()
      .references(() => vendors.id, { onDelete: "cascade" }),
    weekday: integer("weekday").notNull(), // 0 = Sunday .. 6 = Saturday
    opensAt: time("opens_at").notNull(),
    closesAt: time("closes_at").notNull(),
  },
  (t) => [index("vendor_hours_vendor_idx").on(t.vendorId)],
);

// ---------------------------------------------------------------------------
// Masters (staff). Optional per vendor.
// ---------------------------------------------------------------------------
export const masters = pgTable(
  "masters",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    vendorId: uuid("vendor_id")
      .notNull()
      .references(() => vendors.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    photoUrl: text("photo_url"),
    bio: text("bio"),
    externalId: text("external_id"),
    isActive: boolean("is_active").notNull().default(true),
  },
  (t) => [index("masters_vendor_idx").on(t.vendorId)],
);

// ---------------------------------------------------------------------------
// Services offered by a vendor
// ---------------------------------------------------------------------------
export const services = pgTable(
  "services",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    vendorId: uuid("vendor_id")
      .notNull()
      .references(() => vendors.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id").references(() => categories.id),
    name: text("name").notNull(),
    description: text("description"),
    price: integer("price").notNull(), // minor units
    currency: text("currency").notNull().default("RUB"),
    durationMinutes: integer("duration_minutes").notNull(),
    gender: serviceGender("gender").notNull().default("unisex"),
    externalId: text("external_id"),
    isActive: boolean("is_active").notNull().default(true),
  },
  (t) => [
    index("services_vendor_idx").on(t.vendorId),
    index("services_category_idx").on(t.categoryId),
  ],
);

// ---------------------------------------------------------------------------
// Which masters perform which services (many-to-many)
// ---------------------------------------------------------------------------
export const masterServices = pgTable(
  "master_services",
  {
    masterId: uuid("master_id")
      .notNull()
      .references(() => masters.id, { onDelete: "cascade" }),
    serviceId: uuid("service_id")
      .notNull()
      .references(() => services.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.masterId, t.serviceId] })],
);

// ---------------------------------------------------------------------------
// Bookings
// ---------------------------------------------------------------------------
export const bookings = pgTable(
  "bookings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    vendorId: uuid("vendor_id")
      .notNull()
      .references(() => vendors.id),
    serviceId: uuid("service_id")
      .notNull()
      .references(() => services.id),
    masterId: uuid("master_id").references(() => masters.id),
    status: bookingStatus("status").notNull().default("pending"),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    price: integer("price").notNull(), // snapshot at booking time, minor units
    currency: text("currency").notNull().default("RUB"),
    phone: text("phone"),
    comment: text("comment"),
    crmBookingId: text("crm_booking_id"), // id returned by partner CRM
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("bookings_user_idx").on(t.userId),
    index("bookings_vendor_idx").on(t.vendorId),
    index("bookings_starts_idx").on(t.startsAt),
  ],
);

// ---------------------------------------------------------------------------
// Reviews (one per booking)
// ---------------------------------------------------------------------------
export const reviews = pgTable(
  "reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" })
      .unique(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    vendorId: uuid("vendor_id")
      .notNull()
      .references(() => vendors.id),
    rating: integer("rating").notNull(), // 1..5
    comment: text("comment"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("reviews_vendor_idx").on(t.vendorId)],
);

// ---------------------------------------------------------------------------
// Favorites (user <-> vendor)
// ---------------------------------------------------------------------------
export const favorites = pgTable(
  "favorites",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    vendorId: uuid("vendor_id")
      .notNull()
      .references(() => vendors.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.vendorId] })],
);

// ---------------------------------------------------------------------------
// Promotions / promo codes (vendor-scoped or global when vendorId is null)
// ---------------------------------------------------------------------------
export const promotions = pgTable("promotions", {
  id: uuid("id").primaryKey().defaultRandom(),
  vendorId: uuid("vendor_id").references(() => vendors.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  promoCode: text("promo_code").unique(),
  discountType: discountType("discount_type"),
  discountValue: integer("discount_value"),
  startsAt: timestamp("starts_at", { withTimezone: true }),
  endsAt: timestamp("ends_at", { withTimezone: true }),
  isActive: boolean("is_active").notNull().default(true),
});

// ---------------------------------------------------------------------------
// Relations (for Drizzle's relational query API)
// ---------------------------------------------------------------------------
export const usersRelations = relations(users, ({ many }) => ({
  bookings: many(bookings),
  reviews: many(reviews),
  favorites: many(favorites),
}));

export const categoriesRelations = relations(categories, ({ many }) => ({
  vendors: many(vendors),
  services: many(services),
}));

export const vendorsRelations = relations(vendors, ({ one, many }) => ({
  category: one(categories, { fields: [vendors.categoryId], references: [categories.id] }),
  services: many(services),
  masters: many(masters),
  workingHours: many(vendorWorkingHours),
  bookings: many(bookings),
  reviews: many(reviews),
  favorites: many(favorites),
  promotions: many(promotions),
}));

export const vendorWorkingHoursRelations = relations(vendorWorkingHours, ({ one }) => ({
  vendor: one(vendors, { fields: [vendorWorkingHours.vendorId], references: [vendors.id] }),
}));

export const mastersRelations = relations(masters, ({ one, many }) => ({
  vendor: one(vendors, { fields: [masters.vendorId], references: [vendors.id] }),
  masterServices: many(masterServices),
  bookings: many(bookings),
}));

export const servicesRelations = relations(services, ({ one, many }) => ({
  vendor: one(vendors, { fields: [services.vendorId], references: [vendors.id] }),
  category: one(categories, { fields: [services.categoryId], references: [categories.id] }),
  masterServices: many(masterServices),
  bookings: many(bookings),
}));

export const masterServicesRelations = relations(masterServices, ({ one }) => ({
  master: one(masters, { fields: [masterServices.masterId], references: [masters.id] }),
  service: one(services, { fields: [masterServices.serviceId], references: [services.id] }),
}));

export const bookingsRelations = relations(bookings, ({ one }) => ({
  user: one(users, { fields: [bookings.userId], references: [users.id] }),
  vendor: one(vendors, { fields: [bookings.vendorId], references: [vendors.id] }),
  service: one(services, { fields: [bookings.serviceId], references: [services.id] }),
  master: one(masters, { fields: [bookings.masterId], references: [masters.id] }),
  review: one(reviews),
}));

export const reviewsRelations = relations(reviews, ({ one }) => ({
  booking: one(bookings, { fields: [reviews.bookingId], references: [bookings.id] }),
  user: one(users, { fields: [reviews.userId], references: [users.id] }),
  vendor: one(vendors, { fields: [reviews.vendorId], references: [vendors.id] }),
}));

export const favoritesRelations = relations(favorites, ({ one }) => ({
  user: one(users, { fields: [favorites.userId], references: [users.id] }),
  vendor: one(vendors, { fields: [favorites.vendorId], references: [vendors.id] }),
}));

export const promotionsRelations = relations(promotions, ({ one }) => ({
  vendor: one(vendors, { fields: [promotions.vendorId], references: [vendors.id] }),
}));
