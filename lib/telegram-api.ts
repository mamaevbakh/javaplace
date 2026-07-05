/** Thin client for the Telegram Bot API (used by the webhook + notifications). */

const BASE = "https://api.telegram.org"

function token(): string {
  const value = process.env.TELEGRAM_BOT_TOKEN
  if (!value) throw new Error("TELEGRAM_BOT_TOKEN is not set.")
  return value
}

export function isBotConfigured(): boolean {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN)
}

async function call<T = unknown>(method: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}/bot${token()}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = (await res.json()) as { ok: boolean; result?: T; description?: string }
  if (!json.ok) throw new Error(`Telegram ${method} failed: ${json.description}`)
  return json.result as T
}

export type InlineButton = {
  text: string
  web_app?: { url: string }
  callback_data?: string
  url?: string
}
export type InlineKeyboard = { inline_keyboard: InlineButton[][] }

export function sendMessage(
  chatId: number | string,
  text: string,
  replyMarkup?: InlineKeyboard,
) {
  return call("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    link_preview_options: { is_disabled: true },
    reply_markup: replyMarkup,
  })
}

export function answerCallbackQuery(callbackQueryId: string, text?: string) {
  return call("answerCallbackQuery", { callback_query_id: callbackQueryId, text })
}

export function editMessageText(
  chatId: number | string,
  messageId: number,
  text: string,
) {
  return call("editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: "HTML",
    link_preview_options: { is_disabled: true },
  })
}

export function getMe() {
  return call<{ id: number; username?: string; first_name: string }>("getMe")
}

export function setWebhook(url: string, secretToken: string) {
  return call("setWebhook", {
    url,
    secret_token: secretToken,
    allowed_updates: ["message", "callback_query"],
  })
}

export function setChatMenuButton(webAppUrl: string) {
  return call("setChatMenuButton", {
    menu_button: { type: "web_app", text: "Услуги", web_app: { url: webAppUrl } },
  })
}

export function setMyCommands(commands: { command: string; description: string }[]) {
  return call("setMyCommands", { commands })
}
