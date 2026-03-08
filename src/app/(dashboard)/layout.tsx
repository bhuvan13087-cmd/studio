
"use client"

import { useState, useEffect } from "react"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
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
          <header className="flex h-16 shrink-0 items-center justify-between border-b px-6 sticky top-0 bg-background/80 backdrop-blur-md z-30">
            <div className="flex items-center gap-4">
              <h1 className="font-headline font-semibold text-lg hidden sm:block text-primary">
                Admin Panel
              </h1>
            </div>
            <div className="flex items-center gap-4">
               <div className="flex items-center gap-3 bg-muted/50 px-5 py-2 rounded-2xl border shadow-inner transition-all hover:bg-muted/70">
                  <div className="flex flex-col items-end">
                    <span className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] leading-none mb-1">
                       {currentTime ? format(currentTime, 'EEEE') : '...'}
                    </span>
                    <span className="text-sm font-bold text-foreground tabular-nums leading-none tracking-tight">
                       {currentTime ? format(currentTime, 'MMMM dd, yyyy') : '...'}
                    </span>
                  </div>
               </div>
            </div>
          </header>
          <main className="flex-1 p-6 md:p-8 lg:p-10 max-w-7xl mx-auto w-full">
            {children}
          </main>
        </SidebarInset>
      </div>
      <Toaster />
    </SidebarProvider>
  )
}
