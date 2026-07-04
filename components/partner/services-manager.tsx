"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Pencil, Plus, Trash2 } from "lucide-react"

import type { MerchantVendorDetail } from "@/db/queries"
import type { ServiceInput } from "@/lib/partner-types"
import {
  createServiceAction,
  deleteServiceAction,
  updateServiceAction,
} from "@/app/partner/actions"
import { formatDuration, formatPrice } from "@/lib/format"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

type ServiceRow = MerchantVendorDetail["services"][number]

const GENDERS: { value: ServiceInput["gender"]; label: string }[] = [
  { value: "unisex", label: "Унисекс" },
  { value: "male", label: "Мужская" },
  { value: "female", label: "Женская" },
]
const GENDER_LABEL = Object.fromEntries(GENDERS.map((g) => [g.value, g.label]))

export function ServicesManager({
  vendorId,
  services,
}: {
  vendorId: string
  services: ServiceRow[]
}) {
  const [editing, setEditing] = React.useState<string | "new" | null>(null)

  return (
    <div className="flex flex-col gap-3">
      {services.length === 0 && editing !== "new" ? (
        <p className="text-sm text-muted-foreground">Пока нет услуг. Добавьте первую.</p>
      ) : null}

      {services.map((service) =>
        editing === service.id ? (
          <ServiceForm
            key={service.id}
            vendorId={vendorId}
            service={service}
            onDone={() => setEditing(null)}
          />
        ) : (
          <ServiceRowView
            key={service.id}
            service={service}
            onEdit={() => setEditing(service.id)}
          />
        ),
      )}

      {editing === "new" ? (
        <ServiceForm vendorId={vendorId} onDone={() => setEditing(null)} />
      ) : (
        <Button variant="outline" onClick={() => setEditing("new")}>
          <Plus data-icon="inline-start" />
          Добавить услугу
        </Button>
      )}
    </div>
  )
}

function ServiceRowView({
  service,
  onEdit,
}: {
  service: ServiceRow
  onEdit: () => void
}) {
  const router = useRouter()
  const [pending, startTransition] = React.useTransition()
  const [confirming, setConfirming] = React.useState(false)

  function remove() {
    startTransition(async () => {
      await deleteServiceAction(service.id)
      router.refresh()
    })
  }

  return (
    <Card size="sm">
      <CardContent className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="font-medium">{service.name}</span>
            <Badge variant="secondary">{GENDER_LABEL[service.gender]}</Badge>
          </div>
          <span className="text-sm text-muted-foreground">
            {formatPrice(service.price)} · {formatDuration(service.durationMinutes)}
          </span>
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

function ServiceForm({
  vendorId,
  service,
  onDone,
}: {
  vendorId: string
  service?: ServiceRow
  onDone: () => void
}) {
  const router = useRouter()
  const [pending, startTransition] = React.useTransition()
  const [error, setError] = React.useState<string | null>(null)

  const [name, setName] = React.useState(service?.name ?? "")
  const [price, setPrice] = React.useState(
    service ? String(Math.round(service.price / 100)) : "",
  )
  const [duration, setDuration] = React.useState(
    service ? String(service.durationMinutes) : "",
  )
  const [gender, setGender] = React.useState<ServiceInput["gender"]>(
    service?.gender ?? "unisex",
  )
  const [description, setDescription] = React.useState(service?.description ?? "")

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const priceRub = Number(price)
    const durationMinutes = Number(duration)
    if (!name.trim()) return setError("Укажите название.")
    if (!Number.isFinite(priceRub) || priceRub < 0) return setError("Некорректная цена.")
    if (!Number.isFinite(durationMinutes) || durationMinutes <= 0)
      return setError("Некорректная длительность.")
    setError(null)

    const input: ServiceInput = { name, priceRub, durationMinutes, gender, description }
    startTransition(async () => {
      const res = service
        ? await updateServiceAction(service.id, input)
        : await createServiceAction(vendorId, input)
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
            <Field>
              <FieldLabel htmlFor="s-name">Название</FieldLabel>
              <Input id="s-name" value={name} onChange={(e) => setName(e.target.value)} required />
            </Field>
            <div className="flex gap-3">
              <Field className="flex-1">
                <FieldLabel htmlFor="s-price">Цена, ₽</FieldLabel>
                <Input
                  id="s-price"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  inputMode="numeric"
                  placeholder="2500"
                />
              </Field>
              <Field className="flex-1">
                <FieldLabel htmlFor="s-dur">Длит., мин</FieldLabel>
                <Input
                  id="s-dur"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  inputMode="numeric"
                  placeholder="45"
                />
              </Field>
            </div>
            <Field>
              <FieldLabel>Пол</FieldLabel>
              <Select
                value={gender}
                onValueChange={(value) => setGender(value as ServiceInput["gender"])}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GENDERS.map((g) => (
                    <SelectItem key={g.value} value={g.value}>
                      {g.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="s-desc">Описание</FieldLabel>
              <Textarea
                id="s-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
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
