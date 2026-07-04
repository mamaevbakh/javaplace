export type VendorInput = {
  name: string
  categoryId: string | null
  description: string
  address: string
  phone: string
  latitude: number | null
  longitude: number | null
  coverUrl: string
  isActive: boolean
}

export type ServiceInput = {
  name: string
  priceRub: number
  durationMinutes: number
  description: string
  gender: "male" | "female" | "unisex"
}

export type MasterInput = {
  name: string
  bio: string
  photoUrl: string
}

export type WorkingHoursInput = {
  weekday: number
  opensAt: string
  closesAt: string
}[]
