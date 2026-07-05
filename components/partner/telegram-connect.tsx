"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Bell, BellOff } from "lucide-react"

import { disconnectTelegramAction, getTelegramConnectLink } from "@/app/partner/actions"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

export function TelegramConnect({ connected }: { connected: boolean }) {
  const router = useRouter()
  const [pending, startTransition] = React.useTransition()
  const [error, setError] = React.useState<string | null>(null)

  function connect() {
    setError(null)
    startTransition(async () => {
      const res = await getTelegramConnectLink()
      if (res.ok) {
        window.open(res.url, "_blank", "noopener")
      } else {
        setError(
          res.error === "not_configured"
            ? "Бот не настроен."
            : "Не удалось создать ссылку. Попробуйте позже.",
        )
      }
    })
  }

  function disconnect() {
    startTransition(async () => {
      await disconnectTelegramAction()
      router.refresh()
    })
  }

  return (
    <Card size="sm">
      <CardContent className="flex items-center gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
          {connected ? <Bell className="size-5" /> : <BellOff className="size-5" />}
        </div>
        <div className="flex min-w-0 flex-col">
          <span className="font-medium">Telegram-уведомления</span>
          <span className="truncate text-sm text-muted-foreground">
            {connected
              ? "Новые заявки приходят в Telegram"
              : "Получайте новые заявки в Telegram"}
          </span>
          {error ? <span className="text-xs text-destructive">{error}</span> : null}
        </div>
        {connected ? (
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto"
            disabled={pending}
            onClick={disconnect}
          >
            Отключить
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="ml-auto"
            disabled={pending}
            onClick={connect}
          >
            Подключить
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
