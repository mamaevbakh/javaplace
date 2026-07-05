export type VendorInput = {
  name: string
  categoryId: string | null
  description: string
  address: string
  phone: string
  latitude: number | null
  longitude: number | null
  coverUrl: string
  timezone: string
  isActive: boolean
}

/** IANA timezones offered in the portal (CIS-focused). Value = IANA id. */
export const TIMEZONE_OPTIONS: { value: string; label: string }[] = [
  { value: "Asia/Tashkent", label: "Ташкент (UTC+5)" },
  { value: "Asia/Samarkand", label: "Самарканд (UTC+5)" },
  { value: "Asia/Almaty", label: "Алматы (UTC+5)" },
  { value: "Asia/Qostanay", label: "Костанай (UTC+5)" },
  { value: "Asia/Aqtobe", label: "Актобе (UTC+5)" },
  { value: "Asia/Ashgabat", label: "Ашхабад (UTC+5)" },
  { value: "Asia/Dushanbe", label: "Душанбе (UTC+5)" },
  { value: "Asia/Bishkek", label: "Бишкек (UTC+6)" },
  { value: "Europe/Moscow", label: "Москва (UTC+3)" },
  { value: "Asia/Yekaterinburg", label: "Екатеринбург (UTC+5)" },
  { value: "Asia/Baku", label: "Баку (UTC+4)" },
  { value: "Asia/Tbilisi", label: "Тбилиси (UTC+4)" },
  { value: "Asia/Yerevan", label: "Ереван (UTC+4)" },
  { value: "Asia/Dubai", label: "Дубай (UTC+4)" },
]

export const DEFAULT_TIMEZONE = "Asia/Tashkent"

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
