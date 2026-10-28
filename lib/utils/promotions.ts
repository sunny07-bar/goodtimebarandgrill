/**
 * Promotion & BOGO Discount Engine for Event Tickets
 * Handles:
 * - BOGO (Buy 1 Get 1, Buy 2 Get 2, Buy X Get Y at Z% off)
 * - Percentage Discounts (e.g. 20% off)
 * - Fixed Amount Discounts (e.g. $5.00 off)
 * - Automatic bundle detection vs Promo Coupon Code
 */

export interface TicketCartItem {
  ticketTypeId: string;
  name: string;
  price: number;
  quantity: number;
}

export interface PromotionRule {
  id: string;
  event_id: string;
  ticket_type_id?: string | null;
  name: string;
  promo_code?: string | null;
  discount_type: 'bogo' | 'percentage' | 'fixed_amount';
  discount_value?: number;
  buy_quantity?: number;
  get_quantity?: number;
  get_discount_percent?: number;
  min_tickets_required?: number;
  max_uses_total?: number | null;
  uses_count?: number;
  is_active?: boolean;
}

export interface PromotionCalculationResult {
  subtotal: number;
  discountAmount: number;
  finalTotal: number;
  appliedPromotion: PromotionRule | null;
  ticketBreakdown: Array<{
    ticketTypeId: string;
    name: string;
    unitPrice: number;
    discountedUnitPrice: number;
  }>;
}

/**
 * Calculate the best promotional discount for a set of selected tickets
 */
export function calculateTicketPromotions(
  cartItems: TicketCartItem[],
  promotions: PromotionRule[] = [],
  promoCode?: string
): PromotionCalculationResult {
  // Calculate base subtotal
  const subtotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const totalTicketsCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  // If no tickets or no promotions, return base total
  if (cartItems.length === 0 || totalTicketsCount === 0 || !promotions || promotions.length === 0) {
    const rawBreakdown = cartItems.flatMap((item) =>
      Array.from({ length: item.quantity }, () => ({
        ticketTypeId: item.ticketTypeId,
        name: item.name,
        unitPrice: item.price,
        discountedUnitPrice: item.price,
      }))
    );

    return {
      subtotal,
      discountAmount: 0,
      finalTotal: subtotal,
      appliedPromotion: null,
      ticketBreakdown: rawBreakdown,
    };
  }

  const cleanPromoCode = promoCode ? promoCode.trim().toUpperCase() : '';

  // Filter promotions:
  // 1. Must be active
  // 2. If max_uses_total is set, uses_count must be < max_uses_total
  // 3. If promo_code is required, cleanPromoCode must match
  // 4. If promo_code is empty (automatic promo), cleanPromoCode does not need to be provided
  const eligiblePromotions = promotions.filter((promo) => {
    if (promo.is_active === false) return false;
    if (promo.max_uses_total && (promo.uses_count || 0) >= promo.max_uses_total) return false;

    if (promo.promo_code && promo.promo_code.trim()) {
      return promo.promo_code.trim().toUpperCase() === cleanPromoCode;
    }

    // Automatic promotion (no coupon required)
    return true;
  });

  if (eligiblePromotions.length === 0) {
    const rawBreakdown = cartItems.flatMap((item) =>
      Array.from({ length: item.quantity }, () => ({
        ticketTypeId: item.ticketTypeId,
        name: item.name,
        unitPrice: item.price,
        discountedUnitPrice: item.price,
      }))
    );

    return {
      subtotal,
      discountAmount: 0,
      finalTotal: subtotal,
      appliedPromotion: null,
      ticketBreakdown: rawBreakdown,
    };
  }

  // Evaluate each eligible promotion and pick the one with greatest savings
  let bestResult: PromotionCalculationResult | null = null;

  for (const promo of eligiblePromotions) {
    // Determine which tickets in cart are eligible for this promo
    const matchingItems = cartItems.filter((item) => {
      if (!promo.ticket_type_id) return true; // applies to all tickets
      return item.ticketTypeId === promo.ticket_type_id;
    });

    const matchingQty = matchingItems.reduce((sum, item) => sum + item.quantity, 0);
    const minRequired = promo.min_tickets_required || 1;

    if (matchingQty < minRequired) {
      continue; // Threshold not met
    }

    let discount = 0;

    // Expand all cart items into individual tickets for item-level discounting
    const individualTickets: Array<{
      ticketTypeId: string;
      name: string;
      unitPrice: number;
      discountedUnitPrice: number;
      isEligible: boolean;
    }> = cartItems.flatMap((item) =>
      Array.from({ length: item.quantity }, () => ({
        ticketTypeId: item.ticketTypeId,
        name: item.name,
        unitPrice: item.price,
        discountedUnitPrice: item.price,
        isEligible: !promo.ticket_type_id || item.ticketTypeId === promo.ticket_type_id,
      }))
    );

    if (promo.discount_type === 'bogo') {
      const buyQty = promo.buy_quantity || 1;
      const getQty = promo.get_quantity || 1;
      const discountPercent = (promo.get_discount_percent ?? 100) / 100;
      const bundleSize = buyQty + getQty;

      // Group eligible tickets
      const eligibleTickets = individualTickets.filter((t) => t.isEligible);
      const bundlesCount = Math.floor(eligibleTickets.length / bundleSize);

      if (bundlesCount > 0) {
        let remainingDiscountsToApply = bundlesCount * getQty;

        // Apply discount starting from the end of the eligible list
        // (Customer pays full price for "buy" items, and receives discount on "get" items)
        for (let i = eligibleTickets.length - 1; i >= 0 && remainingDiscountsToApply > 0; i--) {
          const ticket = eligibleTickets[i];
          const ticketSavings = ticket.unitPrice * discountPercent;
          ticket.discountedUnitPrice = Math.max(0, ticket.unitPrice - ticketSavings);
          discount += ticketSavings;
          remainingDiscountsToApply--;
        }
      }
    } else if (promo.discount_type === 'percentage') {
      const percent = Math.min(100, Math.max(0, promo.discount_value || 0)) / 100;
      for (const ticket of individualTickets) {
        if (ticket.isEligible) {
          const ticketSavings = ticket.unitPrice * percent;
          ticket.discountedUnitPrice = Math.max(0, ticket.unitPrice - ticketSavings);
          discount += ticketSavings;
        }
      }
    } else if (promo.discount_type === 'fixed_amount') {
      const fixedAmount = Math.max(0, promo.discount_value || 0);
      const eligibleSubtotal = individualTickets
        .filter((t) => t.isEligible)
        .reduce((sum, t) => sum + t.unitPrice, 0);

      discount = Math.min(eligibleSubtotal, fixedAmount);

      // Distribute fixed discount across eligible tickets proportionally
      if (eligibleSubtotal > 0 && discount > 0) {
        let distributedDiscount = 0;
        const eligibleTickets = individualTickets.filter((t) => t.isEligible);

        eligibleTickets.forEach((ticket, idx) => {
          if (idx === eligibleTickets.length - 1) {
            // Apply remainder to last ticket to avoid rounding loss
            const remaining = discount - distributedDiscount;
            ticket.discountedUnitPrice = Math.max(0, ticket.unitPrice - remaining);
          } else {
            const propDiscount = Math.round((ticket.unitPrice / eligibleSubtotal) * discount * 100) / 100;
            ticket.discountedUnitPrice = Math.max(0, ticket.unitPrice - propDiscount);
            distributedDiscount += propDiscount;
          }
        });
      }
    }

    const calculatedDiscount = Math.round(discount * 100) / 100;
    const finalTotal = Math.max(0, Math.round((subtotal - calculatedDiscount) * 100) / 100);

    const resultCandidate: PromotionCalculationResult = {
      subtotal: Math.round(subtotal * 100) / 100,
      discountAmount: calculatedDiscount,
      finalTotal,
      appliedPromotion: promo,
      ticketBreakdown: individualTickets.map(({ ticketTypeId, name, unitPrice, discountedUnitPrice }) => ({
        ticketTypeId,
        name,
        unitPrice,
        discountedUnitPrice,
      })),
    };

    if (!bestResult || resultCandidate.discountAmount > bestResult.discountAmount) {
      bestResult = resultCandidate;
    }
  }

  return (
    bestResult || {
      subtotal,
      discountAmount: 0,
      finalTotal: subtotal,
      appliedPromotion: null,
      ticketBreakdown: cartItems.flatMap((item) =>
        Array.from({ length: item.quantity }, () => ({
          ticketTypeId: item.ticketTypeId,
          name: item.name,
          unitPrice: item.price,
          discountedUnitPrice: item.price,
        }))
      ),
    }
  );
}

