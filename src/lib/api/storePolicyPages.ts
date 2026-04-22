import { request } from './client'

export type StorePolicyPages = {
  privacyPolicyMarkdown: string
  termsOfServiceMarkdown: string
  cookiePolicyMarkdown: string
  deliveryPolicyMarkdown: string
  updatedAt?: string
}

function normalizePolicyPages(raw: any): StorePolicyPages {
  const obj = raw ?? {}
  return {
    privacyPolicyMarkdown: String(obj.privacyPolicyMarkdown ?? obj.PrivacyPolicyMarkdown ?? '').trim(),
    termsOfServiceMarkdown: String(obj.termsOfServiceMarkdown ?? obj.TermsOfServiceMarkdown ?? '').trim(),
    cookiePolicyMarkdown: String(obj.cookiePolicyMarkdown ?? obj.CookiePolicyMarkdown ?? '').trim(),
    deliveryPolicyMarkdown: String(obj.deliveryPolicyMarkdown ?? obj.DeliveryPolicyMarkdown ?? '').trim(),
    updatedAt: obj.updatedAt ?? obj.UpdatedAt,
  }
}

export async function getStorePolicyPages(token: string): Promise<StorePolicyPages> {
  const r = await request<StorePolicyPages>('/api/v1/store/policy-pages', {
    method: 'GET',
    token,
  })
  return normalizePolicyPages(r)
}

export async function patchStorePolicyPages(
  token: string,
  body: StorePolicyPages,
): Promise<StorePolicyPages> {
  const r = await request<StorePolicyPages>('/api/v1/store/policy-pages', {
    method: 'PATCH',
    token,
    body,
  })
  return normalizePolicyPages(r)
}

