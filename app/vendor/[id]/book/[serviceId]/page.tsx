import { notFound } from "next/navigation"
import { connection } from "next/server"

import { getServiceBookingContext, getUserBooking } from "@/db/queries"
import { getCurrentUser } from "@/lib/auth"
import { formatDateTimeInTz } from "@/lib/format"
import { BookingFlow } from "@/components/marketplace/booking-flow"

// Reads the session cookie + is highly interactive: keep dynamic, opt out of prerender/instant validation.
export const instant = false

export default async function BookPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; serviceId: string }>
  searchParams: Promise<{ reschedule?: string }>
}) {
  await connection()
  const { id, serviceId } = await params
  const { reschedule: rescheduleId } = await searchParams
  const [ctx, user] = await Promise.all([
    getServiceBookingContext(id, serviceId),
    getCurrentUser(),
  ])
  if (!ctx) notFound()

  // When rescheduling, surface the booking being moved (old time + its master)
  // so the user has context and doesn't silently change master.
  let reschedule: { whenText: string; masterId: string | null } | undefined
  if (rescheduleId && user) {
    const original = await getUserBooking(rescheduleId, user.id)
    if (original) {
      reschedule = {
        whenText: formatDateTimeInTz(original.startsAt, original.vendor.timezone),
        masterId: original.masterId,
      }
    }
  }

  return (
    <BookingFlow
      vendor={ctx.vendor}
      service={ctx.service}
      rescheduleId={rescheduleId}
      reschedule={reschedule}
      initialPhone={user?.phone ?? undefined}
    />
  )
}
