/**
 * Minimal client-side iCalendar (.ics) generation for a confirmed booking, so a
 * customer can add the appointment to their calendar from the success screen —
 * the cheapest per-booking no-show reducer there is.
 */

/**
 * Convert a wall-clock date/time in an IANA timezone to the absolute UTC instant.
 * Same offset trick as the server's slot engine, but self-contained so this stays
 * client-safe (no server-only imports pulled into the bundle).
 */
function zonedToUtc(dateStr: string, timeStr: string, timeZone: string): Date {
  const [y, mo, d] = dateStr.split("-").map(Number)
  const [h, mi] = timeStr.split(":").map(Number)
  const utcGuess = Date.UTC(y, mo - 1, d, h, mi)
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
  const parts: Record<string, string> = {}
  for (const p of dtf.formatToParts(new Date(utcGuess))) parts[p.type] = p.value
  const asShown = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  )
  return new Date(utcGuess - (asShown - utcGuess))
}

function toICalUtc(d: Date): string {
  return `${d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")}`
}

function esc(s: string): string {
  return s.replace(/([\\;,])/g, "\\$1").replace(/\n/g, "\\n")
}

export function downloadBookingIcs(input: {
  bookingId: string
  serviceName: string
  vendorName: string
  address?: string | null
  dateStr: string
  timeStr: string
  durationMinutes: number
  timeZone: string
}): void {
  if (typeof window === "undefined") return
  const start = zonedToUtc(input.dateStr, input.timeStr, input.timeZone)
  const end = new Date(start.getTime() + input.durationMinutes * 60_000)
  const stamp = new Date()

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//javaplace//booking//RU",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${input.bookingId}@javaplace`,
    `DTSTAMP:${toICalUtc(stamp)}`,
    `DTSTART:${toICalUtc(start)}`,
    `DTEND:${toICalUtc(end)}`,
    `SUMMARY:${esc(`${input.serviceName} — ${input.vendorName}`)}`,
    input.address ? `LOCATION:${esc(input.address)}` : null,
    `DESCRIPTION:${esc(`Запись в ${input.vendorName}. Бронь #${input.bookingId.slice(0, 8).toUpperCase()}`)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .filter(Boolean)
    .join("\r\n")

  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `javaplace-${input.bookingId.slice(0, 8)}.ics`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
