/**
 * DB-backed fixed-window rate limiter. One atomic upsert per check, so it works
 * correctly across serverless instances (shared Postgres) without Redis.
 *
 * A window starts on the first hit for a key and lasts `windowSec`; within it,
 * `count` increments and requests are allowed while `count <= limit`. After the
 * window elapses the next hit resets it. Fail-open: a limiter error must never
 * take down login/booking.
 */
import { sql } from "drizzle-orm"
import { headers } from "next/headers"

import { db, rateLimits } from "@/db"

export type RateLimitResult = { ok: boolean; retryAfterSec: number }

export async function rateLimit(
  key: string,
  limit: number,
  windowSec: number,
): Promise<RateLimitResult> {
  try {
    const [row] = await db
      .insert(rateLimits)
      .values({
        key,
        count: 1,
        resetAt: sql`now() + make_interval(secs => ${windowSec})`,
      })
      .onConflictDoUpdate({
        target: rateLimits.key,
        set: {
          count: sql`case when ${rateLimits.resetAt} < now() then 1 else ${rateLimits.count} + 1 end`,
          resetAt: sql`case when ${rateLimits.resetAt} < now() then now() + make_interval(secs => ${windowSec}) else ${rateLimits.resetAt} end`,
        },
      })
      .returning({ count: rateLimits.count, resetAt: rateLimits.resetAt })

    const retryAfterSec = Math.max(
      0,
      Math.ceil((row.resetAt.getTime() - Date.now()) / 1000),
    )
    return { ok: row.count <= limit, retryAfterSec }
  } catch (error) {
    console.error("[rate-limit] check failed (allowing):", error)
    return { ok: true, retryAfterSec: 0 }
  }
}

/** Best-effort client IP from proxy headers (Vercel sets x-forwarded-for). */
export async function clientIp(): Promise<string> {
  const h = await headers()
  const fwd = h.get("x-forwarded-for")
  return fwd?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown"
}
