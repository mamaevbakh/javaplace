import Link from "next/link"
import { CalendarX2, ChevronLeft, Send } from "lucide-react"

import { getUserBookings } from "@/db/queries"
import { getCurrentUser } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { BookingsList } from "@/components/marketplace/bookings-list"

export default async function BookingsPage() {
  const user = await getCurrentUser()
  const bookings = user ? await getUserBookings(user.id) : []

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col gap-4 px-4 pt-3 pb-10">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon-sm"
          nativeButton={false}
          render={<Link href="/" />}
        >
          <ChevronLeft />
        </Button>
        <h1 className="font-heading text-lg font-semibold">Мои записи</h1>
      </div>

      {!user ? (
        <Empty className="mt-6">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Send />
            </EmptyMedia>
            <EmptyTitle>Войдите через Telegram</EmptyTitle>
            <EmptyDescription>
              Откройте приложение из бота @java_mvp_bot, чтобы видеть свои записи.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : bookings.length === 0 ? (
        <Empty className="mt-6">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <CalendarX2 />
            </EmptyMedia>
            <EmptyTitle>Пока нет записей</EmptyTitle>
            <EmptyDescription>
              Выберите услугу и забронируйте удобное время.
            </EmptyDescription>
          </EmptyHeader>
          <Button render={<Link href="/" />}>Найти услугу</Button>
        </Empty>
      ) : (
        <BookingsList bookings={bookings} />
      )}
    </main>
  )
}
