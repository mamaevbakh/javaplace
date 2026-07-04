"use client"

import * as React from "react"

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
  React.useEffect(() => {
    const webApp = window.Telegram?.WebApp
    webApp?.ready()
    webApp?.expand()
    void authenticate(getInitData())
  }, [])

  return null
}
