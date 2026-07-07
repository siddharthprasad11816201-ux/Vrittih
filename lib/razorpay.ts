import Razorpay from "razorpay"

// Lazy + graceful: never throw at import time (that would crash any route that
// imports this even when keys aren't set yet). Configure with RAZORPAY_KEY_ID /
// RAZORPAY_KEY_SECRET.
export const razorpayConfigured = () =>
  !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET)

let _rp: Razorpay | null = null
export function getRazorpay(): Razorpay {
  if (!razorpayConfigured()) {
    throw new Error("Razorpay isn't configured yet (add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET).")
  }
  if (!_rp) {
    _rp = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID!,
      key_secret: process.env.RAZORPAY_KEY_SECRET!,
    })
  }
  return _rp
}
