import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Vrittih — Every industry. Every professional. One network.",
    short_name: "Vrittih",
    description: "Verified hiring, networking, HRMS and career growth on one trusted platform.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#04342C",
    theme_color: "#0F6E56",
    categories: ["business", "productivity"],
    icons: [
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  }
}
