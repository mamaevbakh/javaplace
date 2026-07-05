/**
 * Pooled (WebSocket) Neon client for the *write* paths that need real
 * interactive transactions — specifically the booking insert, which reads
 * overlapping bookings and conditionally inserts under SERIALIZABLE isolation
 * to prevent two clients from grabbing the same slot.
 *
 * The rest of the app uses the HTTP driver (`@/db`), which is great for
 * one-shot queries but cannot hold a read-then-write transaction open.
 *
 * Node 22+ / Vercel Fluid expose a global `WebSocket`, so no `ws` dep is needed.
 */
import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import * as schema from "./schema";

if (!neonConfig.webSocketConstructor && typeof WebSocket !== "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  neonConfig.webSocketConstructor = WebSocket as any;
}

let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set — add it to your .env file.");
    pool = new Pool({ connectionString: url });
  }
  return pool;
}

/** Drizzle client backed by the WebSocket pool. Supports `.transaction(...)`. */
export const poolDb = drizzle(getPool(), { schema });
