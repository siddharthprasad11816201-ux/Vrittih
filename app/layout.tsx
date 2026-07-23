import type { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"
import "@/styles/globals.css"
import "@/styles/vrittih.css"
// Loaded last so its !important mobile rules win over inline styles.
import "@/styles/mobile.css"

// The design system specifies Inter 400/500/600/700. next/font downloads it at
// build time and self-hosts it, so there is no runtime request to Google and the
// app keeps working offline / behind a strict CSP.
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
})
import PWARegister from "@/components/PWARegister"
import InstallPrompt from "@/components/InstallPrompt"

export const metadata: Metadata = {
  title: "Vrittih — Every industry. Every professional. One network.",
  description: "One platform for every job seeker and every employer — verified identities, transparent 7-tier hiring, live status from first click to offer letter.",
  manifest: "/manifest.webmanifest",
  applicationName: "Vrittih",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Vrittih" },
  icons: { icon: "/icons/icon-512.png", apple: "/icons/apple-touch-icon.png" },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#0F6E56",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        {children}
        <PWARegister />
        <InstallPrompt />
      </body>
    </html>
  )
}
