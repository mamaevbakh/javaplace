import crypto from "node:crypto"

import { db, merchants } from "@/db"
import {
  clearMerchantSession,
  getMerchantSession,
  setMerchantSession,
} from "./session"

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex")
  const hash = crypto.scryptSync(password, salt, 64).toString("hex")
  return `${salt}:${hash}`
}

function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":")
  if (!salt || !hash) return false
  const computed = crypto.scryptSync(password, salt, 64)
  const hashBuf = Buffer.from(hash, "hex")
  return (
    hashBuf.length === computed.length && crypto.timingSafeEqual(hashBuf, computed)
  )
}

export type MerchantAuthResult =
  | { ok: true }
  | { ok: false; error: "exists" | "invalid" | "weak" }

export async function registerMerchant(
  email: string,
  password: string,
  name: string,
): Promise<MerchantAuthResult> {
  const normalized = email.trim().toLowerCase()
  if (password.length < 8) return { ok: false, error: "weak" }

  const existing = await db.query.merchants.findFirst({
    where: (m, { eq }) => eq(m.email, normalized),
  })
  if (existing) return { ok: false, error: "exists" }

  const [merchant] = await db
    .insert(merchants)
    .values({ email: normalized, passwordHash: hashPassword(password), name: name.trim() || null })
    .returning({ id: merchants.id })

  await setMerchantSession(merchant.id)
  return { ok: true }
}

export async function loginMerchant(
  email: string,
  password: string,
): Promise<MerchantAuthResult> {
  const normalized = email.trim().toLowerCase()
  const merchant = await db.query.merchants.findFirst({
    where: (m, { eq }) => eq(m.email, normalized),
  })
  if (!merchant || !verifyPassword(password, merchant.passwordHash)) {
    return { ok: false, error: "invalid" }
  }
  await setMerchantSession(merchant.id)
  return { ok: true }
}

export async function logoutMerchant(): Promise<void> {
  await clearMerchantSession()
}

/** The signed-in merchant for the current request, or null. */
export async function getCurrentMerchant() {
  const id = await getMerchantSession()
  if (!id) return null
  const merchant = await db.query.merchants.findFirst({
    where: (m, { eq }) => eq(m.id, id),
  })
  return merchant ?? null
}
