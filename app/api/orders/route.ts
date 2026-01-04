import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/db'

export async function POST(request: NextRequest) {
  if (!supabase) {
    return NextResponse.json(
      { error: 'Database service unavailable. Please check configuration.' },
      { status: 503 }
    )
  }

  try {
    const body = await request.json()
    const {
      orderType,
      customerInfo,
      cart,
      scheduledTime,
      subtotal,
      tax,
      total,
      discountAmount = 0,
    } = body

    // Validate required fields
    if (!orderType || !customerInfo?.name || !customerInfo?.phone || !cart || cart.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Generate order number
    const orderNumber = `GTB-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`

    // Create or find customer
    let customerId = null
    if (customerInfo.phone) {
      const { data: existingCustomer } = await supabase
        .from('customers')
        .select('id')
        .eq('phone', customerInfo.phone)
        .single()

      if (existingCustomer) {
        customerId = existingCustomer.id
        // Update customer info if provided
        await supabase
          .from('customers')
          .update({
            name: customerInfo.name,
            email: customerInfo.email || null,
            default_address: orderType === 'delivery' && customerInfo.address
              ? { address: customerInfo.address }
              : null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', customerId)
      } else {
        // Create new customer
        const { data: newCustomer, error: customerError } = await supabase
          .from('customers')
          .insert({
            name: customerInfo.name,
            phone: customerInfo.phone,
            email: customerInfo.email || null,
            default_address: orderType === 'delivery' && customerInfo.address
              ? { address: customerInfo.address }
              : null,
          })
          .select()
          .single()

        if (customerError) {
          console.error('Customer creation error:', customerError)
        } else {
          customerId = newCustomer.id
        }
      }
    }

    // Create order
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        order_number: orderNumber,
        customer_id: customerId,
        customer_name: customerInfo.name,
        customer_phone: customerInfo.phone,
        customer_email: customerInfo.email || null,
        delivery_address: orderType === 'delivery' && customerInfo.address
          ? { address: customerInfo.address }
          : null,
        order_type: orderType,
        subtotal_amount: subtotal,
        discount_amount: discountAmount,
        tax_amount: tax,
        total_amount: total,
        status: 'pending',
        payment_status: 'unpaid',
        scheduled_time: scheduledTime || null,
      })
      .select()
      .single()

    if (orderError) {
      console.error('Order creation error:', orderError)
      return NextResponse.json(
        { error: 'Failed to create order' },
        { status: 500 }
      )
    }

    // Create order items
    const orderItems = cart.map((item: any) => ({
      order_id: order.id,
      item_id: item.itemId || null,
      variant_id: item.variantId || null,
      name_snapshot: item.name,
      variant_name_snapshot: item.variantName || null,
      price_snapshot: item.price,
      quantity: item.quantity,
      total_line_amount: item.price * item.quantity,
      extra_info: item.extraInfo || null,
    }))

    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(orderItems)

    if (itemsError) {
      console.error('Order items error:', itemsError)
      // Note: Order is already created, but items failed. In production, you might want to handle this differently
    }

    return NextResponse.json(
      {
        success: true,
        order: {
          ...order,
          orderNumber,
        },
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Order error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

