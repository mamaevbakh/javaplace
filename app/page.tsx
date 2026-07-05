import { getCategories, getVendors } from "@/db/queries"
import { Home } from "@/components/marketplace/home"

// getCategories/getVendors are cached ("use cache"), so this page prerenders
// into the static shell — direct visits load instantly from the CDN.
export default async function Page() {
  const [categories, vendors] = await Promise.all([getCategories(), getVendors()])

  return <Home categories={categories} vendors={vendors} />
}
