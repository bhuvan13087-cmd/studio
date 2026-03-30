
"use client"

import * as React from "react"
import { Loader2, ChevronLeft, CalendarDays, IndianRupee, History } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, query, orderBy } from "firebase/firestore"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"

/**
 * @fileOverview Specialized Cycle Audit Details Page.
 * 
 * Provides a granular view of a specific historical period.
 * Implements FULL crash protection and strict data rendering.
 */
export default function CycleDetailsPage({ params }: { params: Promise<{ groupName: string, cycleId: string }> }) {
  const router = useRouter()
  const resolvedParams = React.use(params)
  
  // Safe Param Handling
  const rawGroup = resolvedParams?.groupName || ""
  const rawCycle = resolvedParams?.cycleId || ""

  const groupName = decodeURIComponent(rawGroup).trim()
  const cycleId = decodeURIComponent(rawCycle).trim()

  const db = useFirestore()

  // Fetch all cycles to find the specific one (Safe memory lookup for prototype)
  const cyclesQuery = useMemoFirebase(() => query(collection(db, 'cycles'), orderBy('startDate', 'desc')), [db])
  const { data: allCycles, isLoading } = useCollection(cyclesQuery)

  // TASK 4 & 5: Safe Data Fetch and Lookup
  const selectedCycle = React.useMemo(() => {
    const list = Array.isArray(allCycles) ? allCycles : []
    return list.find(
      (c) =>
        String(c?.name || "").trim() === groupName &&
        (String(c?.id || "") === cycleId || String(c?.startDate || "") === cycleId)
    )
  }, [allCycles, groupName, cycleId])

  if (!groupName || !cycleId) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
        <p className="text-sm font-black text-destructive uppercase tracking-widest">Invalid Audit Data</p>
        <Button variant="outline" onClick={() => router.push('/cycles')}>Return to Registry</Button>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    )
  }

  // TASK 6: No Crash UI
  if (!selectedCycle) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
        <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
          <History className="size-8 text-muted-foreground/40" />
        </div>
        <div className="text-center space-y-1">
          <p className="text-sm font-black uppercase tracking-widest text-foreground">No Cycle Data Located</p>
          <p className="text-xs text-muted-foreground italic">The requested audit period could not be verified.</p>
        </div>
        <Button 
          variant="outline" 
          onClick={() => router.push(`/cycles/${encodeURIComponent(groupName)}`)}
          className="rounded-xl h-11 px-6 font-bold"
        >
          Back to History
        </Button>
      </div>
    )
  }

  // TASK 7: Safe Render (ONLY REQUIRED DATA)
  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in duration-500 pb-10 overflow-x-hidden">
      <div className="flex items-center gap-4">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => router.push(`/cycles/${encodeURIComponent(groupName)}`)}
          className="rounded-full h-10 w-10 hover:bg-primary/10 text-primary transition-all active:scale-90"
        >
          <ChevronLeft className="size-6" />
        </Button>
        <div className="space-y-0.5">
          <h2 className="text-2xl font-black tracking-tight text-primary font-headline uppercase">
            Audit Detail
          </h2>
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">
            {groupName} Registry
          </p>
        </div>
      </div>

      <div className="grid gap-6">
        {/* Core Cycle Stats */}
        <Card className="border-border/60 shadow-lg rounded-3xl overflow-hidden bg-card">
          <CardHeader className="bg-muted/10 border-b border-border/40 p-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="h-14 w-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shadow-inner">
                  <CalendarDays className="size-7" />
                </div>
                <div>
                  <CardTitle className="text-xl font-black uppercase tracking-tight">Period Registry</CardTitle>
                  <CardDescription className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary/70">
                    Operational Date Range
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-3 bg-white px-5 py-2.5 rounded-2xl border shadow-sm self-start sm:self-auto">
                <span className="text-sm font-black tabular-nums">{selectedCycle?.startDate || "N/A"}</span>
                <span className="text-muted-foreground/30 font-bold">→</span>
                <span className="text-sm font-black tabular-nums text-primary">{selectedCycle?.endDate || "N/A"}</span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-8">
            <div className="flex flex-col items-center justify-center p-10 bg-primary/[0.02] rounded-3xl border border-dashed border-primary/10 text-center">
              <div className="flex items-center gap-2 mb-3">
                <IndianRupee className="size-4 text-emerald-600" />
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/60">Total Collection Logged</p>
              </div>
              <div className="text-6xl font-black text-primary tabular-nums tracking-tighter">
                ₹{(selectedCycle?.total || 0).toLocaleString()}
              </div>
              <p className="mt-4 text-[10px] font-bold uppercase tracking-widest text-emerald-600/70 italic">
                Verified Cycle Amount
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Audit Disclaimer */}
        <div className="p-6 rounded-2xl bg-muted/20 border border-border/40 flex items-start gap-4">
          <History className="size-5 text-muted-foreground/40 shrink-0 mt-0.5" />
          <p className="text-[11px] text-muted-foreground leading-relaxed italic font-medium">
            This detailed registry shows the historical snapshots for the specified period. Total collection is calculated based on payments verified within this operational window.
          </p>
        </div>
      </div>
    </div>
  )
}
