import crypto from "node:crypto"
import { cookies } from "next/headers"

const COOKIE_NAME = "mp_session"
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30 // 30 days

function secret(): string {
  const value = process.env.AUTH_SECRET
  if (!value) throw new Error("AUTH_SECRET is not set — add it to your .env file.")
  return value
}

function sign(value: string): string {
  const mac = crypto.createHmac("sha256", secret()).update(value).digest("base64url")
  return `${value}.${mac}`
}

function unsign(signed: string): string | null {
  const dot = signed.lastIndexOf(".")
  if (dot <= 0) return null
  const value = signed.slice(0, dot)
  const mac = signed.slice(dot + 1)
  const expected = crypto.createHmac("sha256", secret()).update(value).digest("base64url")
  const macBuf = Buffer.from(mac)
  const expectedBuf = Buffer.from(expected)
  if (macBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(macBuf, expectedBuf)) {
    return null
  }
  return value
}

export async function setSessionUserId(userId: string): Promise<void> {
  const jar = await cookies()
  jar.set(COOKIE_NAME, sign(userId), {
    httpOnly: true,
    // Telegram Mini Apps render in a cross-site iframe on desktop → SameSite=None.
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  })
}

export async function getSessionUserId(): Promise<string | null> {
  const jar = await cookies()
  const raw = jar.get(COOKIE_NAME)?.value
  return raw ? unsign(raw) : null
}
