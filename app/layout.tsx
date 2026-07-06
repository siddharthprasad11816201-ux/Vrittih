import type { Metadata, Viewport } from "next"
import "@/styles/globals.css"
import "@/styles/vrittih.css"

export const metadata: Metadata = {
  title: "Vrittih — Every industry. Every professional. One network.",
  description: "One platform for every job seeker and every employer — verified identities, transparent 7-tier hiring, live status from first click to offer letter.",
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#04342C",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}