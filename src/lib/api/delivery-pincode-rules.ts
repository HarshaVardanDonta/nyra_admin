import { request } from './client'

export type DeliveryPincodeRule = {
  pincode: string
  minDeliveryDays: number
  maxDeliveryDays: number
  deliveryFeePaise: number
  deliveryFeeRupees: number
  notes: string | null
}

function pickStr(o: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const k of keys) {
    const v = o[k]
    if (typeof v === 'string') return v
  }
  return undefined
}

function pickNum(o: Record<string, unknown>, ...keys: string[]): number {
  for (const k of keys) {
    const v = o[k]
    if (typeof v === 'number' && Number.isFinite(v)) return v
  }
  return 0
}

export function normalizeDeliveryPincodeRule(raw: unknown): DeliveryPincodeRule {
  if (!raw || typeof raw !== 'object') {
    return {
      pincode: '',
      minDeliveryDays: 0,
      maxDeliveryDays: 0,
      deliveryFeePaise: 0,
      deliveryFeeRupees: 0,
      notes: null,
    }
  }
  const o = raw as Record<string, unknown>
  const paise = Math.round(pickNum(o, 'deliveryFeePaise', 'delivery_fee_paise'))
  return {
    pincode: pickStr(o, 'pincode', 'Pincode') ?? '',
    minDeliveryDays: Math.round(pickNum(o, 'minDeliveryDays', 'min_delivery_days')),
    maxDeliveryDays: Math.round(pickNum(o, 'maxDeliveryDays', 'max_delivery_days')),
    deliveryFeePaise: paise,
    deliveryFeeRupees: pickNum(o, 'deliveryFeeRupees', 'delivery_fee_rupees') || paise / 100,
    notes: pickStr(o, 'notes', 'Notes') ?? null,
  }
}

export async function fetchDeliveryPincodeRules(
  token: string | null,
  params: { limit?: number; offset?: number } = {},
): Promise<{ rules: DeliveryPincodeRule[]; total: number }> {
  const limit = params.limit ?? 200
  const offset = params.offset ?? 0
  const q = new URLSearchParams({ limit: String(limit), offset: String(offset) })
  const raw = await request<unknown>(`/api/v1/delivery-pincode-rules?${q}`, { method: 'GET', token })
  const rules: DeliveryPincodeRule[] = []
  let total = 0
  if (raw && typeof raw === 'object') {
    const r = raw as Record<string, unknown>
    total = typeof r.total === 'number' ? r.total : 0
    const arr = r.rules
    if (Array.isArray(arr)) {
      for (const row of arr) rules.push(normalizeDeliveryPincodeRule(row))
    }
  }
  return { rules, total }
}

/** Returns rule or throws ApiError 404 when no rule exists. */
export async function fetchDeliveryPincodeRule(
  token: string | null,
  pincode: string,
): Promise<DeliveryPincodeRule> {
  const enc = encodeURIComponent(pincode.trim())
  const raw = await request<unknown>(`/api/v1/delivery-pincode-rules/${enc}`, { method: 'GET', token })
  return normalizeDeliveryPincodeRule(raw)
}

export type DeliveryPincodeRuleWrite = {
  pincode: string
  minDeliveryDays: number
  maxDeliveryDays: number
  /** Whole rupees → sent as paise. */
  deliveryFeeRupees: number
  notes: string
}

function rupeesToPaise(r: number): number {
  return Math.round(r * 100)
}

export async function createDeliveryPincodeRule(
  token: string | null,
  input: DeliveryPincodeRuleWrite,
): Promise<DeliveryPincodeRule> {
  const body = {
    pincode: input.pincode.trim(),
    minDeliveryDays: input.minDeliveryDays,
    maxDeliveryDays: input.maxDeliveryDays,
    deliveryFeePaise: rupeesToPaise(input.deliveryFeeRupees),
    notes: input.notes.trim(),
  }
  const raw = await request<unknown>('/api/v1/delivery-pincode-rules', {
    method: 'POST',
    token,
    body,
  })
  return normalizeDeliveryPincodeRule(raw)
}

export async function updateDeliveryPincodeRule(
  token: string | null,
  pincode: string,
  input: Omit<DeliveryPincodeRuleWrite, 'pincode'>,
): Promise<DeliveryPincodeRule> {
  const enc = encodeURIComponent(pincode.trim())
  const body = {
    minDeliveryDays: input.minDeliveryDays,
    maxDeliveryDays: input.maxDeliveryDays,
    deliveryFeePaise: rupeesToPaise(input.deliveryFeeRupees),
    notes: input.notes.trim(),
  }
  const raw = await request<unknown>(`/api/v1/delivery-pincode-rules/${enc}`, {
    method: 'PUT',
    token,
    body,
  })
  return normalizeDeliveryPincodeRule(raw)
}

export async function deleteDeliveryPincodeRule(token: string | null, pincode: string): Promise<void> {
  const enc = encodeURIComponent(pincode.trim())
  await request(`/api/v1/delivery-pincode-rules/${enc}`, { method: 'DELETE', token })
}
