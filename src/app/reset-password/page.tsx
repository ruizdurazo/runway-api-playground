import type { Metadata } from "next"

import Client from "./client"

export const metadata: Metadata = {
  title: "Reset Password - Runway API Playground",
  description: "Set a new password for your Runway API Playground account.",
}

export default function Page() {
  return <Client />
}
