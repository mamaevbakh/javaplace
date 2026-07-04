"use client"

import * as React from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { upload } from "@vercel/blob/client"
import { ImagePlus, Trash2 } from "lucide-react"

import type { MerchantVendorDetail } from "@/db/queries"
import {
  addVendorPhotoAction,
  deleteVendorPhotoAction,
} from "@/app/partner/actions"
import { Button } from "@/components/ui/button"

type PhotoRow = MerchantVendorDetail["photos"][number]

export function PhotosManager({
  vendorId,
  photos,
}: {
  vendorId: string
  photos: PhotoRow[]
}) {
  const router = useRouter()
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  async function onFiles(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? [])
    if (files.length === 0) return
    setError(null)
    setUploading(true)
    try {
      for (const file of files) {
        const blob = await upload(file.name, file, {
          access: "public",
          handleUploadUrl: "/api/blob/upload",
        })
        await addVendorPhotoAction(vendorId, blob.url)
      }
      router.refresh()
    } catch {
      setError("Не удалось загрузить фото. Попробуйте ещё раз.")
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {photos.length > 0 ? (
        <div className="grid grid-cols-3 gap-2">
          {photos.map((photo) => (
            <PhotoThumb key={photo.id} photo={photo} />
          ))}
        </div>
      ) : null}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={onFiles}
      />
      <Button
        variant="outline"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
      >
        <ImagePlus data-icon="inline-start" />
        {uploading ? "Загружаем…" : "Загрузить фото"}
      </Button>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  )
}

function PhotoThumb({ photo }: { photo: PhotoRow }) {
  const router = useRouter()
  const [pending, startTransition] = React.useTransition()

  function remove() {
    startTransition(async () => {
      await deleteVendorPhotoAction(photo.id)
      router.refresh()
    })
  }

  return (
    <div className="relative aspect-square overflow-hidden rounded-lg bg-muted">
      <Image src={photo.url} alt="" fill sizes="120px" className="object-cover" />
      <Button
        variant="destructive"
        size="icon-sm"
        className="absolute top-1 right-1"
        disabled={pending}
        onClick={remove}
        aria-label="Удалить фото"
      >
        <Trash2 />
      </Button>
    </div>
  )
}
