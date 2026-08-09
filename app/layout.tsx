import type { Metadata, Viewport } from "next"
import { Inter, Bricolage_Grotesque } from "next/font/google"
import "@/styles/globals.css"
import "@/styles/vrittih.css"
// Loaded last so its !important mobile rules win over inline styles.
import "@/styles/mobile.css"

// Body/UI face — Inter. next/font self-hosts at build time (no runtime Google
// request, works offline / behind a strict CSP). Two-weight discipline (the
// redesign uses 400/500) but we keep 600 available for legacy surfaces.
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
})

// Display face — Bricolage Grotesque. A single, distinct display family applied
// to every heading across the app AND marketing (fixes the serif-on-sans split).
// Deliberately not the Space-Grotesk/AI-default pick. Weights 400/500 only.
const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-bricolage",
  display: "swap",
})
import PWARegister from "@/components/PWARegister"
import InstallPrompt from "@/components/InstallPrompt"
import { SITE } from "@/lib/site"

export const metadata: Metadata = {
  // Absolute base for canonical + OpenGraph URLs on every page (required for the
  // job pages' canonical links and social cards to resolve correctly).
  metadataBase: new URL(SITE),
  title: {
    default: "Vrittih — Every industry. Every professional. One network.",
    template: "%s · Vrittih",
  },
  description: "One platform for every job seeker and every employer — verified identities, transparent 7-tier hiring, live status from first click to offer letter.",
  alternates: { canonical: "/" },
  manifest: "/manifest.webmanifest",
  applicationName: "Vrittih",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Vrittih" },
  icons: { icon: "/icons/icon-512.png", apple: "/icons/apple-touch-icon.png" },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#6495ED",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${bricolage.variable}`}>
      <body>
        {/* Restore the user's saved theme before paint so "remembered on this device"
            holds on every page, not just /account, with no flash of the wrong theme. */}
        <script dangerouslySetInnerHTML={{ __html: `try{var t=localStorage.getItem('vrittih-theme');if(t==='dark'||t==='light')document.documentElement.setAttribute('data-theme',t)}catch(e){}` }} />
        {children}
        <PWARegister />
        <InstallPrompt />
      </body>
    </html>
  )
}
