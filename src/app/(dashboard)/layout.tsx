
"use client"

import { useState, useEffect } from "react"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { Toaster } from "@/components/ui/toaster"
import { useUser, useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { useRouter } from "next/navigation"
import { format, parseISO } from "date-fns"
import { Clock } from "lucide-react"
import { collection, query, writeBatch, doc } from "firebase/firestore"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, isUserLoading } = useUser()
  const router = useRouter()
  const db = useFirestore()
  const [currentTime, setCurrentTime] = useState<Date | null>(null)

  const membersQuery = useMemoFirebase(() => collection(db, 'members'), [db]);
  const { data: members } = useCollection(membersQuery);

  const paymentsQuery = useMemoFirebase(() => collection(db, 'payments'), [db]);
  const { data: payments } = useCollection(paymentsQuery);

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

  /**
   * PRODUCTION 10 PM AUTOMATED CALCULATION
   * Executes daily at 10 PM (Hour 22).
   * Formula: newPendingAmount = Math.max(0, (yesterdayPending + schemeAmount) - todayPaymentSum)
   * Formula: newPendingDays = Math.ceil(newPendingAmount / schemeAmount)
   */
  useEffect(() => {
    if (!user || !members || !payments || !currentTime) return;

    const runProductionBatch = async () => {
      const todayStr = format(currentTime, 'yyyy-MM-dd');
      const scheduledHour = 22; // 10 PM
      
      // Only run at 10 PM or later
      if (currentTime.getHours() < scheduledHour) return;

      const dailyMembers = members.filter(m => 
        m.status === 'active' && 
        m.lastPendingUpdateDate !== todayStr
      );
      
      if (dailyMembers.length === 0) return;

      const batch = writeBatch(db);
      let updatedCount = 0;

      dailyMembers.forEach(member => {
        const schemeAmount = member.monthlyAmount || 800;
        const yesterdayPending = member.pendingAmount || 0;
        
        // Sum today's payments for this member
        const todayPayments = payments.filter(p => 
          p.memberId === member.id && 
          (p.status === 'success' || p.status === 'paid') &&
          (p.targetDate === todayStr || (p.paymentDate && format(parseISO(p.paymentDate), 'yyyy-MM-dd') === todayStr))
        );
        const todayPaymentSum = todayPayments.reduce((acc, p) => acc + (p.amountPaid || 0), 0);

        // PRODUCTION CALCULATION: FIFO Arrears Aging
        // We add today's required installment to the previous arrears, then subtract what was paid today.
        const newPendingAmount = Math.max(0, (yesterdayPending + schemeAmount) - todayPaymentSum);
        
        // Derive days from amount: any fractional part of an installment counts as a pending day
        const newPendingDays = Math.ceil(newPendingAmount / schemeAmount);

        const memberRef = doc(db, 'members', member.id);
        batch.update(memberRef, {
          pendingAmount: newPendingAmount,
          pendingDays: newPendingDays,
          lastPendingUpdateDate: todayStr
        });
        updatedCount++;
      });

      if (updatedCount > 0) {
        await batch.commit();
      }
    };

    runProductionBatch();
  }, [user, members, payments, currentTime, db]);

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
                  <Clock className="size-2.5" /> 10:00 PM Production Sync
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
