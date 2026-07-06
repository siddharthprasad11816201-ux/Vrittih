"use client"
import type { ReactNode } from "react"
import AppShell from "@/components/vrittih/AppShell"

// CRM pages now live inside the unified Vrittih AppShell.
export default function CrmShell({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>
}
