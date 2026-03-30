
"use client"

import { Loader2, FolderKanban, ChevronRight, History, ShieldCheck, Database, CalendarSearch } from "lucide-react"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, query, orderBy } from "firebase/firestore"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"

/**
 * @fileOverview High-End Cycles Registry Dashboard
 * 
 * Provides a structured, professional entry point into the chronological audit system.
 * Designed for administrative precision and financial clarity.
 */
export default function CyclesPage() {
  const router = useRouter()
  const db = useFirestore()

  // Fetch schemes to get unique group names
  const roundsQuery = useMemoFirebase(() => query(collection(db, 'chitRounds'), orderBy('name', 'asc')), [db])
  const { data: rounds, isLoading: roundsLoading } = useCollection(roundsQuery)

  // Extract unique group names safely
  const groupNames = Array.from(new Set((rounds || []).map(r => String(r?.name || "").trim()).filter(Boolean)))

  if (roundsLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    )
  }

  const handleGroupClick = (name: string) => {
    const safeName = String(name || "").trim()
    if (safeName) {
      router.push(`/cycles/${encodeURIComponent(safeName)}`)
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20 overflow-x-hidden">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-8 border-b border-border/60 pb-10">
        <div className="space-y-3">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-6 w-6 rounded-md bg-primary/10 flex items-center justify-center">
              <ShieldCheck className="size-3.5 text-primary" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-[0.4em] text-muted-foreground/70">
              Administrative Registry Audit
            </span>
          </div>
          <h2 className="text-4xl sm:text-5xl font-black tracking-tighter text-primary font-headline uppercase leading-[0.9]">
            Cycles Registry
          </h2>
          <p className="text-sm text-muted-foreground font-medium max-w-xl leading-relaxed italic">
            Chronological operational history and historical period auditing. Access a specific unit to verify recorded ledger cycles and daily collections.
          </p>
        </div>
        <div className="hidden lg:flex flex-col items-end gap-1.5 opacity-40">
          <div className="flex items-center gap-2">
            <Database className="size-3.5" />
            <span className="text-[10px] font-bold uppercase tracking-widest">PostgreSQL Engine Linked</span>
          </div>
          <div className="flex items-center gap-2">
            <CalendarSearch className="size-3.5" />
            <span className="text-[10px] font-bold uppercase tracking-widest">Real-Time Sync 2026</span>
          </div>
        </div>
      </div>

      {/* Group Grid Section */}
      <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
        {groupNames.length > 0 ? (
          groupNames.map((name) => (
            <button
              key={name}
              onClick={() => handleGroupClick(name)}
              className="group relative flex flex-col w-full p-8 rounded-[2rem] border border-border/60 bg-white hover:border-primary/40 hover:bg-muted/10 shadow-sm hover:shadow-2xl transition-all duration-500 text-left active:scale-[0.98] overflow-hidden"
            >
              {/* Modern Decorative Element */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 group-hover:scale-[2] transition-transform duration-700 ease-in-out" />
              
              <div className="flex items-start justify-between mb-8 relative z-10">
                <div className="h-16 w-16 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center shadow-xl group-hover:scale-110 transition-transform duration-300">
                  <FolderKanban className="size-8" />
                </div>
                <div className="h-10 w-10 rounded-full border border-border/40 flex items-center justify-center group-hover:bg-primary group-hover:border-primary transition-all duration-300">
                  <ChevronRight className="size-5 text-muted-foreground/40 group-hover:text-primary-foreground transition-colors" />
                </div>
              </div>

              <div className="space-y-1.5 relative z-10">
                <span className="text-[10px] font-black tracking-[0.3em] uppercase text-muted-foreground/40 group-hover:text-primary/50 transition-colors">
                  Scheme Audit Unit
                </span>
                <span className="font-black text-2xl text-primary block tracking-tighter uppercase leading-none">
                  {name}
                </span>
                <div className="pt-4 flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[9px] font-black uppercase tracking-widest text-emerald-600/70">
                    Registry Active
                  </span>
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-border/40 relative z-10 flex items-center justify-between">
                <span className="text-[10px] font-black text-muted-foreground/30 uppercase tracking-[0.2em]">View History</span>
                <History className="size-4 text-muted-foreground/20 group-hover:text-primary transition-colors" />
              </div>
            </button>
          ))
        ) : (
          <div className="col-span-full py-32 text-center border-2 border-dashed border-border/60 rounded-[3rem] bg-muted/5 text-muted-foreground/60 space-y-6">
            <div className="h-24 w-24 bg-muted/20 rounded-full flex items-center justify-center mx-auto mb-2 shadow-inner">
              <History className="size-12 opacity-10" />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-black uppercase tracking-[0.3em] text-primary/40">No Audit Units Found</p>
              <p className="text-xs italic font-medium opacity-60">Please initialize scheme groups in the Rounds board to begin period auditing.</p>
            </div>
          </div>
        )}
      </div>

      {/* Footer Branding */}
      <div className="pt-16 flex items-center justify-center gap-6 opacity-20">
        <div className="h-px w-16 bg-muted-foreground" />
        <span className="text-[10px] font-black uppercase tracking-[0.6em] whitespace-nowrap">
          Ledger Management Protocol 2026
        </span>
        <div className="h-px w-16 bg-muted-foreground" />
      </div>
    </div>
  )
}
