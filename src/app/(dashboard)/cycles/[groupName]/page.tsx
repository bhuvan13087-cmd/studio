
"use client"

import * as React from "react"
import { Loader2, ChevronLeft, History, Pencil, Save, ShieldCheck, Archive, Eye } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useFirestore, useCollection, useMemoFirebase, useUser } from "@/firebase"
import { collection, query, orderBy, doc, where, getDocs, writeBatch } from "firebase/firestore"
import { useRouter } from "next/navigation"
import { format, parseISO, subDays } from "date-fns"
import { cn, withTimeout } from "@/lib/utils"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { createAuditLog } from "@/firebase/logging"

const handlePopupBlur = (e: any) => {
  const ae = document.activeElement;
  if (ae instanceof HTMLInputElement || ae instanceof HTMLTextAreaElement || ae instanceof HTMLSelectElement) {
    ae.blur();
    e.preventDefault();
  }
};

export default function GroupCyclesPage({ params }: { params: Promise<{ groupName: string }> }) {
  const router = useRouter()
  const resolvedParams = React.use(params)
  const { toast } = useToast()
  const { user } = useUser()
  
  const rawGroupName = resolvedParams?.groupName || ""
  const groupName = decodeURIComponent(rawGroupName).trim()

  const db = useFirestore()

  const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false)
  const [isActionPending, setIsActionPending] = React.useState(false)
  const [editingCycle, setEditingCycle] = React.useState<{id: string, startDate: string, endDate: string, status?: string} | null>(null)

  const cyclesQuery = useMemoFirebase(() => query(collection(db, 'cycles'), orderBy('startDate', 'desc')), [db])
  const { data: allCycles, isLoading } = useCollection(cyclesQuery)

  const { activeCycles, pastCycles } = React.useMemo(() => {
    if (!Array.isArray(allCycles)) return { activeCycles: [], pastCycles: [] }
    
    const filtered = allCycles.filter((c) => {
      const mGroup = String(c?.name || "").trim().toLowerCase();
      const gName = groupName.toLowerCase();
      const gNameClean = groupName.replace(/Group/gi, '').trim().toLowerCase();
      return (mGroup === gName || mGroup === gNameClean);
    });

    const uniqueMap = new Map<string, any>()
    filtered.forEach((c) => {
      const start = String(c?.startDate || "-")
      const existing = uniqueMap.get(start)
      if (!existing || (c.status === 'active' && existing.status !== 'active')) {
        uniqueMap.set(start, c)
      }
    })

    const sortedUnique = Array.from(uniqueMap.values()).sort((a, b) => 
      String(a.startDate || "").localeCompare(String(b.startDate || ""))
    );

    const numbered = sortedUnique.map((c, i) => ({
      ...c,
      cycleNumber: i + 1
    }));

    return {
      activeCycles: numbered.length > 0 ? [numbered[numbered.length - 1]] : [],
      pastCycles: numbered.length > 1 ? numbered.slice(0, numbered.length - 1).reverse() : []
    }
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

  const handleEditClick = (e: React.MouseEvent, cycle: any) => {
    e.stopPropagation()
    const isLatest = activeCycles.some(ac => ac.id === cycle.id);
    if (!isLatest) {
      toast({ 
        variant: "destructive", 
        title: "Access Restricted", 
        description: "Historical audit periods are locked for integrity." 
      })
      return
    }
    setEditingCycle({ ...cycle })
    setIsEditDialogOpen(true)
  }

  const handleUpdateCycle = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!db || !editingCycle || isActionPending || !user) return
    if (editingCycle.status === 'completed') {
      toast({ variant: "destructive", title: "Update Failed", description: "Cannot modify a completed cycle." });
      return;
    }

    setIsActionPending(true)
    try {
      const batch = writeBatch(db);
      
      const filtered = (allCycles || []).filter((c) => {
        const mGroup = String(c?.name || "").trim().toLowerCase();
        const gName = groupName.toLowerCase();
        const gNameClean = groupName.replace(/Group/gi, '').trim().toLowerCase();
        return (mGroup === gName || mGroup === gNameClean);
      });
      
      const cycles = [...filtered];
      
      // Sort to identify the current sequence
      cycles.sort((a, b) => b.startDate.localeCompare(a.startDate));

      // 1. Directly update the edited cycle
      batch.update(doc(db, 'cycles', editingCycle.id), {
        startDate: editingCycle.startDate,
        endDate: editingCycle.endDate,
        updatedAt: new Date().toISOString()
      });

      // 2. Adjust predecessor for timeline continuity (Rule: P.endDate = C.startDate - 1)
      const currentIdx = cycles.findIndex(c => c.id === editingCycle.id);
      const previousCycle = cycles[currentIdx + 1]; // Next in DESC sorted list is chronologically previous
      
      if (previousCycle && previousCycle.status !== 'completed') {
        const nextStart = parseISO(editingCycle.startDate);
        const fixedEnd = format(subDays(nextStart, 1), 'yyyy-MM-dd');
        
        if (previousCycle.endDate !== fixedEnd) {
          batch.update(doc(db, 'cycles', previousCycle.id), { 
            endDate: fixedEnd,
            updatedAt: new Date().toISOString()
          });
        }
      }

      await withTimeout(batch.commit());
      await createAuditLog(db, user, `Timeline Corrected: Updated current cycle for ${groupName} and auto-adjusted preceding boundary.`);
      
      toast({ title: "Timeline Corrected", description: "Operational periods synchronized." })
      setIsEditDialogOpen(false)
      setEditingCycle(null)
    } catch (error: any) {
      toast({ variant: "destructive", title: "Update Error", description: error.message || "Failed to update record." })
    } finally {
      setIsActionPending(false)
      document.body.style.pointerEvents = 'auto';
    }
  }

  const CycleItem = ({ cycle, isActive }: { cycle: any, isActive: boolean }) => (
    <div 
      onClick={() => handleCycleClick(cycle)}
      className={cn(
        "group relative flex items-center justify-between w-full p-4 rounded-xl border transition-all duration-200 text-left active:scale-[0.99] overflow-hidden cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-primary",
        isActive 
          ? "border-emerald-200 bg-emerald-50/40 hover:border-emerald-300 hover:bg-emerald-50/60 shadow-sm" 
          : "border-border/50 bg-card hover:border-primary/30 hover:bg-muted/5 hover:shadow-md"
      )}
    >
      <div className={cn(
        "absolute left-0 top-0 bottom-0 w-1 transition-colors",
        isActive ? "bg-emerald-500" : "bg-muted group-hover:bg-primary/40"
      )} />
      
      <div className="flex items-center gap-6 pl-2">
        <div className="flex flex-col min-w-[60px]">
          <span className="text-[8px] font-black uppercase tracking-[0.15em] text-muted-foreground/50 mb-0.5">Audit ID</span>
          <span className={cn("text-[10px] font-black uppercase", isActive ? "text-emerald-700" : "text-primary/60")}>Cycle {cycle.cycleNumber}</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex flex-col">
            <span className="text-[8px] font-black uppercase tracking-[0.15em] text-muted-foreground/50 mb-0.5">Start</span>
            <span className="text-xs font-bold tabular-nums text-foreground/80">
              {cycle.startDate ? format(parseISO(cycle.startDate), 'dd MMM yyyy') : '-'}
            </span>
          </div>
          <div className="h-px w-4 bg-border/60" />
          <div className="flex flex-col">
            <span className="text-[8px] font-black uppercase tracking-[0.15em] text-muted-foreground/50 mb-0.5">End</span>
            <span className={cn("text-xs font-bold tabular-nums", isActive ? "text-emerald-700" : "text-muted-foreground/80")}>
              {cycle.endDate ? format(parseISO(cycle.endDate), 'dd MMM yyyy') : '-'}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {isActive && cycle.status === 'active' && (
          <>
            <Badge variant="outline" className="text-[8px] font-black uppercase tracking-tighter border-emerald-200 text-emerald-700 bg-emerald-50 h-5 px-1.5 hidden sm:flex">
              Active
            </Badge>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-lg hover:bg-emerald-100 text-emerald-700 transition-colors"
              onClick={(e) => handleEditClick(e, cycle)}
            >
              <Pencil className="size-3.5" />
            </Button>
          </>
        )}
        <div className="flex items-center gap-1.5 opacity-40 group-hover:opacity-100 transition-all">
          <span className="text-[8px] font-black uppercase tracking-widest">View</span>
          <Eye className="size-3.5" />
        </div>
      </div>
    </div>
  )

  return (
    <div className="max-w-2xl mx-auto space-y-10 animate-in fade-in duration-500 pb-10">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push('/cycles')} className="rounded-full h-10 w-10 hover:bg-primary/10 text-primary transition-all active:scale-90"><ChevronLeft className="size-6" /></Button>
        <div className="space-y-0.5">
          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-primary font-headline uppercase">{groupName}</h2>
          <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 flex items-center gap-1.5"><History className="size-2.5" /> Registry History</p>
        </div>
      </div>

      <div className="space-y-8">
        <div className="space-y-4">
          <div className="flex items-center gap-2 px-1">
            <ShieldCheck className="size-3 text-emerald-500" />
            <h3 className="text-[9px] font-black uppercase tracking-[0.25em] text-emerald-600">Current Audit Period</h3>
            <div className="h-px flex-1 bg-emerald-100" />
          </div>
          <div className="grid gap-2">
            {activeCycles.length > 0 ? activeCycles.map((c) => <CycleItem key={c.id} cycle={c} isActive={true} />) : <div className="p-8 text-center border-2 border-dashed rounded-2xl bg-muted/5 text-muted-foreground/40 italic"><p className="text-[10px] font-bold uppercase tracking-widest">No active period detected</p></div>}
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-2 px-1">
            <Archive className="size-3 text-muted-foreground/60" />
            <h3 className="text-[9px] font-black uppercase tracking-[0.25em] text-muted-foreground/80">Historical Archives</h3>
            <div className="h-px flex-1 bg-muted" />
            <span className="text-[9px] font-bold text-muted-foreground/40 uppercase tracking-widest">{pastCycles.length} Records</span>
          </div>
          <div className="grid gap-2">
            {pastCycles.length > 0 ? pastCycles.map((c) => <CycleItem key={c.id} cycle={c} isActive={false} />) : <div className="p-12 text-center border-2 border-dashed rounded-3xl bg-muted/5 text-muted-foreground/40 italic"><p className="text-[9px] font-black uppercase tracking-[0.2em]">No historical records located</p></div>}
          </div>
        </div>
      </div>

      <Dialog open={isEditDialogOpen} onOpenChange={(o) => { if(!o) { setEditingCycle(null); document.body.style.pointerEvents = 'auto'; } setIsEditDialogOpen(o); }}>
        <DialogContent 
          className="sm:max-w-[400px]"
          onOpenAutoFocus={(e) => e.preventDefault()}
          onInteractOutside={handlePopupBlur}
          onEscapeKeyDown={handlePopupBlur}
        >
          {editingCycle && (
            <form onSubmit={handleUpdateCycle} className="space-y-6">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-primary font-headline uppercase tracking-tight"><Pencil className="size-5" /> Edit Audit Period</DialogTitle>
                <DialogDescription className="text-xs">Modifying the operational boundaries will automatically adjust neighboring cycles for continuity.</DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Start Date</Label>
                  <Input type="date" value={editingCycle.startDate} onChange={e => setEditingCycle({...editingCycle, startDate: e.target.value})} className="h-11 rounded-xl font-bold border-muted/60" required disabled={isActionPending} />
                </div>
                <div className="grid gap-2">
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">End Date</Label>
                  <Input type="date" value={editingCycle.endDate} onChange={e => setEditingCycle({...editingCycle, endDate: e.target.value})} className="h-11 rounded-xl font-bold border-muted/60" required disabled={isActionPending} />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={isActionPending} className="w-full h-12 font-black uppercase tracking-[0.2em] shadow-lg active:scale-95 transition-all bg-primary hover:bg-primary/90 text-white">
                  {isActionPending ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Save className="size-4 mr-2" />} Save & Sync Timeline
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
