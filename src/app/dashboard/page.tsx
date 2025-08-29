import type { Metadata } from "next"

import Client from "./client"

export const metadata: Metadata = {
  title: "Chats - Runway API Playground",
  description: "Manage and view your AI prompt chats in the Runway API Playground dashboard."
}

export default function Page() {
  return <Client />
}
