// Get ticket order by ID
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: { ticketId: string } }
) {
  if (!supabase) {
    return NextResponse.json(
      { error: 'Database service unavailable' },
      { status: 503 }
    );
  }

  try {
    const { ticketId } = params;

    if (!ticketId) {
      return NextResponse.json(
        { error: 'Order ID is required' },
        { status: 400 }
      );
    }

    const { data: order, error: orderError } = await supabase
      .from('ticket_orders')
      .select(`
        *,
        events (
          id,
          title,
          slug,
          event_start,
          event_end,
          location
        )
      `)
      .eq('id', ticketId)
      .single();

    if (orderError || !order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    const response = NextResponse.json({
      order,
    });
    
    // Cache ticket orders for 30 seconds (they don't change frequently)
    response.headers.set('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=60');
    
    return response;

  } catch (error: any) {
    console.error('Error fetching order:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
