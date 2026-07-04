"use server";

import { neon } from "@neondatabase/serverless";

// Read once at module load and fail fast with a clear message if it's missing.
// Assigning to a local const also narrows the type from `string | undefined` to
// `string`, which `neon()` requires under strict TypeScript.
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error("DATABASE_URL is not set — add it to your .env file.");
}

const sql = neon(DATABASE_URL);

export async function getData() {
  // Placeholder query that proves connectivity without assuming any schema.
  // Replace with your real query, e.g. sql`SELECT * FROM users`.
  const data = await sql`SELECT version()`;
  return data;
}
