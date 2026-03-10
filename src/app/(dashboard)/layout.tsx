
"use client"

import { useState, useEffect } from "react"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { Toaster } from "@/components/ui/toaster"
import { useUser } from "@/firebase"
import { useRouter } from "next/navigation"
import { format } from "date-fns"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, isUserLoading } = useUser()
  const router = useRouter()
  const [currentTime, setCurrentTime] = useState<Date | null>(null)

  useEffect(() => {
    setCurrentTime(new Date())
    const timer = setInterval(() => setCurrentTime(new Date()), 60000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push("/login")
    }
  }, [user, isUserLoading, router])

  if (isUserLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-pulse text-muted-foreground italic">Authenticating...</div>
      </div>
    )
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background font-body">
        <AppSidebar />
        <SidebarInset className="flex flex-col">
          <header className="flex h-16 shrink-0 items-center justify-between border-b px-4 sm:px-6 sticky top-0 bg-background/80 backdrop-blur-md z-30">
            <div className="flex items-center gap-2 sm:gap-4">
              <SidebarTrigger className="-ml-1" />
              <h1 className="font-headline font-semibold text-lg hidden xs:block text-primary">
                Admin Panel
              </h1>
            </div>
            <div className="flex items-center gap-4">
               <div className="flex items-center gap-2 bg-muted/50 px-3 sm:px-4 py-1.5 rounded-full border shadow-sm transition-all hover:bg-muted/70">
                  <span className="text-[10px] sm:text-xs font-bold text-primary uppercase tracking-wider">
                    {currentTime ? format(currentTime, 'EEE') : '...'}
                  </span>
                  <span className="text-xs text-muted-foreground">|</span>
                  <span className="text-[10px] sm:text-xs font-medium text-foreground tabular-nums">
                    {currentTime ? format(currentTime, 'MMM dd, yyyy') : '...'}
                  </span>
               </div>
            </div>
          </header>
          <main className="flex-1 p-4 md:p-8 lg:p-10 max-w-7xl mx-auto w-full">
            {children}
          </main>
        </SidebarInset>
      </div>
      <Toaster />
    </SidebarProvider>
  )
}
