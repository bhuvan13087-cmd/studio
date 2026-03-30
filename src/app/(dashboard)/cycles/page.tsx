
"use client"

import { Loader2, FolderKanban, ChevronRight, History, ShieldCheck } from "lucide-react"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, query, orderBy } from "firebase/firestore"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"

/**
 * @fileOverview Refined Cycles Registry Dashboard
 * 
 * Provides a high-level list of schemes with a professional, administrative UI.
 * Clicking a scheme navigates to its full chronological audit history.
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
    <div className="max-w-6xl mx-auto space-y-10 animate-in fade-in duration-700 pb-16 overflow-x-hidden">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 border-b pb-8">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck className="size-4 text-primary opacity-60" />
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/60">Registry Audit System</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-black tracking-tighter text-primary font-headline uppercase leading-none">
            Cycles Registry
          </h2>
          <p className="text-sm text-muted-foreground font-medium max-w-md">
            ChitFund operational history and historical period auditing. Select a scheme unit below to verify recorded ledger cycles.
          </p>
        </div>
      </div>

      {/* Group Grid Section */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {groupNames.length > 0 ? (
          groupNames.map((name) => (
            <button
              key={name}
              onClick={() => handleGroupClick(name)}
              className="group relative flex items-center justify-between w-full p-8 rounded-3xl border border-border/60 bg-card hover:border-primary/40 hover:bg-muted/30 shadow-sm hover:shadow-xl transition-all duration-300 text-left active:scale-[0.98] overflow-hidden"
            >
              {/* Decorative Accent */}
              <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full -mr-12 -mt-12 group-hover:scale-150 transition-transform duration-500" />
              
              <div className="flex items-center gap-6 relative z-10">
                <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-300 shadow-inner">
                  <FolderKanban className="size-7" />
                </div>
                <div className="space-y-1">
                  <span className="text-[9px] font-black tracking-[0.25em] uppercase text-muted-foreground/50 group-hover:text-primary/50 transition-colors">
                    Scheme Audit Unit
                  </span>
                  <span className="font-black text-xl text-primary block tracking-tight uppercase leading-none">
                    {name}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 relative z-10">
                <div className="h-10 w-10 rounded-full border border-border/40 flex items-center justify-center group-hover:bg-primary group-hover:border-primary transition-all duration-300">
                  <ChevronRight className="size-5 text-muted-foreground/40 group-hover:text-primary-foreground transition-colors" />
                </div>
              </div>
            </button>
          ))
        ) : (
          <div className="col-span-full py-24 text-center border-2 border-dashed rounded-[3rem] bg-muted/5 text-muted-foreground/60 space-y-4">
            <div className="h-20 w-20 bg-muted/20 rounded-full flex items-center justify-center mx-auto mb-2">
              <History className="size-10 opacity-20" />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-black uppercase tracking-[0.25em]">No records found</p>
              <p className="text-xs italic font-medium opacity-60">There are no active schemes currently available in the registry.</p>
            </div>
          </div>
        )}
      </div>

      {/* Footer Branding */}
      <div className="pt-8 flex items-center justify-center gap-3 opacity-30">
        <div className="h-px w-8 bg-muted-foreground" />
        <span className="text-[9px] font-black uppercase tracking-[0.4em]">Historical Ledger 2026</span>
        <div className="h-px w-8 bg-muted-foreground" />
      </div>
    </div>
  )
}
