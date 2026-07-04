/**
 * Computes bookable start times for a given date from a vendor's working
 * hours and the service duration. Times are wall-clock "HH:MM" strings.
 *
 * NOTE: v1 does not yet subtract already-booked ranges or handle vendor
 * timezones — that arrives with the confirm step + CRM/availability sync.
 */
export type WorkingHour = { weekday: number; opensAt: string; closesAt: string }

function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number)
  return h * 60 + m
}

function fromMinutes(mins: number): string {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
}

export function computeSlots(
  date: Date,
  hours: WorkingHour[],
  durationMinutes: number,
  stepMinutes = 30,
): string[] {
  const weekday = date.getDay()
  const slots: string[] = []

  for (const h of hours.filter((x) => x.weekday === weekday)) {
    const open = toMinutes(h.opensAt)
    const close = toMinutes(h.closesAt)
    for (let t = open; t + durationMinutes <= close; t += stepMinutes) {
      slots.push(fromMinutes(t))
    }
  }

  return slots
}
