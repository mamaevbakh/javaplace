import { db, merchants } from "@/db"
import { eq } from "drizzle-orm"
import { verifyMerchantLinkToken } from "@/lib/link-token"
import {
  answerCallbackQuery,
  editMessageText,
  isBotConfigured,
  sendMessage,
  type InlineKeyboard,
} from "@/lib/telegram-api"

type TelegramUpdate = {
  message?: { chat: { id: number }; text?: string }
  callback_query?: {
    id: string
    data?: string
    from?: { id: number }
    message?: { chat?: { id: number }; message_id?: number }
  }
}

/** Links the Telegram chat that pressed Start to a merchant, if the token is valid. */
async function tryLinkMerchant(chatId: number, startPayload: string): Promise<boolean> {
  const merchantId = verifyMerchantLinkToken(startPayload)
  if (!merchantId) return false
  const [updated] = await db
    .update(merchants)
    .set({ telegramChatId: chatId, updatedAt: new Date() })
    .where(eq(merchants.id, merchantId))
    .returning({ id: merchants.id })
  if (!updated) return false
  await sendMessage(
    chatId,
    "✅ <b>Уведомления подключены</b>\n\nТеперь вы будете получать сюда новые заявки на бронь. Отключить можно в портале партнёра.",
  )
  return true
}

function isAdminChat(id: number | undefined): boolean {
  const admin = process.env.ADMIN_TELEGRAM_CHAT_ID
  return Boolean(admin && id != null && String(id) === admin)
}

/** Handles the admin's Approve/Reject taps on a new-merchant signup. */
async function handleMerchantModeration(
  cq: NonNullable<TelegramUpdate["callback_query"]>,
): Promise<void> {
  const match = /^merch_(approve|reject)_(.+)$/.exec(cq.data ?? "")
  if (!match) return
  // Only the configured admin may moderate.
  if (!isAdminChat(cq.from?.id) && !isAdminChat(cq.message?.chat?.id)) {
    await answerCallbackQuery(cq.id, "Недостаточно прав")
    return
  }

  const [, action, merchantId] = match
  const status = action === "approve" ? "approved" : "rejected"
  const [updated] = await db
    .update(merchants)
    .set({ status, updatedAt: new Date() })
    .where(eq(merchants.id, merchantId))
    .returning({
      name: merchants.name,
      email: merchants.email,
      telegramChatId: merchants.telegramChatId,
    })

  if (!updated) {
    await answerCallbackQuery(cq.id, "Партнёр не найден")
    return
  }
  await answerCallbackQuery(cq.id, action === "approve" ? "Одобрено ✅" : "Отклонено ❌")

  // Reflect the decision on the admin message (drops the buttons).
  const chatId = cq.message?.chat?.id
  if (chatId && cq.message?.message_id) {
    const label = action === "approve" ? "✅ Одобрено" : "❌ Отклонено"
    await editMessageText(
      chatId,
      cq.message.message_id,
      `${label}\n\n${updated.name ?? updated.email}`,
    )
  }

  // If the merchant has connected Telegram, tell them the outcome.
  if (updated.telegramChatId) {
    const msg =
      action === "approve"
        ? "✅ <b>Ваш аккаунт одобрен!</b>\n\nПрофили теперь видны в приложении."
        : "❌ <b>Заявка отклонена</b>\n\nЕсли это ошибка, напишите в поддержку: support@javaplace.app"
    try {
      await sendMessage(updated.telegramChatId, msg)
    } catch (error) {
      console.error("[moderation] merchant notify failed:", error)
    }
  }
}

const WELCOME =
  "Найдите и забронируйте услугу рядом с вами: барбершоп, салон красоты, массаж, SPA и другие сервисы.\n\nНажмите кнопку ниже, чтобы открыть каталог."
const HELP =
  "<b>Как это работает</b>\n\n1. Откройте Mini App\n2. Выберите категорию и партнёра\n3. Выберите услугу, дату и время\n4. Подтвердите бронь\n\nКоманды:\n/menu — главное меню\n/bookings — мои записи\n/support — поддержка"
const SUPPORT =
  "Нужна помощь? Напишите нам — мы на связи и поможем с бронью.\n\n✉️ support@javaplace.app"

function mainMenu(appUrl: string): InlineKeyboard {
  return {
    inline_keyboard: [
      [{ text: "🚀 Открыть Mini App", web_app: { url: appUrl } }],
      [
        { text: "📅 Мои записи", web_app: { url: `${appUrl}/bookings` } },
        { text: "🆘 Поддержка", callback_data: "support" },
      ],
    ],
  }
}

function appOrigin(req: Request): string {
  if (process.env.APP_URL) return process.env.APP_URL
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host")
  const proto = req.headers.get("x-forwarded-proto") ?? "https"
  return host ? `${proto}://${host}` : ""
}

async function handleUpdate(update: TelegramUpdate, appUrl: string): Promise<void> {
  if (update.message?.text) {
    const chatId = update.message.chat.id
    const parts = update.message.text.trim().split(/\s+/)
    const command = parts[0].replace(/@.*$/, "")
    const startPayload = parts[1]

    switch (command) {
      case "/start":
        // Deep link from the portal to connect merchant notifications.
        if (startPayload && (await tryLinkMerchant(chatId, startPayload))) break
        await sendMessage(chatId, WELCOME, mainMenu(appUrl))
        break
      case "/menu":
        await sendMessage(chatId, WELCOME, mainMenu(appUrl))
        break
      case "/bookings":
        await sendMessage(chatId, "Ваши записи:", {
          inline_keyboard: [
            [{ text: "📅 Открыть мои записи", web_app: { url: `${appUrl}/bookings` } }],
          ],
        })
        break
      case "/help":
        await sendMessage(chatId, HELP)
        break
      case "/id":
        // Helper for setting ADMIN_TELEGRAM_CHAT_ID during setup.
        await sendMessage(chatId, `Ваш chat id: <code>${chatId}</code>`)
        break
      case "/support":
        await sendMessage(chatId, SUPPORT)
        break
      default:
        await sendMessage(chatId, "Не понимаю команду. Откройте меню: /menu")
    }
    return
  }

  if (update.callback_query) {
    const cq = update.callback_query
    if (cq.data?.startsWith("merch_")) {
      await handleMerchantModeration(cq)
      return
    }
    await answerCallbackQuery(cq.id)
    const chatId = cq.message?.chat?.id
    if (!chatId) return
    if (cq.data === "support") await sendMessage(chatId, SUPPORT)
  }
}

export async function POST(req: Request) {
  if (!isBotConfigured()) {
    return new Response("bot not configured", { status: 503 })
  }

  const secret = req.headers.get("x-telegram-bot-api-secret-token")
  if (
    !process.env.TELEGRAM_WEBHOOK_SECRET ||
    secret !== process.env.TELEGRAM_WEBHOOK_SECRET
  ) {
    return new Response("forbidden", { status: 401 })
  }

  let update: TelegramUpdate
  try {
    update = (await req.json()) as TelegramUpdate
  } catch {
    return new Response("bad request", { status: 400 })
  }

  try {
    await handleUpdate(update, appOrigin(req))
  } catch (error) {
    // Never make Telegram retry on our internal errors.
    console.error("[telegram webhook] handler error:", error)
  }

  return Response.json({ ok: true })
}
