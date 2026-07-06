/**
 * Best-effort Telegram haptics. No-ops outside Telegram (or if the SDK is old),
 * so callers never need to guard. Makes chip taps and confirmation feel native
 * inside the Mini App.
 */
export function hapticSelect(): void {
  if (typeof window === "undefined") return
  try {
    window.Telegram?.WebApp?.HapticFeedback?.selectionChanged?.()
  } catch {
    // ignore — haptics are a nicety, never a failure
  }
}

export function hapticImpact(
  style: "light" | "medium" | "heavy" | "rigid" | "soft" = "light",
): void {
  if (typeof window === "undefined") return
  try {
    window.Telegram?.WebApp?.HapticFeedback?.impactOccurred?.(style)
  } catch {
    // ignore
  }
}

export function hapticNotify(type: "success" | "error" | "warning"): void {
  if (typeof window === "undefined") return
  try {
    window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred?.(type)
  } catch {
    // ignore
  }
}
