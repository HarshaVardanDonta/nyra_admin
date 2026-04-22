import { compressInvoiceLogoForUpload } from '../compress-image'
import { request } from './client'
import { ApiError } from './errors'

const API = '/api/v1'

export type InvoiceExtraId = {
  label: string
  value: string
}

export type StoreInvoiceSettings = {
  documentTitle: string
  tradingName: string
  sellerLegalName: string
  sellerAddress: string
  sellerCountry: string
  gstin: string
  pan: string
  cin: string
  extraIds: InvoiceExtraId[]
  supportEmail: string
  supportPhone: string
  websiteUrl: string
  termsAndConditions: string
  footerNote: string
  logoUrl: string
  productTableColumns: string[]
}

function asStr(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

function parseExtraIds(raw: unknown): InvoiceExtraId[] {
  if (!Array.isArray(raw)) return []
  const out: InvoiceExtraId[] = []
  for (const x of raw) {
    if (!x || typeof x !== 'object') continue
    const o = x as Record<string, unknown>
    out.push({
      label: asStr(o.label ?? o.Label),
      value: asStr(o.value ?? o.Value),
    })
  }
  return out
}

function parseStringArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw.filter((x) => typeof x === 'string').map((x) => x.trim()).filter(Boolean)
}

export function parseStoreInvoiceSettings(raw: unknown): StoreInvoiceSettings {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  return {
    documentTitle: asStr(o.documentTitle),
    tradingName: asStr(o.tradingName),
    sellerLegalName: asStr(o.sellerLegalName),
    sellerAddress: asStr(o.sellerAddress),
    sellerCountry: asStr(o.sellerCountry),
    gstin: asStr(o.gstin),
    pan: asStr(o.pan),
    cin: asStr(o.cin),
    extraIds: parseExtraIds(o.extraIds),
    supportEmail: asStr(o.supportEmail),
    supportPhone: asStr(o.supportPhone),
    websiteUrl: asStr(o.websiteUrl),
    termsAndConditions: asStr(o.termsAndConditions),
    footerNote: asStr(o.footerNote),
    logoUrl: asStr(o.logoUrl),
    productTableColumns: parseStringArray(o.productTableColumns),
  }
}

export async function getStoreInvoiceSettings(
  token: string | null,
): Promise<StoreInvoiceSettings> {
  const raw = await request<unknown>(`${API}/store/invoice-settings`, { method: 'GET', token })
  return parseStoreInvoiceSettings(raw)
}

export async function patchStoreInvoiceSettings(
  token: string | null,
  body: StoreInvoiceSettings,
): Promise<StoreInvoiceSettings> {
  const raw = await request<unknown>(`${API}/store/invoice-settings`, {
    method: 'PATCH',
    token,
    body,
  })
  return parseStoreInvoiceSettings(raw)
}

/** Compress in-browser, upload to Cloudflare R2; returns public HTTPS URL. */
export async function uploadStoreInvoiceLogo(
  token: string | null,
  file: File,
): Promise<string> {
  const ready = await compressInvoiceLogoForUpload(file)
  const fd = new FormData()
  fd.append('file', ready)
  const raw = await request<unknown>(`${API}/store/invoice-logo`, {
    method: 'POST',
    token,
    body: fd,
  })
  if (!raw || typeof raw !== 'object') {
    throw new ApiError('Invalid upload response', 500)
  }
  const url = (raw as Record<string, unknown>).url
  if (typeof url !== 'string' || !url.trim()) {
    throw new ApiError('Upload response missing url', 500)
  }
  return url.trim()
}
