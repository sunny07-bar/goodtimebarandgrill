import { getMenuCategories, getMenuItems } from '@/lib/queries'
import MenuClient from '@/components/MenuClient'

// Production-ready ISR: Revalidate every 30 minutes (1800 seconds) - menu rarely changes
// Pages cached for fast loading; updates only when menu changes
export const revalidate = 1800

export default async function MenuPage() {
  const categories = await getMenuCategories()
  const allItems = await getMenuItems()

  return <MenuClient categories={categories} items={allItems} />
}
