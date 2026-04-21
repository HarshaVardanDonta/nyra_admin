import { request } from './client'

export type Hazard = {
  id: string
  key: string
  label: string
  color: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export type HazardWrite = {
  key: string
  label: string
  color: string
  isActive: boolean
}

export async function fetchHazards(
  token: string,
  params: { limit: number; offset: number },
): Promise<{ hazards: Hazard[] }> {
  const qs = new URLSearchParams({
    limit: String(params.limit),
    offset: String(params.offset),
  })
  return request(`/api/v1/hazards?${qs.toString()}`, { method: 'GET', token })
}

export async function createHazard(token: string, body: HazardWrite): Promise<Hazard> {
  return request(`/api/v1/hazards`, { method: 'POST', token, body })
}

export async function patchHazard(token: string, hazardId: string, body: HazardWrite): Promise<Hazard> {
  const encoded = encodeURIComponent(hazardId)
  return request(`/api/v1/hazards/${encoded}`, { method: 'PATCH', token, body })
}

export async function deleteHazard(token: string, hazardId: string): Promise<{ ok: true }> {
  const encoded = encodeURIComponent(hazardId)
  return request(`/api/v1/hazards/${encoded}`, { method: 'DELETE', token })
}

