/**
 * Applies pending migrations from ./drizzle to Neon over the HTTP driver
 * (the same driver the app uses at runtime), maintaining Drizzle's
 * __drizzle_migrations ledger. Run with: `npm run db:migrate`.
 */
import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error("DATABASE_URL is not set — add it to your .env file.");
}

const db = drizzle(neon(DATABASE_URL));

await migrate(db, { migrationsFolder: "./drizzle" });
console.log("✅ Migrations applied");
