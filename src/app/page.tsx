import Link from "next/link"

import styles from "./page.module.scss"

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
