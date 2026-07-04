"use client"

import * as React from "react"
import { LogOut, Trash2 } from "lucide-react"

import { deleteVendorAction, logoutAction } from "@/app/partner/actions"
import { Button } from "@/components/ui/button"

export function LogoutButton() {
  const [pending, startTransition] = React.useTransition()
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() => startTransition(() => logoutAction())}
    >
      <LogOut data-icon="inline-start" />
      Выйти
    </Button>
  )
}

export function DeleteVendorButton({ vendorId }: { vendorId: string }) {
  const [pending, startTransition] = React.useTransition()
  const [confirming, setConfirming] = React.useState(false)

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm">Удалить профиль и все услуги?</span>
        <Button
          variant="destructive"
          size="sm"
          disabled={pending}
          className="ml-auto"
          onClick={() => startTransition(() => deleteVendorAction(vendorId))}
        >
          Да, удалить
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
          Нет
        </Button>
      </div>
    )
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className="self-start text-destructive"
      onClick={() => setConfirming(true)}
    >
      <Trash2 data-icon="inline-start" />
      Удалить профиль
    </Button>
  )
}
