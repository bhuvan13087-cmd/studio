
"use client"

import { useState } from "react"
import { Loader2, FolderKanban, CalendarDays, ChevronRight, Database, History } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, query, orderBy } from "firebase/firestore"
import { format, parseISO } from "date-fns"
import { cn } from "@/lib/utils"

/**
 * @fileOverview Cycles Audit Dashboard
 * 
 * Provides a streamlined view of historical operational periods grouped by scheme name.
 */
export default function CyclesPage() {
  const [selectedGroupName, setSelectedGroupName] = useState<string | null>(null)
  const db = useFirestore()

  // Fetch unique groups from schemes
  const roundsQuery = useMemoFirebase(() => query(collection(db, 'chitRounds'), orderBy('name', 'asc')), [db])
  const { data: rounds, isLoading: roundsLoading } = useCollection(roundsQuery)

  // Fetch all historical cycles
  const cyclesQuery = useMemoFirebase(() => query(collection(db, 'cycles'), orderBy('startDate', 'desc')), [db])
  const { data: cycles, isLoading: cyclesLoading } = useCollection(cyclesQuery)

  // Extract unique group names
  const groupNames = Array.from(new Set((rounds || []).map(r => r.name)))

  // Filter cycles for the selected group
  const filteredCycles = (cycles || []).filter(c => c.name === selectedGroupName)

  if (roundsLoading || cyclesLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-10 overflow-x-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-primary font-headline uppercase">
            Cycles Audit
          </h2>
          <p className="text-sm text-muted-foreground font-medium">
            Historical monitoring and operational period records.
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-[300px_1fr]">
        {/* TASK 1: Group Names Only Selector */}
        <div className="space-y-4">
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/70 px-1">
            Scheme Registry
          </h3>
          <div className="grid gap-2">
            {groupNames.length > 0 ? (
              groupNames.map((name) => (
                <button
                  key={name}
                  onClick={() => setSelectedGroupName(name)}
                  className={cn(
                    "flex items-center justify-between w-full p-4 rounded-2xl border transition-all text-left group",
                    selectedGroupName === name 
                      ? "bg-primary text-primary-foreground border-primary shadow-lg scale-[1.02]" 
                      : "bg-card border-border/60 hover:border-primary/50 hover:bg-muted/30"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <FolderKanban className={cn("size-5", selectedGroupName === name ? "text-primary-foreground" : "text-primary")} />
                    <span className="font-bold tracking-tight uppercase text-xs">{name}</span>
                  </div>
                  <ChevronRight className={cn("size-4 opacity-0 group-hover:opacity-100 transition-opacity", selectedGroupName === name && "opacity-100")} />
                </button>
              ))
            ) : (
              <div className="p-8 text-center border-2 border-dashed rounded-2xl text-muted-foreground/60 italic text-xs font-bold uppercase tracking-widest">
                No active schemes found
              </div>
            )}
          </div>
        </div>

        {/* TASK 2: Cycle History List */}
        <div className="space-y-4">
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/70 px-1">
            {selectedGroupName ? `${selectedGroupName} Period History` : "Select a group to view history"}
          </h3>
          
          {selectedGroupName ? (
            <div className="grid gap-3">
              {filteredCycles.length > 0 ? (
                filteredCycles.map((cycle) => (
                  <Card key={cycle.id} className="border-border/60 hover:shadow-md transition-all rounded-2xl overflow-hidden group">
                    <CardContent className="p-0">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between p-5 gap-4">
                        <div className="flex items-center gap-4">
                          <div className="h-10 w-10 rounded-xl bg-primary/5 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                            <CalendarDays className="size-5" />
                          </div>
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sm tracking-tight">
                                {cycle.startDate ? format(parseISO(cycle.startDate), 'MMM dd, yyyy') : 'N/A'}
                              </span>
                              <ChevronRight className="size-3 text-muted-foreground/40" />
                              <span className="font-bold text-sm tracking-tight text-primary">
                                {cycle.endDate ? format(parseISO(cycle.endDate), 'MMM dd, yyyy') : 'N/A'}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">
                              <History className="size-3" />
                              Entry Recorded: {cycle.createdAt ? format(new Date(cycle.createdAt), 'MMM dd, hh:mm a') : 'N/A'}
                            </div>
                          </div>
                        </div>
                        <Badge variant="outline" className={cn(
                          "text-[9px] font-black uppercase tracking-widest h-6 px-3 border-none",
                          cycle.status === 'active' ? "bg-emerald-50 text-emerald-700 shadow-sm" : "bg-muted text-muted-foreground"
                        )}>
                          {cycle.status || 'Archived'}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <Card className="border-2 border-dashed rounded-3xl bg-muted/5 shadow-none">
                  <CardContent className="h-[200px] flex flex-col items-center justify-center space-y-3">
                    <Database className="size-8 text-muted-foreground/30" />
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 italic">
                      No cycle records found
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          ) : (
            <Card className="border-2 border-dashed rounded-3xl bg-muted/5 shadow-none">
              <CardContent className="h-[300px] flex flex-col items-center justify-center space-y-4">
                <div className="p-5 rounded-3xl bg-primary/5 border border-primary/10">
                  <FolderKanban className="size-8 text-primary/40" />
                </div>
                <div className="text-center space-y-1">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">
                    Audit Entry Required
                  </p>
                  <p className="text-xs text-muted-foreground italic font-medium px-10">
                    Please select a scheme from the registry to explore its chronological operational history.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
