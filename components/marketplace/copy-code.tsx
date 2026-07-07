"use client"

import * as React from "react"
import { Check, Copy } from "lucide-react"

import { copyText } from "@/lib/clipboard"
import { hapticImpact } from "@/lib/haptics"
import { cn } from "@/lib/utils"

/**
 * A booking reference rendered as a tappable, monospaced pill. Tap to copy the
 * short code — useful when a customer needs to quote it to the salon for support.
 */
export function CopyCode({ id, className }: { id: string; className?: string }) {
  const [copied, setCopied] = React.useState(false)
  const short = `#${id.slice(0, 8).toUpperCase()}`

  function handleCopy() {
    // Show feedback immediately on tap — detecting success is unreliable across
    // webviews (clipboard API needs a user gesture; execCommand varies), so we
    // give the confirmation and copy best-effort rather than risk a silent no-op.
    hapticImpact("light")
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
    void copyText(short)
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={copied ? "Скопировано" : `Скопировать номер брони ${short}`}
      className={cn(
        "inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 font-mono text-xs text-foreground transition-colors active:bg-muted/70",
        className,
      )}
    >
      {short}
      {copied ? (
        <Check className="size-3 text-emerald-500" />
      ) : (
        <Copy className="size-3 text-muted-foreground" />
      )}
    </button>
  )
}
