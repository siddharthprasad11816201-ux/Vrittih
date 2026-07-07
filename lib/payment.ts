export type GatewayName = "razorpay" | "stripe" | "crypto" | "manual"
export const JOINING_FEE_CHF = 1
export function getActiveGateway(): GatewayName {
  return (process.env.ACTIVE_PAYMENT_GATEWAY as GatewayName) || "stripe"
}
