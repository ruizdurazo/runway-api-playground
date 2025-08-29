import type { Metadata } from "next"

import Sidebar from "@/components/Sidebar"

import styles from "./layout.module.scss"

export const metadata: Metadata = {
  title: "Dashboard - Runway API Playground",
  description: "Access your dashboard in the Runway API Playground to manage chats, gallery, and settings."
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className={styles.dashboardContainer}>
      <Sidebar />
      <main className={styles.mainContent}>{children}</main>
    </div>
  )
}
