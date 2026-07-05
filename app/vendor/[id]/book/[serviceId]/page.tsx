import { notFound } from "next/navigation"
import { connection } from "next/server"

import { getServiceBookingContext } from "@/db/queries"
import { getCurrentUser } from "@/lib/auth"
import { BookingFlow } from "@/components/marketplace/booking-flow"

export default async function BookPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; serviceId: string }>
  searchParams: Promise<{ reschedule?: string }>
}) {
  await connection()
  const { id, serviceId } = await params
  const { reschedule } = await searchParams
  const [ctx, user] = await Promise.all([
    getServiceBookingContext(id, serviceId),
    getCurrentUser(),
  ])
  if (!ctx) notFound()

  return (
    <BookingFlow
      vendor={ctx.vendor}
      service={ctx.service}
      rescheduleId={reschedule}
      initialPhone={user?.phone ?? undefined}
    />
  )
}
