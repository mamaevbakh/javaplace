import { db, users } from "@/db"
import { getSessionUserId, setSessionUserId } from "./session"
import { validateInitData, type TelegramUser } from "./telegram"

// Fixed identity used when demo auth is allowed and there's no real Telegram user.
const DEMO_TELEGRAM_USER: TelegramUser = {
  id: 1,
  first_name: "Demo",
  username: "demo_user",
  language_code: "ru",
}

function demoAllowed(): boolean {
  return (
    process.env.NODE_ENV !== "production" ||
    process.env.ALLOW_DEMO_AUTH === "true"
  )
}

async function upsertTelegramUser(tg: TelegramUser) {
  const [row] = await db
    .insert(users)
    .values({
      telegramId: tg.id,
      firstName: tg.first_name,
      lastName: tg.last_name,
      username: tg.username,
      photoUrl: tg.photo_url,
      languageCode: tg.language_code,
    })
    .onConflictDoUpdate({
      target: users.telegramId,
      set: {
        firstName: tg.first_name,
        lastName: tg.last_name,
        username: tg.username,
        photoUrl: tg.photo_url,
        languageCode: tg.language_code,
        updatedAt: new Date(),
      },
    })
    .returning()
  return row
}

/**
 * Resolves the current user from Telegram `initData` (or the demo fallback),
 * upserts them, and establishes a session cookie. Returns null when neither a
 * valid Telegram payload nor demo auth is available.
 */
export async function authenticate(initData: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  let tgUser = token ? validateInitData(initData, token) : null

  if (!tgUser) {
    if (!demoAllowed()) return null
    tgUser = DEMO_TELEGRAM_USER
  }

  const user = await upsertTelegramUser(tgUser)
  await setSessionUserId(user.id)
  return user
}

/** The signed-in user for the current request, or null. */
export async function getCurrentUser() {
  const id = await getSessionUserId()
  if (!id) return null
  const user = await db.query.users.findFirst({
    where: (u, { eq }) => eq(u.id, id),
  })
  return user ?? null
}
