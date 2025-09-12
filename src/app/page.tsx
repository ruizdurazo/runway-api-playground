import type { Metadata } from "next"
import Link from "next/link"

import styles from "./page.module.scss"

import { RunwayLogo } from "@/assets/RunwayLogo"

export const metadata: Metadata = {
  title: "Home - Runway API Playground",
  description:
    "Welcome to the Runway API Playground, where you can experiment with generating AI videos and images using the Runway API.",
}

export default function Home() {
  return (
    <div className={styles.container}>
      {/* Hero */}
      <div className={styles.hero}>
        {/* Video */}
        <video
          src="/runwayhero.mp4"
          autoPlay
          loop
          muted
          playsInline
          className={styles.video}
        />
        {/* Logo */}
        <RunwayLogo className={styles.logo} />

        {/* Content */}
        <div className={styles.heroContent}>
          {/* <h1 className={styles.title}>Runway API Playground</h1> */}
          <h1 className={styles.title}>
            Make anything, anywhere.<br /> With the Runway API.
          </h1>
          <Link href="/login" className={styles.loginButton}>
            Enter
          </Link>
        </div>
      </div>
    </div>
  )
}
