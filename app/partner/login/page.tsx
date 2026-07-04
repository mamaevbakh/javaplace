import { redirect } from "next/navigation"

import { getCurrentMerchant } from "@/lib/merchant-auth"
import { AuthForm } from "@/components/partner/auth-form"

export default async function PartnerLoginPage() {
  if (await getCurrentMerchant()) redirect("/partner")

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-sm flex-col justify-center gap-6 px-4 py-10">
      <div className="flex flex-col gap-1 text-center">
        <h1 className="font-heading text-2xl font-semibold">Кабинет партнёра</h1>
        <p className="text-sm text-muted-foreground">
          Войдите, чтобы управлять профилем и услугами
        </p>
      </div>
      <AuthForm mode="login" />
    </main>
  )
}
