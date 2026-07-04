import Link from "next/link"
import { redirect } from "next/navigation"
import { ChevronLeft } from "lucide-react"

import { getCategories } from "@/db/queries"
import { getCurrentMerchant } from "@/lib/merchant-auth"
import { Button } from "@/components/ui/button"
import { VendorForm } from "@/components/partner/vendor-form"

export default async function NewVendorPage() {
  const merchant = await getCurrentMerchant()
  if (!merchant) redirect("/partner/login")

  const categories = await getCategories()

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col gap-4 px-4 pt-3 pb-10">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon-sm"
          nativeButton={false}
          render={<Link href="/partner" />}
        >
          <ChevronLeft />
        </Button>
        <h1 className="font-heading text-lg font-semibold">Новый профиль</h1>
      </div>
      <VendorForm categories={categories} />
    </main>
  )
}
