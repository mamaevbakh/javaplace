// Minimal typings for the Telegram Mini App SDK injected by telegram-web-app.js.
interface TelegramContactRequestedResponse {
  status: "sent" | "cancelled"
  responseUnsafe?: {
    contact?: {
      phone_number?: string
      first_name?: string
      last_name?: string
      user_id?: number
    }
  }
}

interface TelegramWebApp {
  initData: string
  ready: () => void
  expand: () => void
  colorScheme?: "light" | "dark"
  version?: string
  // Bot API 6.9+: prompts the user to share their phone with the bot.
  requestContact?: (
    callback?: (shared: boolean, response?: TelegramContactRequestedResponse) => void,
  ) => void
  // Native haptics — makes chip taps / confirmation feel like an app, not a webview.
  HapticFeedback?: {
    impactOccurred?: (style: "light" | "medium" | "heavy" | "rigid" | "soft") => void
    notificationOccurred?: (type: "error" | "success" | "warning") => void
    selectionChanged?: () => void
  }
}

interface Window {
  Telegram?: {
    WebApp?: TelegramWebApp
  }
}
