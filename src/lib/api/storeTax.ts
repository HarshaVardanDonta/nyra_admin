import { request } from './client'

const API = '/api/v1'

export type TaxComponent = {
  label: string
  /** 0..1 decimal from API */
  rate: number
}

export type StoreTaxSettings = {
  defaultTaxRate: number
  defaultTaxComponents: TaxComponent[]
}

function parseComponents(raw: unknown): TaxComponent[] {
  if (!Array.isArray(raw)) return []
  const out: TaxComponent[] = []
  for (const x of raw) {
    if (!x || typeof x !== 'object') continue
    const o = x as Record<string, unknown>
    const label = typeof o.label === 'string' ? o.label : typeof o.Label === 'string' ? o.Label : ''
    const r = o.rate ?? o.Rate
    const rate = typeof r === 'number' && Number.isFinite(r) ? r : Number.NaN
    if (!Number.isFinite(rate)) continue
    out.push({ label: label.trim() || 'Tax', rate })
  }
  return out
}

export async function getStoreTaxSettings(token: string | null): Promise<StoreTaxSettings> {
  const raw = await request<unknown>(`${API}/store/tax`, { method: 'GET', token })
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const r = o.defaultTaxRate
  const defaultTaxRate = typeof r === 'number' && Number.isFinite(r) ? r : 0
  const defaultTaxComponents = parseComponents(o.defaultTaxComponents)
  return { defaultTaxRate, defaultTaxComponents }
}

export async function patchStoreTaxSettings(
  token: string | null,
  body: { defaultTaxComponents: { label: string; rate: number }[] },
): Promise<StoreTaxSettings> {
  const raw = await request<unknown>(`${API}/store/tax`, {
    method: 'PATCH',
    token,
    body,
  })
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const r = o.defaultTaxRate
  const defaultTaxRate = typeof r === 'number' && Number.isFinite(r) ? r : 0
  const defaultTaxComponents = parseComponents(o.defaultTaxComponents)
  return { defaultTaxRate, defaultTaxComponents }
}
