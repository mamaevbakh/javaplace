import Link from "next/link"
import { redirect } from "next/navigation"
import { CalendarClock, ChevronRight, Plus, Store } from "lucide-react"

import { getMerchantPendingCount, getMerchantVendors } from "@/db/queries"
import { getCurrentMerchant } from "@/lib/merchant-auth"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty"
import { LogoutButton } from "@/components/partner/partner-buttons"
import { TelegramConnect } from "@/components/partner/telegram-connect"

// Auth-gated + dynamic (reads the merchant cookie): opt out of prerender/instant validation.
export const instant = false

export default async function PartnerDashboard() {
  const merchant = await getCurrentMerchant()
  if (!merchant) redirect("/partner/login")

  const [vendors, pendingCount] = await Promise.all([
    getMerchantVendors(merchant.id),
    getMerchantPendingCount(merchant.id),
  ])

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col gap-4 px-4 pt-4 pb-10">
      <header className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col">
          <h1 className="font-heading text-xl font-semibold">Мои профили</h1>
          <p className="truncate text-sm text-muted-foreground">
            {merchant.name ?? merchant.email}
          </p>
        </div>
        <LogoutButton />
      </header>

      {merchant.status !== "approved" ? (
        <div
          className={`rounded-lg border p-3 text-sm ${
            merchant.status === "rejected"
              ? "border-destructive/30 bg-destructive/10 text-destructive"
              : "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400"
          }`}
        >
          {merchant.status === "rejected" ? (
            <>
              <p className="font-medium">Заявка отклонена</p>
              <p>
                Профили не показываются в приложении. Если это ошибка — напишите в
                поддержку: support@javaplace.app
              </p>
            </>
          ) : (
            <>
              <p className="font-medium">Аккаунт на модерации</p>
              <p>
                Профили появятся в приложении после одобрения. Пока можно всё
                подготовить: услуги, мастера, часы работы и фото.
              </p>
            </>
          )}
        </div>
      ) : null}

      <Link href="/partner/bookings" className="block">
        <Card size="sm" className="transition-shadow hover:ring-foreground/20">
          <CardContent className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
              <CalendarClock className="size-5" />
            </div>
            <div className="flex min-w-0 flex-col">
              <span className="font-medium">Записи</span>
              <span className="truncate text-sm text-muted-foreground">
                {pendingCount > 0
                  ? `${pendingCount} новых заявок ждут ответа`
                  : "Входящие брони клиентов"}
              </span>
            </div>
            {pendingCount > 0 ? (
              <Badge className="ml-auto">{pendingCount}</Badge>
            ) : (
              <ChevronRight className="ml-auto size-4 text-muted-foreground" />
            )}
          </CardContent>
        </Card>
      </Link>

      <TelegramConnect connected={merchant.telegramChatId != null} />

      <Button nativeButton={false} render={<Link href="/partner/vendors/new" />}>
        <Plus data-icon="inline-start" />
        Создать профиль
      </Button>

      {vendors.length === 0 ? (
        <Empty className="mt-6">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Store />
            </EmptyMedia>
            <EmptyTitle>Пока нет профилей</EmptyTitle>
            <EmptyDescription>
              Создайте профиль бизнеса — он сразу появится в приложении.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="flex flex-col gap-3">
          {vendors.map((vendor) => (
            <Link key={vendor.id} href={`/partner/vendors/${vendor.id}`} className="block">
              <Card size="sm" className="transition-shadow hover:ring-foreground/20">
                <CardContent className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-2xl">
                      {vendor.coverUrl ?? "🏬"}
                    </div>
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate font-medium">{vendor.name}</span>
                      <span className="truncate text-sm text-muted-foreground">
                        {vendor.category?.name ?? "Без категории"} · {vendor.services.length} усл.
                      </span>
                    </div>
                  </div>
                  {vendor.isActive ? null : <Badge variant="outline">Скрыт</Badge>}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </main>
  )
}
