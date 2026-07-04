/**
 * Seeds reference data (service categories). Idempotent — safe to re-run.
 * Run with: `npm run db:seed`.
 */
import "dotenv/config";
import { db } from "./index";
import { categories } from "./schema";

const CATEGORIES = [
  { slug: "barbershop", name: "Барбершопы", icon: "💈", sortOrder: 1 },
  { slug: "beauty-salon", name: "Салоны красоты", icon: "💇", sortOrder: 2 },
  { slug: "massage", name: "Массаж", icon: "💆", sortOrder: 3 },
  { slug: "spa", name: "SPA", icon: "🧖", sortOrder: 4 },
  { slug: "manicure", name: "Маникюр", icon: "💅", sortOrder: 5 },
  { slug: "cosmetology", name: "Косметология", icon: "✨", sortOrder: 6 },
  { slug: "fitness", name: "Фитнес", icon: "🏋️", sortOrder: 7 },
  { slug: "other", name: "Другое", icon: "📦", sortOrder: 8 },
];

await db.insert(categories).values(CATEGORIES).onConflictDoNothing({ target: categories.slug });
console.log(`✅ Seeded ${CATEGORIES.length} categories`);
