
"use client"

import * as React from "react"
import { Loader2, ChevronLeft, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, query, orderBy } from "firebase/firestore"
import { useRouter } from "next/navigation"

/**
 * @fileOverview Strictly controlled Group-Specific Cycle Audit Page.
 * 
 * Displays ONLY the group name and a chronological list of cycle date ranges.
 * Explicitly sanitizes data to prevent rendering of unauthorized fields.
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

  // TASK 1: Data Sanitization - Map to ONLY specific fields
  const safeCycles = React.useMemo(() => {
    if (!Array.isArray(allCycles)) return []
    return allCycles
      .filter((c) => String(c?.name || "").trim() === groupName)
      .map((c) => ({
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

  // TASK 2 & 3: Strict Render - Only show groupName and sanitized list
  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in duration-500 pb-10 overflow-x-hidden">
      <div className="flex items-center gap-4">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => router.push('/cycles')}
          className="rounded-full h-10 w-10 hover:bg-primary/10 text-primary transition-all active:scale-90"
        >
          <ChevronLeft className="size-6" />
        </Button>
        <h2 className="text-2xl font-black tracking-tight text-primary font-headline uppercase">
          {groupName} Audit
        </h2>
      </div>

      <div className="space-y-4">
        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/70 px-1">
          Chronological Period Log
        </h3>
        
        {safeCycles.length > 0 ? (
          <div className="grid gap-3">
            {safeCycles.map((cycle, i) => (
              <div 
                key={i} 
                className="flex items-center justify-between p-6 rounded-2xl border border-border/60 bg-card shadow-sm hover:shadow-md transition-all"
              >
                <div className="flex items-center gap-4">
                  <span className="font-bold text-sm tracking-tight tabular-nums">
                    {cycle.startDate}
                  </span>
                  <ArrowRight className="size-3 text-muted-foreground/40" />
                  <span className="font-bold text-sm tracking-tight text-primary tabular-nums">
                    {cycle.endDate}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-20 text-center border-2 border-dashed rounded-3xl bg-muted/5 text-muted-foreground/60">
            <p className="text-[10px] font-black uppercase tracking-widest italic">
              No cycles found
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
