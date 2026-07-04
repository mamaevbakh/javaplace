"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import type { MerchantVendorDetail } from "@/db/queries"
import type { WorkingHoursInput } from "@/lib/partner-types"
import { updateWorkingHoursAction } from "@/app/partner/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type HourRow = MerchantVendorDetail["workingHours"][number]

// Monday-first display order; Date.getDay() uses 0 = Sunday.
const DAYS = [
  { weekday: 1, label: "Понедельник" },
  { weekday: 2, label: "Вторник" },
  { weekday: 3, label: "Среда" },
  { weekday: 4, label: "Четверг" },
  { weekday: 5, label: "Пятница" },
  { weekday: 6, label: "Суббота" },
  { weekday: 0, label: "Воскресенье" },
]

type Row = { weekday: number; label: string; open: boolean; opensAt: string; closesAt: string }

export function HoursEditor({
  vendorId,
  hours,
}: {
  vendorId: string
  hours: HourRow[]
}) {
  const router = useRouter()
  const [pending, startTransition] = React.useTransition()
  const [saved, setSaved] = React.useState(false)

  const initial = React.useMemo<Row[]>(() => {
    const byDay = new Map(hours.map((h) => [h.weekday, h]))
    return DAYS.map((d) => {
      const h = byDay.get(d.weekday)
      return {
        weekday: d.weekday,
        label: d.label,
        open: Boolean(h),
        opensAt: h ? h.opensAt.slice(0, 5) : "10:00",
        closesAt: h ? h.closesAt.slice(0, 5) : "20:00",
      }
    })
  }, [hours])

  const [rows, setRows] = React.useState<Row[]>(initial)

  function patch(weekday: number, partial: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.weekday === weekday ? { ...r, ...partial } : r)))
    setSaved(false)
  }

  function save() {
    const payload: WorkingHoursInput = rows
      .filter((r) => r.open)
      .map((r) => ({
        weekday: r.weekday,
        opensAt: `${r.opensAt}:00`,
        closesAt: `${r.closesAt}:00`,
      }))
    startTransition(async () => {
      await updateWorkingHoursAction(vendorId, payload)
      setSaved(true)
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-2">
      {rows.map((row) => (
        <div key={row.weekday} className="flex items-center gap-3">
          <label className="flex w-32 shrink-0 items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={row.open}
              onChange={(e) => patch(row.weekday, { open: e.target.checked })}
              className="size-4 accent-primary"
            />
            {row.label}
          </label>
          {row.open ? (
            <div className="flex items-center gap-2">
              <Input
                type="time"
                value={row.opensAt}
                onChange={(e) => patch(row.weekday, { opensAt: e.target.value })}
                className="w-28"
              />
              <span className="text-muted-foreground">–</span>
              <Input
                type="time"
                value={row.closesAt}
                onChange={(e) => patch(row.weekday, { closesAt: e.target.value })}
                className="w-28"
              />
            </div>
          ) : (
            <span className="text-sm text-muted-foreground">Выходной</span>
          )}
        </div>
      ))}

      <div className="mt-2 flex items-center gap-3">
        <Button size="sm" onClick={save} disabled={pending}>
          {pending ? "Сохраняем…" : "Сохранить часы"}
        </Button>
        {saved ? <span className="text-sm text-muted-foreground">Сохранено ✓</span> : null}
      </div>
    </div>
  )
}
