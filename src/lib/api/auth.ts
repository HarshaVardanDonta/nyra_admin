import { request } from './client'

export type OtpSendResponse = {
  request_id: string
}

export async function sendOtp(phone: string): Promise<OtpSendResponse> {
  return request<OtpSendResponse>('/api/v1/auth/otp/send', {
    method: 'POST',
    body: { phone },
  })
}

export type VerifyAdminParams = {
  phone: string
  otp: string
  request_id: string
}

export type VerifyResponse = {
  token: string
  refresh_token: string
}

export async function verifyAdminOtp(
  params: VerifyAdminParams,
): Promise<VerifyResponse> {
  return request<VerifyResponse>('/api/v1/auth/otp/verify', {
    method: 'POST',
    body: {
      phone: params.phone,
      otp: params.otp,
      request_id: params.request_id,
      login_type: 'admin',
    },
  })
}
