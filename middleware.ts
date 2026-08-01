import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

/* Host-based white-label routing. Requests to Vrittih's own hosts pass straight
 * through. A request arriving on any OTHER host is a partner's custom domain, so
 * we rewrite it to /site/<host>, where a Node-runtime route resolves the tenant
 * from the DB and renders their branded careers site. (Edge middleware can't
 * touch the DB, so it only decides "is this us?" and rewrites.)
 *
 * The partner still has to point their domain (CNAME) and add it in Vercel; this
 * makes it resolve to the right tenant once they do. */

const PRIMARY = new Set(["vrittih.online", "www.vrittih.online", "localhost", "127.0.0.1"])

export function middleware(req: NextRequest) {
  const host = (req.headers.get("host") || "").split(":")[0].toLowerCase()
  if (!host || PRIMARY.has(host) || host.endsWith(".vercel.app")) return NextResponse.next()

  const url = req.nextUrl.clone()
  url.pathname = `/site/${host}`
  return NextResponse.rewrite(url)
}

// Skip API, Next internals and any file with an extension — only page views get
// the host treatment, so a custom domain's apply links (absolute to Vrittih) and
// all assets are untouched.
export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|manifest.webmanifest|.*\\..*).*)"],
}
