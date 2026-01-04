import { getMenuCategories, getMenuItems } from '@/lib/queries'
import MenuClient from '@/components/MenuClient'

// Cache menu for 5 minutes (menu items don't change frequently)
export const revalidate = 300

export default async function MenuPage() {
  const categories = await getMenuCategories()
  const allItems = await getMenuItems()

  return <MenuClient categories={categories} items={allItems} />
}
