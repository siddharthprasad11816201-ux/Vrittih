// Canonical site origin — used for sitemap, robots, canonical URLs and JSON-LD.
// www is canonical (the apex 308-redirects to it). Overridable via env.
export const SITE = (process.env.NEXT_PUBLIC_APP_URL || "https://www.vrittih.online").replace(/\/+$/, "")
export const abs = (path: string) => SITE + (path.startsWith("/") ? path : "/" + path)
