import { notFound } from "next/navigation"
import { connection } from "next/server"

import { getServiceBookingContext } from "@/db/queries"
import { BookingFlow } from "@/components/marketplace/booking-flow"

export default async function BookPage({
  params,
}: {
  params: Promise<{ id: string; serviceId: string }>
}) {
  await connection()
  const { id, serviceId } = await params
  const ctx = await getServiceBookingContext(id, serviceId)
  if (!ctx) notFound()

  return <BookingFlow vendor={ctx.vendor} service={ctx.service} />
}
