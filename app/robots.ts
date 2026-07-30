import type { MetadataRoute } from "next"
import { SITE } from "@/lib/site"

// Allow crawling of public content; keep private/app surfaces out of the index.
// Points crawlers at the sitemap so all job pages are discovered.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/admin/", "/settings", "/dashboard/", "/messages", "/mail", "/pay", "/verify/"],
      },
    ],
    sitemap: `${SITE}/sitemap.xml`,
    host: SITE,
  }
}
