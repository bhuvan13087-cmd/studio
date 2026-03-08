
"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function Home() {
  const router = useRouter()

  useEffect(() => {
    // In a real app, check auth state here
    router.replace("/login")
  }, [router])

  return null
}
