import { request } from './client'

export type FAQ = {
  id: string
  question: string
  answer: string
  isPublished: boolean
  createdAt: string
  updatedAt: string
}

export type FAQWrite = {
  question: string
  answer: string
  isPublished: boolean
}

export async function fetchFAQs(
  token: string,
  params: { limit: number; offset: number },
): Promise<{ faqs: FAQ[] }> {
  const qs = new URLSearchParams({
    limit: String(params.limit),
    offset: String(params.offset),
  })
  return request(`/api/v1/faqs?${qs.toString()}`, { method: 'GET', token })
}

export async function createFAQ(token: string, body: FAQWrite): Promise<FAQ> {
  return request(`/api/v1/faqs`, { method: 'POST', token, body })
}

export async function patchFAQ(token: string, faqId: string, body: FAQWrite): Promise<FAQ> {
  const encoded = encodeURIComponent(faqId)
  return request(`/api/v1/faqs/${encoded}`, { method: 'PATCH', token, body })
}

export async function deleteFAQ(token: string, faqId: string): Promise<{ ok: true }> {
  const encoded = encodeURIComponent(faqId)
  return request(`/api/v1/faqs/${encoded}`, { method: 'DELETE', token })
}

export type ProductFAQItem = {
  faqId: string | null
  question: string
  answer: string
  source: 'universal' | 'custom'
}

export async function fetchProductFAQs(
  token: string,
  productId: string,
): Promise<{ items: ProductFAQItem[] }> {
  const encoded = encodeURIComponent(productId)
  return request(`/api/v1/products/${encoded}/faqs`, { method: 'GET', token })
}

export type ProductFAQWriteItem =
  | { faqId: string }
  | { question: string; answer: string }

export async function putProductFAQs(
  token: string,
  productId: string,
  items: ProductFAQWriteItem[],
): Promise<{ ok: true }> {
  const encoded = encodeURIComponent(productId)
  return request(`/api/v1/products/${encoded}/faqs`, {
    method: 'PUT',
    token,
    body: { items },
  })
}

