import Link from "next/link"
import { redirect } from "next/navigation"
import { ChevronLeft } from "lucide-react"

import { getMerchantBookings } from "@/db/queries"
import { getCurrentMerchant } from "@/lib/merchant-auth"
import { Button } from "@/components/ui/button"
import { BookingsInbox } from "@/components/partner/bookings-inbox"

// Auth-gated + dynamic (reads the merchant cookie): opt out of prerender/instant validation.
export const instant = false

export default async function PartnerBookingsPage() {
  const merchant = await getCurrentMerchant()
  if (!merchant) redirect("/partner/login")

  const bookings = await getMerchantBookings(merchant.id)

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col gap-5 px-4 pt-3 pb-10">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon-sm"
          nativeButton={false}
          render={<Link href="/partner" />}
        >
          <ChevronLeft />
        </Button>
        <h1 className="font-heading text-lg font-semibold">Записи</h1>
      </div>

      <BookingsInbox bookings={bookings} />
    </main>
  )
}
