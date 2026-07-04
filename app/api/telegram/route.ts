import {
  answerCallbackQuery,
  isBotConfigured,
  sendMessage,
  type InlineKeyboard,
} from "@/lib/telegram-api"

type TelegramUpdate = {
  message?: { chat: { id: number }; text?: string }
  callback_query?: {
    id: string
    data?: string
    message?: { chat?: { id: number } }
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
    const command = update.message.text.trim().split(/\s+/)[0].replace(/@.*$/, "")

    switch (command) {
      case "/start":
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
