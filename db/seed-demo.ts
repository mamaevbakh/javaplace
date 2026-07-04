/**
 * Seeds demo vendors + services + working hours + masters so the UI has
 * data to render. Idempotent: wipes prior demo rows (externalId `demo-*`)
 * first, then re-inserts. Run with: `npm run db:seed:demo`.
 */
import "dotenv/config";
import { like } from "drizzle-orm";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import {
  categories,
  vendors,
  vendorWorkingHours,
  services,
  masters,
  masterServices,
} from "./schema";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error("DATABASE_URL is not set — add it to your .env file.");
}
const db = drizzle(neon(DATABASE_URL), {
  schema: { categories, vendors, vendorWorkingHours, services, masters, masterServices },
});

const rub = (n: number) => n * 100; // rubles -> minor units

// Moscow center; each vendor nudged slightly so map pins differ.
const BASE_LAT = 55.7558;
const BASE_LNG = 37.6173;

type DemoService = { name: string; price: number; duration: number };
type DemoVendor = {
  slug: string; // category slug
  name: string;
  description: string;
  address: string;
  rating: string;
  cover: string; // emoji placeholder
  masters: string[];
  services: DemoService[];
};

const DEMO: DemoVendor[] = [
  {
    slug: "barbershop",
    name: "Barber King",
    description: "Классический мужской барбершоп в центре города.",
    address: "ул. Тверская, 12",
    rating: "4.8",
    cover: "💈",
    masters: ["Иван", "Дмитрий"],
    services: [
      { name: "Мужская стрижка", price: rub(2500), duration: 45 },
      { name: "Стрижка бороды", price: rub(1500), duration: 30 },
      { name: "Королевское бритьё", price: rub(2000), duration: 40 },
    ],
  },
  {
    slug: "beauty-salon",
    name: "Studio Bella",
    description: "Салон красоты полного цикла.",
    address: "ул. Арбат, 24",
    rating: "4.9",
    cover: "💇",
    masters: ["Анна", "Мария"],
    services: [
      { name: "Женская стрижка", price: rub(4000), duration: 60 },
      { name: "Окрашивание", price: rub(8000), duration: 120 },
      { name: "Укладка", price: rub(3000), duration: 45 },
    ],
  },
  {
    slug: "massage",
    name: "Relax Massage",
    description: "Массаж и телесные практики.",
    address: "Кутузовский пр-т, 5",
    rating: "4.7",
    cover: "💆",
    masters: ["Елена"],
    services: [
      { name: "Классический массаж", price: rub(5000), duration: 60 },
      { name: "Спортивный массаж", price: rub(6000), duration: 60 },
      { name: "Расслабляющий массаж", price: rub(5500), duration: 90 },
    ],
  },
  {
    slug: "spa",
    name: "Aqua SPA",
    description: "SPA-комплекс с хаммамом и бассейном.",
    address: "Ленинский пр-т, 40",
    rating: "4.9",
    cover: "🧖",
    masters: [],
    services: [
      { name: "SPA-программа «Оазис»", price: rub(12000), duration: 120 },
      { name: "Хаммам", price: rub(7000), duration: 60 },
    ],
  },
  {
    slug: "manicure",
    name: "Nail Bar",
    description: "Маникюр и педикюр премиум-класса.",
    address: "ул. Пятницкая, 8",
    rating: "4.8",
    cover: "💅",
    masters: ["Ольга", "Полина"],
    services: [
      { name: "Маникюр", price: rub(3500), duration: 60 },
      { name: "Педикюр", price: rub(4500), duration: 75 },
      { name: "Наращивание ногтей", price: rub(6000), duration: 120 },
    ],
  },
  {
    slug: "cosmetology",
    name: "Skin Care Clinic",
    description: "Косметология и уход за кожей.",
    address: "Проспект Мира, 33",
    rating: "4.6",
    cover: "✨",
    masters: ["Наталья"],
    services: [
      { name: "Чистка лица", price: rub(6000), duration: 90 },
      { name: "Химический пилинг", price: rub(5000), duration: 60 },
    ],
  },
  {
    slug: "fitness",
    name: "PowerFit",
    description: "Персональные тренировки и групповые занятия.",
    address: "ул. Новослободская, 16",
    rating: "4.7",
    cover: "🏋️",
    masters: ["Артём"],
    services: [
      { name: "Персональная тренировка", price: rub(4000), duration: 60 },
      { name: "Йога", price: rub(2500), duration: 60 },
    ],
  },
  {
    slug: "barbershop",
    name: "City Barbershop",
    description: "Быстрые мужские стрижки без записи заранее.",
    address: "ул. Маросейка, 3",
    rating: "4.5",
    cover: "💈",
    masters: ["Сергей"],
    services: [
      { name: "Мужская стрижка", price: rub(2000), duration: 40 },
      { name: "Камуфляж седины", price: rub(3000), duration: 50 },
    ],
  },
];

async function main() {
  // Wipe prior demo data (cascades to hours/services/masters).
  await db.delete(vendors).where(like(vendors.externalId, "demo-%"));

  const cats = await db.select().from(categories);
  const catId = new Map(cats.map((c) => [c.slug, c.id]));

  for (let i = 0; i < DEMO.length; i++) {
    const d = DEMO[i];
    const priceFrom = Math.min(...d.services.map((s) => s.price));

    const [vendor] = await db
      .insert(vendors)
      .values({
        categoryId: catId.get(d.slug),
        name: d.name,
        description: d.description,
        address: d.address,
        latitude: BASE_LAT + i * 0.008,
        longitude: BASE_LNG + i * 0.006,
        coverUrl: d.cover,
        ratingAvg: d.rating,
        ratingCount: 10 + i * 7,
        priceFrom,
        externalId: `demo-${i + 1}`,
      })
      .returning({ id: vendors.id });

    // Open every day 10:00–20:00.
    await db.insert(vendorWorkingHours).values(
      Array.from({ length: 7 }, (_, weekday) => ({
        vendorId: vendor.id,
        weekday,
        opensAt: "10:00:00",
        closesAt: "20:00:00",
      })),
    );

    const insertedServices = await db
      .insert(services)
      .values(
        d.services.map((s) => ({
          vendorId: vendor.id,
          categoryId: catId.get(d.slug),
          name: s.name,
          price: s.price,
          durationMinutes: s.duration,
        })),
      )
      .returning({ id: services.id });

    if (d.masters.length > 0) {
      const insertedMasters = await db
        .insert(masters)
        .values(d.masters.map((name) => ({ vendorId: vendor.id, name })))
        .returning({ id: masters.id });

      // Every master performs every service of the vendor (demo simplification).
      await db.insert(masterServices).values(
        insertedMasters.flatMap((m) =>
          insertedServices.map((s) => ({ masterId: m.id, serviceId: s.id })),
        ),
      );
    }
  }

  console.log(`✅ Seeded ${DEMO.length} demo vendors with services, hours & masters`);
}

await main();
