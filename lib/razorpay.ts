import Razorpay from "razorpay"

// Lazy + graceful: never throw at import time (that would crash any route that
// imports this even when keys aren't set yet). Configure with RAZORPAY_KEY_ID /
// RAZORPAY_KEY_SECRET.
// A real Razorpay key id looks like rzp_test_… / rzp_live_…. The .env template
// ships placeholders ("your-razorpay-…"); treat those as NOT configured so a dev
// or a half-set-up deploy gets the honest "payments aren't switched on" 503
// instead of a 500 when the fake key is rejected by Razorpay's API.
export const razorpayConfigured = () => {
  const id = process.env.RAZORPAY_KEY_ID || ""
  const secret = process.env.RAZORPAY_KEY_SECRET || ""
  return /^rzp_(test|live)_/.test(id) && secret.length >= 10 && !/^your-/.test(secret)
}

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
