"use client"
import { useEffect } from "react"

// Registers the service worker so Vrittih is installable on laptop & phone.
export default function PWARegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => { /* non-fatal */ })
    }
  }, [])
  return null
}
