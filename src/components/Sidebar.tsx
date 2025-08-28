"use client"

import { Button } from "@/components/ui/button"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"

export default function Sidebar() {
  const router = useRouter()
  return (
    <aside className="w-64 bg-background-sidebar border-r h-screen">
      <div className="p-4">
        <h2 className="text-lg font-bold">Runway API Playground</h2>
      </div>
      <nav className="p-4">
        <ul className="space-y-2">
          <li>
            <Link href="/dashboard">
              <Button variant="ghost" className="w-full justify-start">Chat</Button>
            </Link>
          </li>
          <li>
            <Link href="/dashboard/gallery">
              <Button variant="ghost" className="w-full justify-start">Gallery</Button>
            </Link>
          </li>
          <li>
            <Link href="/dashboard/settings">
              <Button variant="ghost" className="w-full justify-start">Settings</Button>
            </Link>
          </li>
        </ul>
      </nav>
      <div className="p-4 mt-auto">
        <Button variant="ghost" className="w-full justify-start" onClick={async () => {
          await supabase.auth.signOut()
          router.push("/login")
        }}>Logout</Button>
      </div>
    </aside>
  )
}
