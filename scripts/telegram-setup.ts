/**
 * Configures the bot with Telegram. Always sets the command list; when given an
 * app URL it also registers the webhook + Mini App menu button.
 *
 *   npm run bot:setup                         # commands only
 *   npm run bot:setup https://app.vercel.app  # + webhook + menu button
 */
import "dotenv/config"
import {
  setChatMenuButton,
  setMyCommands,
  setWebhook,
} from "../lib/telegram-api"

const COMMANDS = [
  { command: "start", description: "Запуск бота" },
  { command: "menu", description: "Главное меню" },
  { command: "bookings", description: "Мои записи" },
  { command: "help", description: "Помощь" },
  { command: "support", description: "Поддержка" },
]

const appUrl = process.argv[2] ?? process.env.APP_URL

await setMyCommands(COMMANDS)
console.log("✅ Commands set")

if (appUrl) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET
  if (!secret) {
    console.error("✗ TELEGRAM_WEBHOOK_SECRET is not set — cannot register webhook.")
    process.exit(1)
  }
  await setWebhook(`${appUrl}/api/telegram`, secret)
  await setChatMenuButton(appUrl)
  console.log(`✅ Webhook → ${appUrl}/api/telegram`)
  console.log(`✅ Menu button → ${appUrl}`)
} else {
  console.log("ℹ Pass an app URL to also set the webhook + Mini App menu button.")
}
