"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import { authenticate } from "@/app/actions"

/** Reads Telegram initData on the client (empty string outside Telegram). */
export function getInitData(): string {
  if (typeof window === "undefined") return ""
  return window.Telegram?.WebApp?.initData ?? ""
}

/**
 * Runs once on app open: signals readiness to Telegram, expands the viewport,
 * and establishes a session (real Telegram user, or demo fallback in dev).
 * Renders nothing.
 */
export function TelegramInit() {
  const router = useRouter()

  React.useEffect(() => {
    const webApp = window.Telegram?.WebApp
    webApp?.ready()
    webApp?.expand()
    // Establish the session, then re-render server components so pages that
    // read the session (e.g. /bookings) reflect the signed-in user.
    authenticate(getInitData()).then((user) => {
      if (user) router.refresh()
    })
  }, [router])

  return null
}
