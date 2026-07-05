import crypto from "node:crypto"

import { db, merchants } from "@/db"
import {
  clearMerchantSession,
  getMerchantSession,
  setMerchantSession,
} from "./session"
import { clientIp, rateLimit } from "./rate-limit"
import { isBotConfigured, sendMessage } from "./telegram-api"

/** Pings the admin chat with Approve/Reject buttons for a new signup. Best-effort. */
async function notifyAdminNewMerchant(
  id: string,
  email: string,
  name: string | null,
): Promise<void> {
  const adminChat = process.env.ADMIN_TELEGRAM_CHAT_ID
  if (!adminChat || !isBotConfigured()) return
  try {
    await sendMessage(
      adminChat,
      [
        "🆕 <b>Новая заявка партнёра</b>",
        "",
        name ? `<b>${name}</b>` : null,
        `✉️ ${email}`,
        "",
        "Одобрить доступ к публикации в приложении?",
      ]
        .filter(Boolean)
        .join("\n"),
      {
        inline_keyboard: [
          [
            { text: "✅ Одобрить", callback_data: `merch_approve_${id}` },
            { text: "❌ Отклонить", callback_data: `merch_reject_${id}` },
          ],
        ],
      },
    )
  } catch (error) {
    console.error("[merchant register] admin notify failed:", error)
  }
}

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
  | { ok: false; error: "exists" | "invalid" | "weak" | "rate_limited" }

export async function registerMerchant(
  email: string,
  password: string,
  name: string,
): Promise<MerchantAuthResult> {
  const normalized = email.trim().toLowerCase()
  // Cap signups per IP so spam registrations can't flood the admin review queue.
  const ip = await clientIp()
  if (!(await rateLimit(`register-ip:${ip}`, 5, 3600)).ok) {
    return { ok: false, error: "rate_limited" }
  }
  if (password.length < 8) return { ok: false, error: "weak" }

  const existing = await db.query.merchants.findFirst({
    where: (m, { eq }) => eq(m.email, normalized),
  })
  if (existing) return { ok: false, error: "exists" }

  const cleanName = name.trim() || null
  const [merchant] = await db
    .insert(merchants)
    .values({
      email: normalized,
      passwordHash: hashPassword(password),
      name: cleanName,
      status: "pending", // awaits admin approval before vendors go public
    })
    .returning({ id: merchants.id })

  // Let the new merchant in to prepare their profile; nothing is public yet.
  await setMerchantSession(merchant.id)
  await notifyAdminNewMerchant(merchant.id, normalized, cleanName)
  return { ok: true }
}

export async function loginMerchant(
  email: string,
  password: string,
): Promise<MerchantAuthResult> {
  const normalized = email.trim().toLowerCase()
  // Throttle brute force: per IP (broad) and per account (targeted).
  const ip = await clientIp()
  if (!(await rateLimit(`login-ip:${ip}`, 10, 600)).ok) {
    return { ok: false, error: "rate_limited" }
  }
  if (!(await rateLimit(`login-email:${normalized}`, 5, 600)).ok) {
    return { ok: false, error: "rate_limited" }
  }
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
