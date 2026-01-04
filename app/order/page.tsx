'use client'

import { useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ShoppingCart, Plus, Minus, Trash2 } from 'lucide-react'
import { getMenuItems } from '@/lib/queries'
import { floridaDateTimeLocalToUTC } from '@/lib/utils/timezone'

type CartItem = {
  id: string
  name: string
  variantName?: string
  price: number
  quantity: number
  itemId?: string
  variantId?: string
}

export default function OrderPage() {
  const [cart, setCart] = useState<CartItem[]>([])
  const [orderType, setOrderType] = useState<'pickup' | 'delivery' | 'dine_in'>('pickup')
  const [customerInfo, setCustomerInfo] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
  })
  const [scheduledTime, setScheduledTime] = useState('')
  const [menuItems, setMenuItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadMenuItems() {
      try {
        const items = await getMenuItems()
        setMenuItems(items)
      } catch (error) {
        console.error('Error loading menu items:', error)
      } finally {
        setLoading(false)
      }
    }
    loadMenuItems()
  }, [])

  const addToCart = (item: any) => {
    const price = item.menu_item_variants && item.menu_item_variants.length > 0
      ? item.menu_item_variants[0].price
      : item.base_price || 0
    
    const variant = item.menu_item_variants && item.menu_item_variants.length > 0
      ? item.menu_item_variants[0]
      : null

    const cartItem: CartItem = {
      id: variant ? `${item.id}-${variant.id}` : item.id,
      name: item.name,
      variantName: variant?.name,
      price: price,
      quantity: 1,
      itemId: item.id,
      variantId: variant?.id,
    }

    setCart(prev => {
      const existing = prev.find(c => c.id === cartItem.id)
      if (existing) {
        return prev.map(c =>
          c.id === cartItem.id ? { ...c, quantity: c.quantity + 1 } : c
        )
      }
      return [...prev, cartItem]
    })
  }

  const updateQuantity = (id: string, delta: number) => {
    setCart(prev =>
      prev.map(item => {
        if (item.id === id) {
          const newQuantity = item.quantity + delta
          return newQuantity > 0 ? { ...item, quantity: newQuantity } : item
        }
        return item
      }).filter(item => item.quantity > 0)
    )
  }

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(item => item.id !== id))
  }

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const tax = subtotal * 0.08 // 8% tax
  const total = subtotal + tax

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      // Convert scheduledTime from Florida timezone (datetime-local) to UTC for database storage
      const scheduledTimeUTC = scheduledTime ? floridaDateTimeLocalToUTC(scheduledTime) : null
      
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderType,
          customerInfo,
          cart: cart.map(item => ({
            name: item.name,
            variantName: item.variantName,
            price: item.price,
            quantity: item.quantity,
            itemId: item.itemId,
            variantId: item.variantId,
          })),
          scheduledTime: scheduledTimeUTC,
          subtotal,
          tax,
          total,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        alert(`Order placed successfully! Order number: ${data.order.orderNumber}`)
        setCart([])
        setCustomerInfo({ name: '', phone: '', email: '', address: '' })
        setScheduledTime('')
      } else {
        alert('Failed to place order. Please try again.')
      }
    } catch (error) {
      console.error('Order error:', error)
      alert('An error occurred. Please try again.')
    }
  }

  return (
    <div className="section-bg-primary section-spacing">
      <div className="container-global">
        <div className="text-center mb-8 md:mb-12">
          <h1 className="section-title mb-4">ORDER ONLINE</h1>
          <div className="section-divider mb-6"></div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
          {/* Menu Items */}
          <div className="lg:col-span-2">
          <div className="card-premium">
            <h2 className="card-title mb-6 text-[#F59E0B]">Menu Items</h2>
            {loading ? (
              <div className="text-center py-8 md:py-12">
                <p className="body-text opacity-75">Loading menu...</p>
              </div>
            ) : menuItems.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
                {menuItems.map((item) => {
                  const price = item.menu_item_variants && item.menu_item_variants.length > 0
                    ? item.menu_item_variants[0].price
                    : item.base_price || 0
                  return (
                    <div key={item.id} className="card-dark p-4 md:p-5 hover:border-[#F59E0B]/50 transition-all">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <h3 className="card-title text-base md:text-lg mb-1">{item.name}</h3>
                          <p className="price-amber text-lg md:text-xl font-bold">${price.toFixed(2)}</p>
                          {item.description && (
                            <p className="body-text text-xs md:text-sm opacity-75 mt-2 line-clamp-2">{item.description}</p>
                          )}
                        </div>
                        <button
                          onClick={() => addToCart(item)}
                          className="btn-amber-sm flex-shrink-0 text-xs md:text-sm px-3 md:px-4 py-2"
                        >
                          Add
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="text-center py-8 md:py-12">
                <p className="body-text opacity-75">No menu items available.</p>
              </div>
            )}
          </div>
          </div>

          {/* Cart & Checkout */}
          <div className="lg:col-span-1">
          <div className="card-premium sticky top-4 sm:top-24">
            <h2 className="card-title mb-6 flex items-center gap-2 text-[#F59E0B]">
              <ShoppingCart className="h-5 w-5 md:h-6 md:w-6" />
              Your Order
            </h2>
            {cart.length === 0 ? (
              <p className="body-text text-center py-8 opacity-75">Your cart is empty</p>
            ) : (
              <>
                <div className="space-y-3 md:space-y-4 mb-6">
                  {cart.map((item) => (
                    <div key={item.id} className="card-dark p-3 md:p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm md:text-base mb-1">{item.name}</p>
                          <p className="body-text text-xs opacity-75">
                            ${item.price.toFixed(2)} × {item.quantity}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 md:gap-2 flex-shrink-0">
                          <button
                            onClick={() => updateQuantity(item.id, -1)}
                            className="min-h-[36px] md:min-h-[40px] min-w-[36px] md:min-w-[40px] rounded-lg border border-white/20 bg-[#111111] hover:bg-[#F59E0B]/10 hover:border-[#F59E0B]/40 text-white transition-all touch-manipulation flex items-center justify-center"
                          >
                            <Minus className="h-3.5 w-3.5 md:h-4 md:w-4" />
                          </button>
                          <span className="w-8 md:w-10 text-center text-sm md:text-base font-semibold">{item.quantity}</span>
                          <button
                            onClick={() => updateQuantity(item.id, 1)}
                            className="min-h-[36px] md:min-h-[40px] min-w-[36px] md:min-w-[40px] rounded-lg border border-white/20 bg-[#111111] hover:bg-[#F59E0B]/10 hover:border-[#F59E0B]/40 text-white transition-all touch-manipulation flex items-center justify-center"
                          >
                            <Plus className="h-3.5 w-3.5 md:h-4 md:w-4" />
                          </button>
                          <button
                            onClick={() => removeFromCart(item.id)}
                            className="ml-1 text-red-400 hover:text-red-300 min-h-[36px] md:min-h-[40px] min-w-[36px] md:min-w-[40px] rounded-lg border border-red-400/20 bg-[#111111] hover:bg-red-400/10 transition-all touch-manipulation flex items-center justify-center"
                          >
                            <Trash2 className="h-3.5 w-3.5 md:h-4 md:w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="border-t border-white/10 pt-4 space-y-2 mb-6">
                  <div className="flex justify-between body-text text-sm md:text-base">
                    <span>Subtotal</span>
                    <span>${subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between body-text text-sm md:text-base">
                    <span>Tax</span>
                    <span>${tax.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-lg md:text-xl pt-2 border-t border-white/10">
                    <span>Total</span>
                    <span className="price-amber">${total.toFixed(2)}</span>
                  </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4 md:space-y-5">
                  {/* Order Type */}
                  <div>
                    <Label className="body-text mb-2 block font-semibold text-sm md:text-base">Order Type</Label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setOrderType('pickup')}
                        className={`px-3 py-2 md:px-4 md:py-2.5 rounded-lg text-xs md:text-sm font-semibold transition-all touch-manipulation ${
                          orderType === 'pickup'
                            ? 'bg-[#F59E0B] text-black'
                            : 'bg-[#111111] border border-white/10 text-white hover:bg-[#F59E0B]/10 hover:border-[#F59E0B]/40'
                        }`}
                      >
                        Pickup
                      </button>
                      <button
                        type="button"
                        onClick={() => setOrderType('delivery')}
                        className={`px-3 py-2 md:px-4 md:py-2.5 rounded-lg text-xs md:text-sm font-semibold transition-all touch-manipulation ${
                          orderType === 'delivery'
                            ? 'bg-[#F59E0B] text-black'
                            : 'bg-[#111111] border border-white/10 text-white hover:bg-[#F59E0B]/10 hover:border-[#F59E0B]/40'
                        }`}
                      >
                        Delivery
                      </button>
                      <button
                        type="button"
                        onClick={() => setOrderType('dine_in')}
                        className={`px-3 py-2 md:px-4 md:py-2.5 rounded-lg text-xs md:text-sm font-semibold transition-all touch-manipulation ${
                          orderType === 'dine_in'
                            ? 'bg-[#F59E0B] text-black'
                            : 'bg-[#111111] border border-white/10 text-white hover:bg-[#F59E0B]/10 hover:border-[#F59E0B]/40'
                        }`}
                      >
                        Dine In
                      </button>
                    </div>
                  </div>

                  {/* Customer Info */}
                  <div>
                    <Label htmlFor="name" className="body-text mb-2 block font-semibold text-sm md:text-base">Name *</Label>
                    <Input
                      id="name"
                      required
                      value={customerInfo.name}
                      onChange={(e) => setCustomerInfo({ ...customerInfo, name: e.target.value })}
                      className="form-input-premium h-11 md:h-12 text-sm md:text-base"
                      placeholder="Your name"
                    />
                  </div>

                  <div>
                    <Label htmlFor="phone" className="body-text mb-2 block font-semibold text-sm md:text-base">Phone *</Label>
                    <Input
                      id="phone"
                      required
                      type="tel"
                      value={customerInfo.phone}
                      onChange={(e) => setCustomerInfo({ ...customerInfo, phone: e.target.value })}
                      className="form-input-premium h-11 md:h-12 text-sm md:text-base"
                      placeholder="(321) 555-0123"
                    />
                  </div>

                  <div>
                    <Label htmlFor="email" className="body-text mb-2 block font-semibold text-sm md:text-base">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={customerInfo.email}
                      onChange={(e) => setCustomerInfo({ ...customerInfo, email: e.target.value })}
                      className="form-input-premium h-11 md:h-12 text-sm md:text-base"
                      placeholder="your.email@example.com"
                    />
                  </div>

                  {orderType === 'delivery' && (
                    <div>
                      <Label htmlFor="address" className="body-text mb-2 block font-semibold text-sm md:text-base">Delivery Address *</Label>
                      <Input
                        id="address"
                        required
                        value={customerInfo.address}
                        onChange={(e) => setCustomerInfo({ ...customerInfo, address: e.target.value })}
                        className="form-input-premium h-11 md:h-12 text-sm md:text-base"
                        placeholder="123 Main St, City, State ZIP"
                      />
                    </div>
                  )}

                  <div>
                    <Label htmlFor="scheduledTime" className="body-text mb-2 block font-semibold text-sm md:text-base">Scheduled Time (Optional)</Label>
                    <Input
                      id="scheduledTime"
                      type="datetime-local"
                      value={scheduledTime}
                      lang="en-US"
                      onChange={(e) => setScheduledTime(e.target.value)}
                      className="form-input-premium h-11 md:h-12 text-sm md:text-base"
                    />
                    <p className="text-xs text-gray-400 mt-1">Time is in Florida timezone (EST/EDT)</p>
                  </div>

                  <button
                    type="submit"
                    className="btn-amber w-full min-h-[48px] md:min-h-[52px] text-base md:text-lg font-bold touch-manipulation"
                  >
                    Place Order
                  </button>
                </form>
              </>
            )}
          </div>
          </div>
        </div>
      </div>
    </div>
  )
}

