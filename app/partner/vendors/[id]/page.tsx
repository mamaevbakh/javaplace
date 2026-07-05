import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { ChevronLeft, ExternalLink } from "lucide-react"

import { getCategories, getMerchantVendor } from "@/db/queries"
import { getCurrentMerchant } from "@/lib/merchant-auth"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { DeleteVendorButton } from "@/components/partner/partner-buttons"
import { HoursEditor } from "@/components/partner/hours-editor"
import { MastersManager } from "@/components/partner/masters-manager"
import { PhotosManager } from "@/components/partner/photos-manager"
import { ServicesManager } from "@/components/partner/services-manager"
import { VendorForm } from "@/components/partner/vendor-form"

// Auth-gated + dynamic (reads the merchant cookie): opt out of prerender/instant validation.
export const instant = false

export default async function EditVendorPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const merchant = await getCurrentMerchant()
  if (!merchant) redirect("/partner/login")

  const { id } = await params
  const [vendor, categories] = await Promise.all([
    getMerchantVendor(merchant.id, id),
    getCategories(),
  ])
  if (!vendor) notFound()

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col gap-5 px-4 pt-3 pb-10">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Button
            variant="ghost"
            size="icon-sm"
            nativeButton={false}
            render={<Link href="/partner" />}
          >
            <ChevronLeft />
          </Button>
          <h1 className="truncate font-heading text-lg font-semibold">{vendor.name}</h1>
        </div>
        <Button
          variant="ghost"
          size="sm"
          nativeButton={false}
          render={<a href={`/vendor/${vendor.id}`} target="_blank" rel="noreferrer" />}
        >
          <ExternalLink data-icon="inline-start" />
          В приложении
        </Button>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium">Профиль</h2>
        <VendorForm
          categories={categories}
          initial={{
            id: vendor.id,
            name: vendor.name,
            categoryId: vendor.categoryId,
            description: vendor.description,
            address: vendor.address,
            phone: vendor.phone,
            coverUrl: vendor.coverUrl,
            latitude: vendor.latitude,
            longitude: vendor.longitude,
            timezone: vendor.timezone,
          }}
        />
      </section>

      <Separator />

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium">Фото</h2>
        <PhotosManager vendorId={vendor.id} photos={vendor.photos} />
      </section>

      <Separator />

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium">Услуги</h2>
        <ServicesManager vendorId={vendor.id} services={vendor.services} />
      </section>

      <Separator />

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium">Мастера</h2>
        <MastersManager vendorId={vendor.id} masters={vendor.masters} />
      </section>

      <Separator />

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium">Часы работы</h2>
        <HoursEditor vendorId={vendor.id} hours={vendor.workingHours} />
      </section>

      <Separator />
      <DeleteVendorButton vendorId={vendor.id} />
    </main>
  )
}
