import type { Metadata } from "next"
import Link from "next/link"

import styles from "./page.module.scss"

export const metadata: Metadata = {
  title: "Home - Runway API Playground",
  description: "Welcome to the Runway API Playground, where you can experiment with generating AI videos and images using the Runway API."
}

export default function Home() {
  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Welcome to Runway API Playground</h1>
      <Link href="/login" className={styles.loginButton}>
        Login
      </Link>
    </div>
  )
}
