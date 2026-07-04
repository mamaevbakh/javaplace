import crypto from "node:crypto"

export type TelegramUser = {
  id: number
  first_name?: string
  last_name?: string
  username?: string
  photo_url?: string
  language_code?: string
}

/**
 * Validates Telegram Mini App `initData` per the official algorithm and, if
 * valid, returns the embedded user. Returns null on any failure.
 *
 * secret_key = HMAC_SHA256(key="WebAppData", msg=bot_token)
 * hash       = HMAC_SHA256(key=secret_key,  msg=data_check_string)
 */
export function validateInitData(
  initData: string,
  botToken: string,
  maxAgeSeconds = 86_400,
): TelegramUser | null {
  if (!initData || !botToken) return null

  const params = new URLSearchParams(initData)
  const hash = params.get("hash")
  if (!hash) return null
  params.delete("hash")

  // Reject stale payloads (replay protection).
  const authDate = Number(params.get("auth_date"))
  if (Number.isFinite(authDate) && authDate > 0) {
    const ageSeconds = Math.floor(Date.now() / 1000) - authDate
    if (ageSeconds > maxAgeSeconds) return null
  }

  const dataCheckString = [...params.entries()]
    .map(([key, value]) => `${key}=${value}`)
    .sort()
    .join("\n")

  const secretKey = crypto
    .createHmac("sha256", "WebAppData")
    .update(botToken)
    .digest()
  const computed = crypto
    .createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex")

  const computedBuf = Buffer.from(computed, "hex")
  const hashBuf = Buffer.from(hash, "hex")
  if (
    computedBuf.length !== hashBuf.length ||
    !crypto.timingSafeEqual(computedBuf, hashBuf)
  ) {
    return null
  }

  const userRaw = params.get("user")
  if (!userRaw) return null
  try {
    return JSON.parse(userRaw) as TelegramUser
  } catch {
    return null
  }
}
