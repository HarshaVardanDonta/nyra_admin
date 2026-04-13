import { request } from './client'

export type AdminReviewRow = {
  id: number
  productId: number
  productName: string
  productKey: string
  rating: number
  title: string
  body: string
  reviewerFirstName: string
  reviewerLastName: string
  reviewerEmail: string
  createdAt: string
}

export type ReviewInsightsResponse = {
  totalReviews: number
  averageRating?: number
  countByStar: number[]
  recent: AdminReviewRow[]
}

export async function fetchReviewInsights(
  token: string | null,
  productKey?: string,
): Promise<ReviewInsightsResponse> {
  const q = productKey?.trim() ? `?productKey=${encodeURIComponent(productKey.trim())}` : ''
  return request<ReviewInsightsResponse>(`/api/v1/reviews/insights${q}`, {
    method: 'GET',
    token,
  })
}

export type ReviewsListResponse = {
  reviews: AdminReviewRow[]
  total: number
  page: number
  perPage: number
}

export async function fetchReviewsList(
  token: string | null,
  options?: {
    page?: number
    perPage?: number
    productKey?: string
  },
): Promise<ReviewsListResponse> {
  const params = new URLSearchParams()
  if (options?.page) params.set('page', String(options.page))
  if (options?.perPage) params.set('perPage', String(options.perPage))
  if (options?.productKey?.trim()) params.set('productKey', options.productKey.trim())
  const q = params.toString()
  return request<ReviewsListResponse>(
    q ? `/api/v1/reviews?${q}` : '/api/v1/reviews',
    { method: 'GET', token },
  )
}
