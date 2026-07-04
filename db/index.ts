import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error("DATABASE_URL is not set — add it to your .env file.");
}

const sql = neon(DATABASE_URL);

// Canonical DB client for the app. Import as: `import { db } from "@/db"`.
export const db = drizzle(sql, { schema });

export * from "./schema";
