"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Pencil, Plus, Trash2 } from "lucide-react"

import type { MerchantVendorDetail } from "@/db/queries"
import type { MasterInput } from "@/lib/partner-types"
import {
  createMasterAction,
  deleteMasterAction,
  updateMasterAction,
} from "@/app/partner/actions"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

type MasterRow = MerchantVendorDetail["masters"][number]

export function MastersManager({
  vendorId,
  masters,
}: {
  vendorId: string
  masters: MasterRow[]
}) {
  const [editing, setEditing] = React.useState<string | "new" | null>(null)

  return (
    <div className="flex flex-col gap-3">
      {masters.length === 0 && editing !== "new" ? (
        <p className="text-sm text-muted-foreground">
          Пока нет мастеров. Клиент увидит «Любой мастер».
        </p>
      ) : null}

      {masters.map((master) =>
        editing === master.id ? (
          <MasterForm
            key={master.id}
            vendorId={vendorId}
            master={master}
            onDone={() => setEditing(null)}
          />
        ) : (
          <MasterRowView
            key={master.id}
            master={master}
            onEdit={() => setEditing(master.id)}
          />
        ),
      )}

      {editing === "new" ? (
        <MasterForm vendorId={vendorId} onDone={() => setEditing(null)} />
      ) : (
        <Button variant="outline" onClick={() => setEditing("new")}>
          <Plus data-icon="inline-start" />
          Добавить мастера
        </Button>
      )}
    </div>
  )
}

function MasterRowView({
  master,
  onEdit,
}: {
  master: MasterRow
  onEdit: () => void
}) {
  const router = useRouter()
  const [pending, startTransition] = React.useTransition()
  const [confirming, setConfirming] = React.useState(false)

  function remove() {
    startTransition(async () => {
      await deleteMasterAction(master.id)
      router.refresh()
    })
  }

  return (
    <Card size="sm">
      <CardContent className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar>
            <AvatarFallback>{master.photoUrl || master.name.slice(0, 1)}</AvatarFallback>
          </Avatar>
          <div className="flex min-w-0 flex-col">
            <span className="truncate font-medium">{master.name}</span>
            {master.bio ? (
              <span className="truncate text-sm text-muted-foreground">{master.bio}</span>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {confirming ? (
            <>
              <Button variant="destructive" size="sm" disabled={pending} onClick={remove}>
                Удалить
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
                Нет
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" size="icon-sm" onClick={onEdit} aria-label="Изменить">
                <Pencil />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setConfirming(true)}
                aria-label="Удалить"
              >
                <Trash2 />
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function MasterForm({
  vendorId,
  master,
  onDone,
}: {
  vendorId: string
  master?: MasterRow
  onDone: () => void
}) {
  const router = useRouter()
  const [pending, startTransition] = React.useTransition()
  const [error, setError] = React.useState<string | null>(null)

  const [name, setName] = React.useState(master?.name ?? "")
  const [photoUrl, setPhotoUrl] = React.useState(master?.photoUrl ?? "")
  const [bio, setBio] = React.useState(master?.bio ?? "")

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!name.trim()) return setError("Укажите имя.")
    setError(null)
    const input: MasterInput = { name, photoUrl, bio }
    startTransition(async () => {
      const res = master
        ? await updateMasterAction(master.id, input)
        : await createMasterAction(vendorId, input)
      if (res.ok) {
        router.refresh()
        onDone()
      } else {
        setError("Не удалось сохранить.")
      }
    })
  }

  return (
    <Card size="sm">
      <CardContent>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <FieldGroup>
            <div className="flex gap-3">
              <Field className="w-20">
                <FieldLabel htmlFor="m-photo">Эмодзи</FieldLabel>
                <Input
                  id="m-photo"
                  value={photoUrl}
                  onChange={(e) => setPhotoUrl(e.target.value)}
                  placeholder="🧑‍🔧"
                />
              </Field>
              <Field className="flex-1">
                <FieldLabel htmlFor="m-name">Имя</FieldLabel>
                <Input id="m-name" value={name} onChange={(e) => setName(e.target.value)} required />
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="m-bio">О мастере</FieldLabel>
              <Textarea
                id="m-bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={2}
              />
            </Field>
          </FieldGroup>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? "Сохраняем…" : "Сохранить"}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={onDone}>
              Отмена
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
