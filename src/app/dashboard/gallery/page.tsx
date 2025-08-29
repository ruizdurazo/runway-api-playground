import type { Metadata } from "next"

import Client from "./client"

export const metadata: Metadata = {
  title: "Gallery - Runway API Playground",
  description: "Browse your generated AI images and videos in the gallery."
}

export default function Page() {
  return <Client />
}
