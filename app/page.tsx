import { connection } from "next/server"

import { getCategories, getVendors } from "@/db/queries"
import { Home } from "@/components/marketplace/home"

export default async function Page() {
  // Opt into request-time rendering (fresh vendor data per request).
  await connection()

  const [categories, vendors] = await Promise.all([getCategories(), getVendors()])

  return <Home categories={categories} vendors={vendors} />
}
