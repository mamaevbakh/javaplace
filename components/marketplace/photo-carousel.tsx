"use client"

import Image from "next/image"

import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel"

const SIZES = "(max-width: 448px) 100vw, 448px"

export function PhotoCarousel({
  photos,
  alt,
}: {
  photos: { id: string; url: string }[]
  alt: string
}) {
  if (photos.length === 1) {
    return (
      <div className="relative aspect-video overflow-hidden rounded-xl bg-muted">
        <Image src={photos[0].url} alt={alt} fill sizes={SIZES} className="object-cover" priority />
      </div>
    )
  }

  return (
    <Carousel className="w-full">
      <CarouselContent>
        {photos.map((photo, index) => (
          <CarouselItem key={photo.id}>
            <div className="relative aspect-video overflow-hidden rounded-xl bg-muted">
              <Image
                src={photo.url}
                alt={alt}
                fill
                sizes={SIZES}
                className="object-cover"
                priority={index === 0}
              />
            </div>
          </CarouselItem>
        ))}
      </CarouselContent>
      <CarouselPrevious className="left-2" />
      <CarouselNext className="right-2" />
    </Carousel>
  )
}
