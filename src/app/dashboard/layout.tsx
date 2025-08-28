import Sidebar from "@/components/Sidebar"

import styles from "./layout.module.scss"

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
