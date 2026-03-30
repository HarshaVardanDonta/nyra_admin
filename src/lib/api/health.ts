import { request } from './client'

export async function getHealth(): Promise<unknown> {
  return request<unknown>('/healthz', { method: 'GET' })
}
