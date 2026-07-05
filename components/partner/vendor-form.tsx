"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import type { Category } from "@/db/queries"
import {
  DEFAULT_TIMEZONE,
  TIMEZONE_OPTIONS,
  type VendorInput,
} from "@/lib/partner-types"
import { createVendorAction, updateVendorAction } from "@/app/partner/actions"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

type VendorInitial = {
  id: string
  name: string
  categoryId: string | null
  description: string | null
  address: string | null
  phone: string | null
  coverUrl: string | null
  latitude: number | null
  longitude: number | null
  timezone: string | null
}

export function VendorForm({
  categories,
  initial,
}: {
  categories: Category[]
  initial?: VendorInitial
}) {
  const router = useRouter()
  const [pending, startTransition] = React.useTransition()
  const [error, setError] = React.useState<string | null>(null)
  const editing = Boolean(initial)

  const [name, setName] = React.useState(initial?.name ?? "")
  const [categoryId, setCategoryId] = React.useState(initial?.categoryId ?? "")
  const [description, setDescription] = React.useState(initial?.description ?? "")
  const [address, setAddress] = React.useState(initial?.address ?? "")
  const [phone, setPhone] = React.useState(initial?.phone ?? "")
  const [coverUrl, setCoverUrl] = React.useState(initial?.coverUrl ?? "")
  const [lat, setLat] = React.useState(initial?.latitude != null ? String(initial.latitude) : "")
  const [lng, setLng] = React.useState(initial?.longitude != null ? String(initial.longitude) : "")
  const [timezone, setTimezone] = React.useState(initial?.timezone ?? DEFAULT_TIMEZONE)

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!name.trim()) {
      setError("Укажите название.")
      return
    }
    setError(null)
    const input: VendorInput = {
      name,
      categoryId: categoryId || null,
      description,
      address,
      phone,
      coverUrl,
      latitude: lat.trim() ? Number(lat) : null,
      longitude: lng.trim() ? Number(lng) : null,
      timezone,
      isActive: true,
    }
    startTransition(async () => {
      if (editing && initial) {
        const res = await updateVendorAction(initial.id, input)
        if (res.ok) router.refresh()
        else setError("Не удалось сохранить.")
      } else {
        const res = await createVendorAction(input)
        if (res.ok && res.vendorId) router.push(`/partner/vendors/${res.vendorId}`)
        else setError("Не удалось создать профиль.")
      }
    })
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="v-name">Название</FieldLabel>
          <Input id="v-name" value={name} onChange={(e) => setName(e.target.value)} required />
        </Field>
        <Field>
          <FieldLabel>Категория</FieldLabel>
          <Select
            value={categoryId || null}
            onValueChange={(value) => setCategoryId((value as string) ?? "")}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Выберите категорию" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  {category.icon} {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel htmlFor="v-desc">Описание</FieldLabel>
          <Textarea
            id="v-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="v-addr">Адрес</FieldLabel>
          <Input id="v-addr" value={address} onChange={(e) => setAddress(e.target.value)} />
        </Field>
        <Field>
          <FieldLabel htmlFor="v-phone">Телефон</FieldLabel>
          <Input id="v-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </Field>
        <Field>
          <FieldLabel htmlFor="v-cover">Обложка (эмодзи)</FieldLabel>
          <Input
            id="v-cover"
            value={coverUrl}
            onChange={(e) => setCoverUrl(e.target.value)}
            placeholder="💈"
          />
          <FieldDescription>Пока используем эмодзи как обложку.</FieldDescription>
        </Field>
        <div className="flex gap-3">
          <Field className="flex-1">
            <FieldLabel htmlFor="v-lat">Широта</FieldLabel>
            <Input id="v-lat" value={lat} onChange={(e) => setLat(e.target.value)} placeholder="55.7558" inputMode="decimal" />
          </Field>
          <Field className="flex-1">
            <FieldLabel htmlFor="v-lng">Долгота</FieldLabel>
            <Input id="v-lng" value={lng} onChange={(e) => setLng(e.target.value)} placeholder="37.6173" inputMode="decimal" />
          </Field>
        </div>
        <Field>
          <FieldLabel>Часовой пояс</FieldLabel>
          <Select
            value={timezone}
            onValueChange={(value) => setTimezone((value as string) ?? DEFAULT_TIMEZONE)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Выберите часовой пояс" />
            </SelectTrigger>
            <SelectContent>
              {TIMEZONE_OPTIONS.map((tz) => (
                <SelectItem key={tz.value} value={tz.value}>
                  {tz.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldDescription>
            Время и свободные слоты показываются в этом поясе.
          </FieldDescription>
        </Field>
      </FieldGroup>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Button type="submit" disabled={pending}>
        {pending ? "Сохраняем…" : editing ? "Сохранить" : "Создать профиль"}
      </Button>
    </form>
  )
}
