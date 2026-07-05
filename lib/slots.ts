/**
 * Slot availability engine.
 *
 * Working hours are wall-clock "HH:MM" strings interpreted in the *vendor's*
 * timezone. Bookings are stored as absolute instants (timestamptz). To decide
 * whether a wall-clock slot is free we convert it to an absolute instant in the
 * vendor's zone and compare against existing bookings' absolute ranges.
 *
 * Capacity / "any master" model
 * -----------------------------
 *   capacity = max(1, activeMasterCount)      // a 0-master vendor is one resource
 *   occupying = bookings (pending|confirmed) whose range overlaps the candidate
 *
 *   - specific master M  → busy if any occupying booking is assigned to M,
 *                          OR occupying.length >= capacity (whole shop full)
 *   - any master (null)  → busy if occupying.length >= capacity
 *
 * This always errs toward *blocking*, never toward double-booking: an "any"
 * booking (master_id = null) is counted against capacity but can't be pinned to
 * a specific master, so a specific-master request may occasionally be refused
 * when it could in theory have fit. Assigning a concrete master at booking time
 * would remove that slack — noted as a future refinement.
 */
export type WorkingHour = { weekday: number; opensAt: string; closesAt: string }

/** An occupied time range from an existing booking. */
export type BookedRange = { startsAt: Date; endsAt: Date; masterId: string | null }

function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number)
  return h * 60 + m
}

function fromMinutes(mins: number): string {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
}

/**
 * Offset (ms) of `timeZone` from UTC at the given absolute instant.
 * Positive east of UTC. Uses Intl so it honours DST automatically.
 */
function tzOffsetMs(timeZone: string, at: Date): number {
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
  const parts = dtf.formatToParts(at)
  const map: Record<string, number> = {}
  for (const p of parts) if (p.type !== "literal") map[p.type] = Number(p.value)
  const asUTC = Date.UTC(map.year, map.month - 1, map.day, map.hour, map.minute, map.second)
  return asUTC - at.getTime()
}

/**
 * Converts a wall-clock date+time in `timeZone` to the absolute UTC instant.
 * Two-pass so it stays correct across DST transitions.
 */
export function zonedTimeToUtc(dateStr: string, timeStr: string, timeZone: string): Date {
  const [y, mo, d] = dateStr.split("-").map(Number)
  const [h, mi] = timeStr.split(":").map(Number)
  const utcGuess = Date.UTC(y, mo - 1, d, h, mi, 0)
  const offset1 = tzOffsetMs(timeZone, new Date(utcGuess))
  const offset2 = tzOffsetMs(timeZone, new Date(utcGuess - offset1))
  return new Date(utcGuess - offset2)
}

/** Weekday (0=Sun..6=Sat) for a "YYYY-MM-DD" calendar day, independent of any zone. */
export function weekdayOf(dateStr: string): number {
  const [y, mo, d] = dateStr.split("-").map(Number)
  return new Date(Date.UTC(y, mo - 1, d, 12, 0, 0)).getUTCDay()
}

/** Half-open interval overlap: [aStart,aEnd) ∩ [bStart,bEnd) ≠ ∅. */
function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd
}

/**
 * Is the absolute range [start,end) bookable for the given master, given the
 * existing bookings and the vendor's capacity? See capacity model above.
 */
export function isRangeAvailable(
  start: Date,
  end: Date,
  booked: BookedRange[],
  masterId: string | null,
  capacity: number,
): boolean {
  const s = start.getTime()
  const e = end.getTime()
  let occupying = 0
  for (const b of booked) {
    if (!overlaps(s, e, b.startsAt.getTime(), b.endsAt.getTime())) continue
    // A specific master can never share their own slot.
    if (masterId && b.masterId === masterId) return false
    occupying++
  }
  return occupying < Math.max(1, capacity)
}

export type ComputeSlotsParams = {
  dateStr: string // "YYYY-MM-DD" — vendor-local calendar day
  timezone: string // IANA
  hours: WorkingHour[]
  durationMinutes: number
  booked?: BookedRange[]
  masterId?: string | null // selected master; null/undefined = any master
  masterCount?: number // active masters (0 → capacity 1)
  now?: Date // instants at/before this are hidden (default: real now)
  stepMinutes?: number
}

/**
 * Bookable start times ("HH:MM", vendor-local) for a date: within working hours,
 * not in the past, and not already taken given existing bookings + capacity.
 */
export function computeAvailableSlots(params: ComputeSlotsParams): string[] {
  const {
    dateStr,
    timezone,
    hours,
    durationMinutes,
    booked = [],
    masterId = null,
    masterCount = 0,
    now = new Date(),
    stepMinutes = 30,
  } = params

  const weekday = weekdayOf(dateStr)
  const capacity = Math.max(1, masterCount)
  const nowMs = now.getTime()
  const slots: string[] = []

  for (const h of hours.filter((x) => x.weekday === weekday)) {
    const open = toMinutes(h.opensAt)
    const close = toMinutes(h.closesAt)
    for (let t = open; t + durationMinutes <= close; t += stepMinutes) {
      const wall = fromMinutes(t)
      const start = zonedTimeToUtc(dateStr, wall, timezone)
      if (start.getTime() <= nowMs) continue // no booking in the past
      const end = new Date(start.getTime() + durationMinutes * 60_000)
      if (isRangeAvailable(start, end, booked, masterId, capacity)) slots.push(wall)
    }
  }

  return slots
}
