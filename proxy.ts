import { NextRequest, NextResponse } from "next/server"
import { verifyToken } from "@/lib/jwt"

const PROTECTED = ["/dashboard", "/profile/edit", "/api/jobs", "/api/applications", "/api/users"]

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl
  const isProtected = PROTECTED.some(p => pathname.startsWith(p))
  if (!isProtected) return NextResponse.next()

  const token = req.cookies.get("er_token")?.value
  if (!token) return NextResponse.redirect(new URL("/login?reason=auth", req.url))

  const payload = verifyToken(token)
  if (!payload) {
    const res = NextResponse.redirect(new URL("/login?reason=expired", req.url))
    res.cookies.delete("er_token")
    return res
  }

  const headers = new Headers(req.headers)
  headers.set("x-user-id", payload.userId)
  headers.set("x-user-role", payload.role)
  headers.set("x-user-paid", String(payload.paid))

  return NextResponse.next({ request: { headers } })
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}