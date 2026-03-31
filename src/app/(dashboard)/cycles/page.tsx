
"use client"

import { useState, useEffect } from "react"
import { Loader2, FolderKanban, ChevronRight, History, ShieldCheck, Database, CalendarSearch } from "lucide-react"
import { useFirestore, useCollection, useMemoFirebase, useUser } from "@/firebase"
import { collection, query, orderBy, getDocs, doc, getDoc, setDoc, addDoc, serverTimestamp } from "firebase/firestore"
import { useRouter } from "next/navigation"
import { useRole } from "@/hooks/use-role"
import { cn } from "@/lib/utils"

/**
 * @fileOverview Refined Cycles Registry Dashboard
 * 
 * Provides a structured, professional entry point into the chronological audit system.
 * Includes a one-time safe backfill logic for legacy group history reconciliation.
 */
export default function CyclesPage() {
  const router = useRouter()
  const db = useFirestore()
  const { user } = useUser()
  const { isAdmin } = useRole()
  const [mounted, setMounted] = useState(false)

  // Fetch schemes to get unique group names
  const roundsQuery = useMemoFirebase(() => query(collection(db, 'chitRounds'), orderBy('name', 'asc')), [db])
  const { data: rounds, isLoading: roundsLoading } = useCollection(roundsQuery)

  useEffect(() => {
    setMounted(true)
  }, [])

  // ONE-TIME SAFE BACKFILL: LEGACY HISTORY RECONCILIATION
  useEffect(() => {
    const runBackfill = async () => {
      if (!db || !rounds || roundsLoading || !user || !isAdmin) return;
      
      try {
        // Idempotency Check: Look for a marker in systemMetadata
        const backfillRef = doc(db, 'systemMetadata', 'backfill_v1');
        const backfillSnap = await getDoc(backfillRef);
        if (backfillSnap.exists() && backfillSnap.data().completed) return;

        // Get all unique groups that need history
        const uniqueGroups = Array.from(new Set(rounds.map(r => String(r?.name || "").trim()).filter(Boolean)));
        
        // Get all existing cycles to check coverage
        const cyclesSnap = await getDocs(collection(db, 'cycles'));
        const existingCycleGroups = new Set(cyclesSnap.docs.map(d => d.data().name));

        let createdCount = 0;
        for (const groupName of uniqueGroups) {
          // Only create history if NO cycles exist for this group at all
          if (!existingCycleGroups.has(groupName)) {
            await addDoc(collection(db, 'cycles'), {
              name: groupName,
              startDate: "2026-03-15",
              endDate: "2026-03-29",
              status: "completed",
              type: "backfilled",
              createdAt: new Date().toISOString(),
              completedAt: new Date().toISOString()
            });
            createdCount++;
          }
        }

        // Mark backfill as complete globally
        await setDoc(backfillRef, { 
          completed: true, 
          completedAt: serverTimestamp(),
          admin: user.email,
          recordsCreated: createdCount
        }, { merge: true });

        if (createdCount > 0) {
          console.log(`Legacy cycle backfill completed: ${createdCount} records synchronized.`);
        }
      } catch (e) {
        console.error("Backfill failed:", e);
      }
    };

    if (mounted) {
      runBackfill();
    }
  }, [db, rounds, roundsLoading, user, isAdmin, mounted]);

  // Extract unique group names safely
  const groupNames = Array.from(new Set((rounds || []).map(r => String(r?.name || "").trim()).filter(Boolean)))

  if (roundsLoading || !mounted) {
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
    <div className="max-w-5xl mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20 overflow-x-hidden">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 border-b border-border/60 pb-8">
        <div className="space-y-2">
          <div className="flex items-center gap-2 mb-1">
            <div className="h-5 w-5 rounded bg-primary/10 flex items-center justify-center">
              <ShieldCheck className="size-3 text-primary" />
            </div>
            <span className="text-[9px] font-black uppercase tracking-[0.3em] text-muted-foreground/70">
              Administrative Audit Registry
            </span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-primary font-headline uppercase leading-none">
            Cycles Registry
          </h2>
          <p className="text-xs text-muted-foreground font-medium max-w-lg leading-relaxed">
            Historical period auditing and collection verification. Access a specific unit to inspect chronological ledger logs and daily installments.
          </p>
        </div>
        <div className="hidden lg:flex flex-col items-end gap-1.5 opacity-30">
          <div className="flex items-center gap-2">
            <Database className="size-3" />
            <span className="text-[9px] font-bold uppercase tracking-widest">Protocol Engine Active</span>
          </div>
          <div className="flex items-center gap-2">
            <CalendarSearch className="size-3" />
            <span className="text-[9px] font-bold uppercase tracking-widest">Live Sync 2026</span>
          </div>
        </div>
      </div>

      {/* Group Grid Section */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {groupNames.length > 0 ? (
          groupNames.map((name) => (
            <button
              key={name}
              onClick={() => handleGroupClick(name)}
              className="group relative flex flex-col w-full p-6 rounded-2xl border border-border/60 bg-card hover:border-primary/30 hover:bg-muted/5 shadow-sm transition-all duration-300 text-left active:scale-[0.99] overflow-hidden"
            >
              <div className="flex items-start justify-between mb-6">
                <div className="h-12 w-12 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shadow-lg shadow-primary/10 group-hover:scale-105 transition-transform duration-300">
                  <FolderKanban className="size-6" />
                </div>
                <div className="h-8 w-8 rounded-lg border border-border/40 flex items-center justify-center group-hover:bg-primary group-hover:border-primary transition-all duration-300">
                  <ChevronRight className="size-4 text-muted-foreground/40 group-hover:text-primary-foreground transition-colors" />
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-[9px] font-black tracking-[0.2em] uppercase text-muted-foreground/50">
                  Audit Unit
                </span>
                <span className="font-black text-xl sm:text-2xl text-primary block tracking-tighter uppercase leading-none">
                  {name}
                </span>
                <div className="pt-3 flex items-center gap-2">
                  <span className="h-1 w-1 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[8px] font-black uppercase tracking-widest text-emerald-600/60">
                    Ledger Linked
                  </span>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-border/40 flex items-center justify-between">
                <span className="text-[9px] font-bold text-muted-foreground/40 uppercase tracking-[0.15em]">Historical Log</span>
                <History className="size-3.5 text-muted-foreground/20 group-hover:text-primary transition-colors" />
              </div>
            </button>
          ))
        ) : (
          <div className="col-span-full py-24 text-center border-2 border-dashed border-border/60 rounded-3xl bg-muted/5 text-muted-foreground/60 space-y-4">
            <History className="size-10 mx-auto opacity-10" />
            <div className="space-y-1">
              <p className="text-xs font-black uppercase tracking-widest text-primary/40">No Units Defined</p>
              <p className="text-[10px] italic font-medium opacity-60">Initialize schemes in the Rounds board to begin auditing.</p>
            </div>
          </div>
        )}
      </div>

      {/* Footer Branding */}
      <div className="pt-12 flex items-center justify-center gap-4 opacity-20">
        <div className="h-px w-12 bg-muted-foreground" />
        <span className="text-[9px] font-black uppercase tracking-[0.5em] whitespace-nowrap">
          Management Protocol 2026
        </span>
        <div className="h-px w-12 bg-muted-foreground" />
      </div>
    </div>
  )
}
