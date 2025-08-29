import type { Metadata } from "next"

import Client from "./client"

export const metadata: Metadata = {
  title: "Login - Runway API Playground",
  description: "Log in to access your Runway API Playground account and start generating AI content."
}

export default function Page() {
  return <Client />
}
