/** Formatting helpers for money, duration, and working hours (ru-RU). */

// Prices are stored as integer minor units (value × 100). Uzbek som (сум) has no
// practical minor unit, so we divide back out and label in сум.
export function formatPrice(minorUnits: number | null): string | null {
  if (minorUnits == null) return null
  return `${Math.round(minorUnits / 100).toLocaleString("ru-RU")} сум`
}

export function formatPriceFrom(minorUnits: number | null): string | null {
  const price = formatPrice(minorUnits)
  return price ? `от ${price}` : null
}

/** Formats an absolute instant in a given IANA timezone (ru-RU, e.g. for the vendor's zone). */
export function formatDateTimeInTz(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone,
    weekday: "short",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} мин`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest === 0 ? `${hours} ч` : `${hours} ч ${rest} мин`
}

// Russian week order (Mon..Sun); Date.getDay() is 0=Sun.
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0]
const WEEKDAY_SHORT = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"]

type WorkingHour = { weekday: number; opensAt: string; closesAt: string }

/** Collapses per-day hours into ranges, e.g. [{ label: "Пн–Вс", time: "10:00–20:00" }]. */
export function formatWorkingHours(
  hours: WorkingHour[],
): { label: string; time: string }[] {
  const byDay = new Map(hours.map((h) => [h.weekday, h]))
  const ordered = WEEK_ORDER.filter((d) => byDay.has(d))
  const rows: { label: string; time: string }[] = []

  let i = 0
  while (i < ordered.length) {
    const first = byDay.get(ordered[i])!
    const time = `${first.opensAt.slice(0, 5)}–${first.closesAt.slice(0, 5)}`

    let j = i
    while (j + 1 < ordered.length) {
      const next = byDay.get(ordered[j + 1])!
      if (next.opensAt === first.opensAt && next.closesAt === first.closesAt) j++
      else break
    }

    const label =
      i === j
        ? WEEKDAY_SHORT[ordered[i]]
        : `${WEEKDAY_SHORT[ordered[i]]}–${WEEKDAY_SHORT[ordered[j]]}`
    rows.push({ label, time })
    i = j + 1
  }

  return rows
}
