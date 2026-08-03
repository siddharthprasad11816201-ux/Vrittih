import { prisma } from "@/lib/prisma"

/* Phase 1 · Module 5 — real sign-in history. Every sign-in completion (password,
 * email OTP, authenticator, passkey, registration) records a LoginAttempt so the
 * Account Center shows REAL activity — not a fabricated list. Best-effort: a
 * logging failure must never break authentication, so all writes are swallowed. */

function clientIp(req: Request): string | null {
  const h = req.headers
  const fwd = h.get("x-forwarded-for")
  if (fwd) return fwd.split(",")[0].trim()
  return h.get("x-real-ip") || null
}

/** Compact, human-readable device string from a User-Agent (no UA-parsing dep). */
export function describeDevice(ua: string | null | undefined): string {
  if (!ua) return "Unknown device"
  const os = /Windows NT/i.test(ua) ? "Windows"
    : /iPhone|iPad|iPod/i.test(ua) ? "iOS"
    : /Android/i.test(ua) ? "Android"
    : /Mac OS X/i.test(ua) ? "macOS"
    : /Linux/i.test(ua) ? "Linux" : "Unknown OS"
  const browser = /Edg\//i.test(ua) ? "Edge"
    : /OPR\/|Opera/i.test(ua) ? "Opera"
    : /Chrome\//i.test(ua) && !/Chromium/i.test(ua) ? "Chrome"
    : /Firefox\//i.test(ua) ? "Firefox"
    : /Safari\//i.test(ua) ? "Safari" : "Browser"
  return `${browser} on ${os}`
}

/** Best-effort: record a sign-in attempt (success or failure). Never throws. */
export async function recordLoginAttempt(
  userId: string | null,
  email: string,
  req: Request,
  success: boolean,
): Promise<void> {
  try {
    await prisma.loginAttempt.create({
      data: {
        userId: userId || undefined,
        email: (email || "").toLowerCase().trim(),
        ip: clientIp(req),
        success,
      },
    })
  } catch {
    /* history is non-critical — never block sign-in */
  }
}
