import type { Metadata } from "next"
import "@/styles/globals.css"
import "@/styles/vrittih.css"

export const metadata: Metadata = {
  title: "Vrittih — Every Industry, Every Opportunity",
  description: "One platform for every job seeker and every employer.",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}