import { request } from './client'

export type StoreFooterSettingsSocial = {
  label: string
  href: string
  enabled?: boolean
}

export type StoreFooterSettings = {
  brandName: string
  tagline: string
  contact: {
    phoneDisplay: string
    phoneHref: string
    email: string
    cin: string
    officeLabel: string
    officeLines: string[]
  }
  socials: StoreFooterSettingsSocial[]
  updatedAt?: string
}

function normalize(raw: any): StoreFooterSettings {
  const obj = raw ?? {}
  const contactRaw = obj.contact ?? obj.Contact ?? {}
  const socialsRaw = obj.socials ?? obj.Socials ?? []

  const officeLinesRaw = contactRaw.officeLines ?? contactRaw.OfficeLines ?? []
  const officeLines = Array.isArray(officeLinesRaw)
    ? officeLinesRaw.map((v) => String(v ?? '').trim()).filter(Boolean)
    : []

  const socials = Array.isArray(socialsRaw)
    ? socialsRaw
        .map((s: any) => ({
          label: String(s?.label ?? s?.Label ?? '').trim(),
          href: String(s?.href ?? s?.Href ?? '').trim(),
          enabled:
            typeof s?.enabled === 'boolean'
              ? s.enabled
              : typeof s?.Enabled === 'boolean'
                ? s.Enabled
                : true,
        }))
        .filter((s) => s.label || s.href)
    : []

  return {
    brandName: String(obj.brandName ?? obj.BrandName ?? '').trim(),
    tagline: String(obj.tagline ?? obj.Tagline ?? '').trim(),
    contact: {
      phoneDisplay: String(contactRaw.phoneDisplay ?? contactRaw.PhoneDisplay ?? '').trim(),
      phoneHref: String(contactRaw.phoneHref ?? contactRaw.PhoneHref ?? '').trim(),
      email: String(contactRaw.email ?? contactRaw.Email ?? '').trim(),
      cin: String(contactRaw.cin ?? contactRaw.CIN ?? contactRaw.Cin ?? '').trim(),
      officeLabel: String(contactRaw.officeLabel ?? contactRaw.OfficeLabel ?? '').trim(),
      officeLines,
    },
    socials,
    updatedAt: obj.updatedAt ?? obj.UpdatedAt,
  }
}

export async function getStoreFooterSettings(token: string): Promise<StoreFooterSettings> {
  const r = await request<StoreFooterSettings>('/api/v1/store/footer-settings', {
    method: 'GET',
    token,
  })
  return normalize(r)
}

export async function patchStoreFooterSettings(
  token: string,
  body: StoreFooterSettings,
): Promise<StoreFooterSettings> {
  const r = await request<StoreFooterSettings>('/api/v1/store/footer-settings', {
    method: 'PATCH',
    token,
    body,
  })
  return normalize(r)
}

