
"use client"

import { useState, useEffect } from "react"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { Toaster } from "@/components/ui/toaster"
import { useUser } from "@/firebase"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import { Clock } from "lucide-react"

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
        <SidebarInset className="flex flex-col min-w-0">
          <header className="flex h-16 shrink-0 items-center justify-between border-b px-4 sm:px-6 sticky top-0 bg-background/80 backdrop-blur-md z-40">
            <div className="flex items-center gap-2 sm:gap-4">
              <SidebarTrigger className="-ml-1" />
              <div className="flex flex-col">
                <h1 className="font-headline font-semibold text-base sm:text-lg text-primary truncate max-w-[150px] sm:max-w-none">
                  Admin Panel
                </h1>
                <div className="hidden xs:flex items-center gap-1 text-[9px] font-bold text-muted-foreground uppercase tracking-widest">
                  <Clock className="size-2.5" /> 12:00 AM - 11:59 PM
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-4">
               <div className="flex items-center gap-1.5 sm:gap-2 bg-muted/50 px-2.5 sm:px-4 py-1.5 rounded-full border shadow-sm transition-all hover:bg-muted/70">
                  <span className="text-[9px] sm:text-xs font-bold text-primary uppercase tracking-wider">
                    {currentTime ? format(currentTime, 'EEE') : '...'}
                  </span>
                  <span className="text-xs text-muted-foreground">|</span>
                  <span className="text-[9px] sm:text-xs font-medium text-foreground tabular-nums">
                    {currentTime ? format(currentTime, 'MMM dd, yyyy') : '...'}
                  </span>
               </div>
            </div>
          </header>
          <main className="flex-1 p-4 sm:p-6 md:p-8 lg:p-10 max-w-7xl mx-auto w-full overflow-x-hidden">
            {children}
          </main>
        </SidebarInset>
      </div>
      <Toaster />
    </SidebarProvider>
  )
}
