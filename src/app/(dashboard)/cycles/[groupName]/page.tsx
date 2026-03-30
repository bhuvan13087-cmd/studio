
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
 * Displays a chronological list of cycle date ranges with a compact, professional UI.
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
    <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in duration-500 pb-10 overflow-x-hidden">
      {/* Header Section */}
      <div className="flex items-center gap-4">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => router.push('/cycles')}
          className="rounded-full h-10 w-10 hover:bg-primary/10 text-primary transition-all active:scale-90"
        >
          <ChevronLeft className="size-6" />
        </Button>
        <div className="space-y-0.5">
          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-primary font-headline uppercase">
            {groupName}
          </h2>
          <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 flex items-center gap-1.5">
            <History className="size-2.5" /> Registry History
          </p>
        </div>
      </div>

      {/* Cycle List Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-[9px] font-black uppercase tracking-[0.25em] text-muted-foreground/80">
            Audit Periods
          </h3>
          <span className="text-[9px] font-bold text-primary/40 uppercase tracking-widest">
            {safeCycles.length} Records
          </span>
        </div>
        
        {safeCycles.length > 0 ? (
          <div className="grid gap-2">
            {safeCycles.map((cycle, i) => (
              <button 
                key={i} 
                onClick={() => handleCycleClick(cycle)}
                className="group relative flex items-center justify-between w-full p-4 rounded-xl border border-border/50 bg-card hover:border-primary/30 hover:shadow-sm transition-all duration-200 text-left active:scale-[0.99] overflow-hidden"
              >
                {/* Subtle Left Accent */}
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary/10 group-hover:bg-primary transition-colors" />
                
                <div className="flex items-center gap-6 pl-2">
                  <div className="flex items-center gap-4">
                    <div className="flex flex-col">
                      <span className="text-[8px] font-black uppercase tracking-[0.15em] text-muted-foreground/50 mb-0.5">Start</span>
                      <span className="text-xs font-bold tabular-nums text-foreground/80 group-hover:text-foreground transition-colors">
                        {formatDateLabel(cycle.startDate)}
                      </span>
                    </div>

                    <div className="h-px w-4 bg-border/60" />

                    <div className="flex flex-col">
                      <span className="text-[8px] font-black uppercase tracking-[0.15em] text-muted-foreground/50 mb-0.5">End</span>
                      <span className="text-xs font-bold tabular-nums text-primary">
                        {formatDateLabel(cycle.endDate)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[8px] font-black uppercase tracking-[0.2em] text-primary/0 group-hover:text-primary/60 transition-all">
                    View
                  </span>
                  <ChevronRight className="size-4 text-muted-foreground/20 group-hover:text-primary transition-colors" />
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="p-16 text-center border-2 border-dashed rounded-3xl bg-muted/5 text-muted-foreground/40 space-y-3">
            <History className="size-8 mx-auto opacity-20" />
            <p className="text-[9px] font-black uppercase tracking-[0.2em] italic">
              No historical records
            </p>
          </div>
        )}
      </div>

      {/* Safety Footer */}
      <div className="p-4 rounded-2xl bg-primary/5 border border-primary/10 flex items-start gap-3">
        <Clock className="size-4 text-primary/40 shrink-0 mt-0.5" />
        <p className="text-[9px] text-muted-foreground font-medium leading-relaxed italic">
          These records represent verified operational windows. Select a period to view the granular audit breakdown.
        </p>
      </div>
    </div>
  )
}
