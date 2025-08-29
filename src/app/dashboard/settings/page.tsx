import type { Metadata } from "next"

import Client from "./client"

export const metadata: Metadata = {
  title: "Settings - Runway API Playground",
  description: "Update your account settings and Runway API key."
}

export default function Page() {
  return <Client />
}
