import { getMenuCategories, getMenuItems } from '@/lib/queries'
import MenuClient from '@/components/MenuClient'
import { Suspense } from 'react'

// Production-ready ISR: Revalidate every 30 minutes (1800 seconds) - menu rarely changes
// Pages cached for fast loading; updates only when menu changes
export const revalidate = 1800

export default async function MenuPage() {
  const categories = await getMenuCategories()
  const allItems = await getMenuItems()

  return (
    <Suspense fallback={<div className="min-h-screen bg-[#050505]" />}>
      <MenuClient categories={categories} items={allItems} />
    </Suspense>
  )
}
