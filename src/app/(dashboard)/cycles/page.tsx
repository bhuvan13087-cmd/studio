
"use client"

import { Loader2, FolderKanban, ChevronRight } from "lucide-react"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, query, orderBy } from "firebase/firestore"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"

/**
 * @fileOverview Cycles Registry Dashboard
 * 
 * Provides a high-level list of schemes. Clicking a scheme navigates to its full audit history.
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
    <div className="space-y-8 animate-in fade-in duration-500 pb-10 overflow-x-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-primary font-headline uppercase">
            Cycles Registry
          </h2>
          <p className="text-sm text-muted-foreground font-medium">
            Select a scheme to view its chronological operational history.
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {groupNames.length > 0 ? (
          groupNames.map((name) => (
            <button
              key={name}
              onClick={() => handleGroupClick(name)}
              className="flex items-center justify-between w-full p-6 rounded-2xl border border-border/60 bg-card hover:border-primary/50 hover:bg-muted/30 hover:shadow-lg transition-all text-left group active:scale-[0.98]"
            >
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-primary/5 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  <FolderKanban className="size-6" />
                </div>
                <div className="space-y-0.5">
                  <span className="font-black tracking-tight uppercase text-xs block">Scheme Audit</span>
                  <span className="font-bold text-sm text-primary">{name}</span>
                </div>
              </div>
              <ChevronRight className="size-5 text-muted-foreground/30 group-hover:text-primary transition-colors" />
            </button>
          ))
        ) : (
          <div className="col-span-full p-20 text-center border-2 border-dashed rounded-3xl bg-muted/5 text-muted-foreground/60">
            <FolderKanban className="size-12 mx-auto mb-4 opacity-20" />
            <p className="italic text-sm font-bold uppercase tracking-widest">No active schemes found in registry</p>
          </div>
        )}
      </div>
    </div>
  )
}
