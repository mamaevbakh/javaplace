import { redirect } from "next/navigation"

import { getCurrentMerchant } from "@/lib/merchant-auth"
import { AuthForm } from "@/components/partner/auth-form"

export default async function PartnerRegisterPage() {
  if (await getCurrentMerchant()) redirect("/partner")

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-sm flex-col justify-center gap-6 px-4 py-10">
      <div className="flex flex-col gap-1 text-center">
        <h1 className="font-heading text-2xl font-semibold">Регистрация партнёра</h1>
        <p className="text-sm text-muted-foreground">
          Создайте аккаунт, добавьте бизнес и услуги
        </p>
      </div>
      <AuthForm mode="register" />
    </main>
  )
}
