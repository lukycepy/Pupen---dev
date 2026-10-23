import { randomInt } from 'crypto';

type SupabaseClientLike = {
  from: (table: string) => any;
};

export type EventOrderStatus = 'waitlist' | 'reserved' | 'confirmed' | 'paid' | 'cancelled';

export type CreateEventOrderInput = {
  eventId: string;
  buyerName: string;
  buyerEmail: string;
  paymentMethod: string;
  status: EventOrderStatus;
  totalAmount: number;
  currency?: string;
  reservationExpiresAt?: string | null;
  meta?: Record<string, unknown>;
};

function hasMissingFeatureError(message: string, feature: string) {
  return new RegExp(feature, 'i').test(message) && /(schema cache|does not exist|column|relation)/i.test(message);
}

function toMoney(value: number) {
  return Math.max(0, Math.round(value * 100) / 100);
}

export function mapRsvpStatusToOrderStatus(status: string): EventOrderStatus {
  if (status === 'waitlist') return 'waitlist';
  if (status === 'reserved') return 'reserved';
  if (status === 'cancelled') return 'cancelled';
  return 'confirmed';
}

export async function getPaymentBankAccount(supabase: SupabaseClientLike) {
  let bankAccount = process.env.BANK_ACCOUNT || 'CZ1234567890';
  try {
    const { data } = await supabase.from('payment_settings').select('bank_account').single();
    if (data?.bank_account) bankAccount = String(data.bank_account);
  } catch {}
  return bankAccount;
}

export async function generateUniqueVariableSymbol(supabase: SupabaseClientLike, now = new Date()) {
  const yearPrefix = String(now.getFullYear());

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const candidate = `${yearPrefix}${String(randomInt(0, 100000000)).padStart(8, '0')}`;
    try {
      const res = await supabase.from('event_orders').select('id').eq('variable_symbol', candidate).maybeSingle();
      if (res.error) {
        if (hasMissingFeatureError(res.error.message, 'event_orders')) return candidate;
        throw res.error;
      }
      if (!res.data?.id) return candidate;
    } catch (error) {
      if (error instanceof Error && hasMissingFeatureError(error.message, 'event_orders')) return candidate;
      throw error;
    }
  }

  return `${yearPrefix}${String(Date.now()).slice(-8)}`;
}

export async function createEventOrder(supabase: SupabaseClientLike, input: CreateEventOrderInput) {
  const variableSymbol = await generateUniqueVariableSymbol(supabase);
  const payload = {
    event_id: input.eventId,
    buyer_name: input.buyerName || null,
    buyer_email: input.buyerEmail,
    payment_method: input.paymentMethod,
    status: input.status,
    total_amount: toMoney(input.totalAmount),
    paid_amount: input.status === 'paid' ? toMoney(input.totalAmount) : 0,
    currency: input.currency || 'CZK',
    variable_symbol: variableSymbol,
    reservation_expires_at: input.reservationExpiresAt || null,
    paid_at: input.status === 'paid' ? new Date().toISOString() : null,
    meta: input.meta || {},
  };

  const res = await supabase.from('event_orders').insert([payload]).select('id, variable_symbol').single();
  if (res.error) {
    if (hasMissingFeatureError(res.error.message, 'event_orders')) {
      return { id: null, variableSymbol };
    }
    throw res.error;
  }

  return {
    id: res.data?.id ? String(res.data.id) : null,
    variableSymbol: res.data?.variable_symbol ? String(res.data.variable_symbol) : variableSymbol,
  };
}

export async function updateEventOrderStatus(
  supabase: SupabaseClientLike,
  orderId: string,
  patch: {
    status: EventOrderStatus;
    reservationExpiresAt?: string | null;
    paidAt?: string | null;
    cancelledAt?: string | null;
    paidAmount?: number;
    matchedBankTransactionId?: string | null;
  },
) {
  const payload: Record<string, unknown> = {
    status: patch.status,
    reservation_expires_at: patch.reservationExpiresAt ?? null,
    paid_at: patch.paidAt ?? null,
    cancelled_at: patch.cancelledAt ?? null,
  };
  if (patch.paidAmount != null) payload.paid_amount = toMoney(patch.paidAmount);
  if (patch.matchedBankTransactionId !== undefined) payload.matched_bank_transaction_id = patch.matchedBankTransactionId;

  const res = await supabase.from('event_orders').update(payload).eq('id', orderId);
  if (res.error && !hasMissingFeatureError(res.error.message, 'event_orders')) {
    throw res.error;
  }
}
