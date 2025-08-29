import type { Metadata } from "next"

import Client from "./client"

export const metadata: Metadata = {
  title: "Chat - Runway API Playground",
  description: "Interact with AI models to generate images and videos using your prompts."
}

export default function Page() {
  return <Client />
}
