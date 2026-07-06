// Shared in-memory OTP store
// In production replace with Redis
export const otpStore = new Map<string, { otp: string; expiresAt: number; userId: string }>()