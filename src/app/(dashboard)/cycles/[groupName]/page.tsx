
"use client"

import * as React from "react"
import { Loader2, CalendarDays, ChevronLeft, History, Database, ArrowRight } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, query, orderBy } from "firebase/firestore"
import { format, parseISO } from "date-fns"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"

/**
 * @fileOverview Group-Specific Cycle Audit Page
 * 
 * Displays the historical date ranges for a specific group safely.
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

  // Safe Data Fetch & Filter
  const cycles = React.useMemo(() => {
    if (!Array.isArray(allCycles)) return []
    return allCycles.filter((c) => String(c?.name || "").trim() === groupName)
  }, [allCycles, groupName])

  if (!groupName) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
        <p className="text-sm font-bold text-destructive uppercase tracking-widest">Invalid Group Identifier</p>
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

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-10 overflow-x-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => router.push('/cycles')}
            className="rounded-full h-10 w-10 hover:bg-primary/10 text-primary transition-all active:scale-90"
          >
            <ChevronLeft className="size-6" />
          </Button>
          <div className="space-y-1">
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-primary font-headline uppercase">
              {groupName} Audit
            </h2>
            <p className="text-sm text-muted-foreground font-medium flex items-center gap-2">
              <History className="size-4" /> Operational Period History
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-3xl space-y-4">
        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/70 px-1">
          Chronological Period Log
        </h3>
        
        {cycles.length > 0 ? (
          <div className="grid gap-3">
            {cycles.map((cycle, i) => (
              <Card key={cycle?.id || i} className="border-border/60 hover:shadow-md transition-all rounded-2xl overflow-hidden group">
                <CardContent className="p-0">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between p-5 gap-4">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-xl bg-primary/5 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                        <CalendarDays className="size-5" />
                      </div>
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm tracking-tight tabular-nums">
                            {cycle?.startDate ? format(parseISO(cycle.startDate), 'MMM dd, yyyy') : 'No date'}
                          </span>
                          <ArrowRight className="size-3 text-muted-foreground/40" />
                          <span className="font-bold text-sm tracking-tight text-primary tabular-nums">
                            {cycle?.endDate ? format(parseISO(cycle.endDate), 'MMM dd, yyyy') : 'No date'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">
                          <Database className="size-3" />
                          Record ID: {String(cycle?.id || "N/A").slice(0, 8)}
                        </div>
                      </div>
                    </div>
                    <Badge variant="outline" className={cn(
                      "text-[9px] font-black uppercase tracking-widest h-6 px-3 border-none",
                      cycle?.status === 'active' ? "bg-emerald-50 text-emerald-700 shadow-sm" : "bg-muted text-muted-foreground"
                    )}>
                      {cycle?.status || 'Archived'}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="border-2 border-dashed rounded-3xl bg-muted/5 shadow-none">
            <CardContent className="h-[200px] flex flex-col items-center justify-center space-y-3">
              <Database className="size-8 text-muted-foreground/30" />
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 italic">
                No cycle records located for this group
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
