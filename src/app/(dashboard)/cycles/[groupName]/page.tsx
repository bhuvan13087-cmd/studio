
"use client"

import * as React from "react"
import { Loader2, ChevronLeft, ArrowRight, ChevronRight, Calendar, History, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, query, orderBy } from "firebase/firestore"
import { useRouter } from "next/navigation"
import { format, parseISO, isValid } from "date-fns"
import { cn } from "@/lib/utils"

/**
 * @fileOverview Refined Group-Specific Cycle Audit Page.
 * 
 * Displays a chronological list of cycle date ranges with improved visual hierarchy.
 */
export default function GroupCyclesPage({ params }: { params: Promise<{ groupName: string }> }) {
  const router = useRouter()
  const resolvedParams = React.use(params)
  
  // Safe Param Handling
  const rawGroupName = resolvedParams?.groupName || ""
  const groupName = decodeURIComponent(rawGroupName).trim()

  const db = useFirestore()

  // Fetch all cycles safely
  const cyclesQuery = useMemoFirebase(() => query(collection(db, 'cycles'), orderBy('startDate', 'desc')), [db])
  const { data: allCycles, isLoading } = useCollection(cyclesQuery)

  // Data Sanitization - Map to ONLY specific fields
  const safeCycles = React.useMemo(() => {
    if (!Array.isArray(allCycles)) return []
    return allCycles
      .filter((c) => String(c?.name || "").trim() === groupName)
      .map((c) => ({
        id: String(c?.id || ""),
        startDate: String(c?.startDate || "-"),
        endDate: String(c?.endDate || "-")
      }))
  }, [allCycles, groupName])

  if (!groupName) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
        <p className="text-sm font-black text-destructive uppercase tracking-widest">Invalid Group Identifier</p>
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

  const handleCycleClick = (cycle: { id: string, startDate: string }) => {
    const safeGroupName = String(groupName || "")
    const safeCycleId = String(cycle?.id || cycle?.startDate || "")

    if (!safeGroupName || !safeCycleId) return

    router.push(`/cycles/${encodeURIComponent(safeGroupName)}/${encodeURIComponent(safeCycleId)}`)
  }

  const formatDateLabel = (dateStr: string) => {
    if (!dateStr || dateStr === "-") return "-"
    try {
      const date = parseISO(dateStr)
      if (!isValid(date)) return dateStr
      return format(date, 'dd MMM yyyy')
    } catch {
      return dateStr
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-10 animate-in fade-in duration-500 pb-10 overflow-x-hidden">
      {/* Header Section */}
      <div className="flex items-center gap-5">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => router.push('/cycles')}
          className="rounded-full h-12 w-12 hover:bg-primary/10 text-primary transition-all active:scale-90 bg-white shadow-sm border border-border/40"
        >
          <ChevronLeft className="size-6" />
        </Button>
        <div className="space-y-1">
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-primary font-headline uppercase">
            {groupName} Registry
          </h2>
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 flex items-center gap-2">
            <History className="size-3" /> Audit History Logs
          </p>
        </div>
      </div>

      {/* Cycle List Section */}
      <div className="space-y-6">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-[11px] font-black uppercase tracking-[0.25em] text-muted-foreground/80">
            Chronological Periods
          </h3>
          <span className="text-[10px] font-bold text-primary/40 uppercase tracking-widest">
            {safeCycles.length} Records Found
          </span>
        </div>
        
        {safeCycles.length > 0 ? (
          <div className="grid gap-4">
            {safeCycles.map((cycle, i) => (
              <button 
                key={i} 
                onClick={() => handleCycleClick(cycle)}
                className="group relative flex items-center justify-between w-full p-6 rounded-3xl border border-border/60 bg-card hover:border-primary/40 hover:bg-muted/30 shadow-sm hover:shadow-xl transition-all duration-300 text-left active:scale-[0.99] overflow-hidden"
              >
                {/* Decorative Accent */}
                <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-primary/10 group-hover:bg-primary transition-colors" />
                
                <div className="flex flex-col sm:flex-row sm:items-center gap-6 sm:gap-12 pl-2">
                  {/* Start Date Block */}
                  <div className="space-y-1.5">
                    <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50 flex items-center gap-1.5">
                      <Clock className="size-2.5" /> Start Date
                    </p>
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-xl bg-primary/5 flex items-center justify-center text-primary/60 group-hover:text-primary transition-colors">
                        <Calendar className="size-4" />
                      </div>
                      <span className="font-black text-base tracking-tight tabular-nums text-foreground/80">
                        {formatDateLabel(cycle.startDate)}
                      </span>
                    </div>
                  </div>

                  <div className="hidden sm:flex items-center text-primary/20">
                    <ArrowRight className="size-5" />
                  </div>

                  {/* End Date Block */}
                  <div className="space-y-1.5">
                    <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50 flex items-center gap-1.5">
                      <History className="size-2.5" /> End Date
                    </p>
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-xl bg-primary/5 flex items-center justify-center text-primary/60 group-hover:text-primary transition-colors">
                        <Calendar className="size-4" />
                      </div>
                      <span className="font-black text-base tracking-tight tabular-nums text-primary">
                        {formatDateLabel(cycle.endDate)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="hidden sm:inline text-[9px] font-black uppercase tracking-widest text-primary/0 group-hover:text-primary/60 transition-all">
                    View Audit
                  </span>
                  <div className="h-10 w-10 rounded-full border border-border/40 flex items-center justify-center bg-white group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-300">
                    <ChevronRight className="size-5" />
                  </div>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="p-24 text-center border-2 border-dashed rounded-[3rem] bg-muted/5 text-muted-foreground/40 space-y-4">
            <History className="size-12 mx-auto opacity-20" />
            <p className="text-[11px] font-black uppercase tracking-[0.2em] italic">
              No historical cycles located
            </p>
          </div>
        )}
      </div>

      {/* Safety Note */}
      <div className="p-6 rounded-[2rem] bg-primary/5 border border-primary/10 flex items-start gap-4">
        <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
          <Clock className="size-4" />
        </div>
        <p className="text-[10px] text-muted-foreground font-medium leading-relaxed italic">
          These records represent isolated operational windows verified by the administration. Clicking a period will open the granular collection board.
        </p>
      </div>
    </div>
  )
}
