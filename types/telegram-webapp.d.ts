// Minimal typings for the Telegram Mini App SDK injected by telegram-web-app.js.
interface TelegramWebApp {
  initData: string
  ready: () => void
  expand: () => void
  colorScheme?: "light" | "dark"
}

interface Window {
  Telegram?: {
    WebApp?: TelegramWebApp
  }
}
