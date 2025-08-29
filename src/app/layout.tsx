import type { Metadata } from "next"

import "./globals.scss"

import { Toaster } from "@/components/ui/Sonner"
import { ThemeProvider } from "@/components/ThemeProvider"

export const metadata: Metadata = {
  title: "Runway API Playground",
  description: "Generate AI videos and images with the Runway API",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body>
        <ThemeProvider>
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  )
}
