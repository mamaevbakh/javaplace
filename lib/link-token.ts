/**
 * Compact, tamper-proof tokens for the merchant → Telegram connect deep link.
 * The merchant opens `t.me/<bot>?start=<token>`; the bot webhook verifies it and
 * links the chat that pressed Start. HMAC (AUTH_SECRET) prevents forging a token
 * for someone else's merchant id. It's a bearer capability, only ever shown in
 * the authenticated portal.
 */
import crypto from "node:crypto"

function secret(): string {
  const value = process.env.AUTH_SECRET
  if (!value) throw new Error("AUTH_SECRET is not set — add it to your .env file.")
  return value
}

function tag(merchantId: string): string {
  return crypto
    .createHmac("sha256", secret())
    .update(`merchant:${merchantId}`)
    .digest("hex")
    .slice(0, 16)
}

/** `m_<merchantId>_<hmac16>` — fits Telegram's 64-char start-param limit. */
export function merchantLinkToken(merchantId: string): string {
  return `m_${merchantId}_${tag(merchantId)}`
}

/** Returns the merchant id if the token is valid and untampered, else null. */
export function verifyMerchantLinkToken(token: string): string | null {
  if (!token.startsWith("m_")) return null
  const rest = token.slice(2)
  const sep = rest.lastIndexOf("_")
  if (sep <= 0) return null
  const merchantId = rest.slice(0, sep)
  const sig = rest.slice(sep + 1)
  const expected = tag(merchantId)
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null
  return merchantId
}
