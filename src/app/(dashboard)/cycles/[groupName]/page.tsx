
"use client"

import * as React from "react"
import { Loader2, ChevronLeft, ArrowRight, ChevronRight, Calendar, History, Clock, Pencil, Save, ShieldCheck, Archive, RefreshCcw, MoreVertical, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useFirestore, useCollection, useMemoFirebase, useUser } from "@/firebase"
import { collection, query, orderBy, doc, updateDoc, addDoc, writeBatch, where, getDocs, limit, deleteDoc } from "firebase/firestore"
import { useRouter } from "next/navigation"
import { format, parseISO, isValid, subDays } from "date-fns"
import { cn, withTimeout } from "@/lib/utils"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { createAuditLog } from "@/firebase/logging"

/**
 * @fileOverview Refined Group-Specific Cycle Audit Page.
 * 
 * Displays a chronological list of cycle date ranges.
 * FIX: Deduplicates records logically by startDate to prevent visual duplicates.
 * FIX: Implements timeline continuity logic on update.
 */
export default function GroupCyclesPage({ params }: { params: Promise<{ groupName: string }> }) {
  const router = useRouter()
  const resolvedParams = React.use(params)
  const { toast } = useToast()
  const { user } = useUser()
  
  const rawGroupName = resolvedParams?.groupName || ""
  const groupName = decodeURIComponent(rawGroupName).trim()

  const db = useFirestore()

  const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false)
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = React.useState(false)
  const [isActionPending, setIsActionPending] = React.useState(false)
  const [editingCycle, setEditingCycle] = React.useState<{id: string, startDate: string, endDate: string} | null>(null)
  const [cycleToDelete, setCycleToDelete] = React.useState<any>(null)

  const cyclesQuery = useMemoFirebase(() => query(collection(db, 'cycles'), orderBy('startDate', 'desc')), [db])
  const { data: allCycles, isLoading } = useCollection(cyclesQuery)

  const { activeCycles, pastCycles } = React.useMemo(() => {
    if (!Array.isArray(allCycles)) return { activeCycles: [], pastCycles: [] }
    
    // Map to track unique logical periods: key = startDate
    const uniqueMap = new Map<string, any>()

    allCycles
      .filter((c) => String(c?.name || "").trim() === groupName)
      // Sort by status so 'active' records are prioritized during deduplication
      .sort((a, b) => {
        if (a.status === 'active' && b.status !== 'active') return -1
        if (a.status !== 'active' && b.status === 'active') return 1
        return 0
      })
      .forEach((c) => {
        const start = String(c?.startDate || "-")
        
        // Strategy: Only keep the most relevant record per Start Date
        if (!uniqueMap.has(start)) {
          uniqueMap.set(start, {
            id: String(c?.id || ""),
            startDate: start,
            endDate: String(c?.endDate || "-"),
            status: c?.status || 'active'
          })
        }
      })

    const deduplicated = Array.from(uniqueMap.values())

    return {
      activeCycles: deduplicated.filter(c => c.status === 'active'),
      pastCycles: deduplicated.filter(c => c.status !== 'active')
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

  const handleUpdateCycle = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!db || !editingCycle || isActionPending) return

    if (!editingCycle.startDate || !editingCycle.endDate) {
      toast({ variant: "destructive", title: "Validation Error", description: "Both dates are required." })
      return
    }

    setIsActionPending(true)
    try {
      const batch = writeBatch(db)
      
      // CONTINUITY FIX: Adjust predecessor
      const prevCyclesQuery = query(
        collection(db, 'cycles'),
        where('name', '==', groupName),
        where('startDate', '<', editingCycle.startDate),
        orderBy('startDate', 'desc'),
        limit(1)
      )
      const prevSnap = await getDocs(prevCyclesQuery)
      
      if (!prevSnap.empty) {
        const prevDoc = prevSnap.docs[0]
        const expectedEndDate = format(subDays(parseISO(editingCycle.startDate), 1), 'yyyy-MM-dd')
        if (prevDoc.data().endDate !== expectedEndDate) {
          batch.update(prevDoc.ref, { endDate: expectedEndDate })
        }
      }

      const cycleRef = doc(db, 'cycles', editingCycle.id)
      batch.update(cycleRef, {
        startDate: editingCycle.startDate,
        endDate: editingCycle.endDate,
        updatedAt: new Date().toISOString()
      })

      await withTimeout(batch.commit())
      await createAuditLog(db, user, `Updated cycle dates for ${groupName}: ${editingCycle.startDate} to ${editingCycle.endDate}. Timeline synchronized.`)
      
      toast({ title: "Cycle Updated", description: "Operational period and timeline synchronized." })
      setIsEditDialogOpen(false)
      setEditingCycle(null)
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message || "Failed to update cycle." })
    } finally {
      setIsActionPending(false)
    }
  }

  const handleDeleteCycle = async () => {
    if (!db || !cycleToDelete || isActionPending) return
    setIsActionPending(true)
    try {
      await withTimeout(deleteDoc(doc(db, 'cycles', cycleToDelete.id)))
      await createAuditLog(db, user, `Deleted logical duplicate audit window for ${groupName}: ${cycleToDelete.startDate}`)
      toast({ title: "Record Deleted", description: "Historical window removed from ledger." })
      setIsDeleteAlertOpen(false)
      setCycleToDelete(null)
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message || "Deletion failed." })
    } finally {
      setIsActionPending(false)
    }
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

  const CycleItem = ({ cycle, isActive }: { cycle: any, isActive: boolean }) => (
    <div 
      className={cn(
        "group relative flex items-center justify-between w-full p-4 rounded-xl border transition-all duration-200 text-left overflow-hidden outline-none",
        isActive 
          ? "border-emerald-200 bg-emerald-50/40 shadow-sm" 
          : "border-border/50 bg-card hover:border-primary/30 hover:shadow-sm"
      )}
    >
      <div className={cn(
        "absolute left-0 top-0 bottom-0 w-1 transition-colors",
        isActive ? "bg-emerald-500" : "bg-muted group-hover:bg-primary/40"
      )} />
      
      <div className="flex items-center gap-6 pl-2 flex-1 cursor-pointer" onClick={() => handleCycleClick(cycle)}>
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
            <span className={cn("text-xs font-bold tabular-nums", isActive ? "text-emerald-700" : "text-muted-foreground/80")}>
              {formatDateLabel(cycle.endDate)}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 pr-1">
        {isActive && (
          <Badge variant="outline" className="text-[8px] font-black uppercase tracking-tighter border-emerald-200 text-emerald-700 bg-emerald-50 h-5 px-1.5 hidden sm:flex">
            Active
          </Badge>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-muted-foreground/40 hover:text-primary transition-colors">
              <MoreVertical className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem onClick={() => { setEditingCycle({...cycle}); setIsEditDialogOpen(true); }}>
              <Pencil className="size-3.5 mr-2" /> Edit Period
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => { setCycleToDelete(cycle); setIsDeleteAlertOpen(true); }}>
              <Trash2 className="size-3.5 mr-2" /> Delete Record
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <ChevronRight className="size-4 text-muted-foreground/20 group-hover:text-primary transition-colors" />
      </div>
    </div>
  )

  return (
    <div className="max-w-2xl mx-auto space-y-10 animate-in fade-in duration-500 pb-10 overflow-x-hidden">
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
          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-primary font-headline uppercase">{groupName}</h2>
          <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 flex items-center gap-1.5">
            <History className="size-2.5" /> Registry History
          </p>
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
            {activeCycles.length > 0 ? (
              activeCycles.map((cycle) => (
                <CycleItem key={cycle.id} cycle={cycle} isActive={true} />
              ))
            ) : (
              <div className="p-8 text-center border-2 border-dashed rounded-2xl bg-muted/5 text-muted-foreground/40 italic">
                <p className="text-[10px] font-bold uppercase tracking-widest">No active period detected</p>
              </div>
            )}
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
            {pastCycles.length > 0 ? (
              pastCycles.map((cycle) => (
                <CycleItem key={cycle.id} cycle={cycle} isActive={false} />
              ))
            ) : (
              <div className="p-12 text-center border-2 border-dashed rounded-3xl bg-muted/5 space-y-4">
                <div className="space-y-2">
                  <History className="size-8 mx-auto text-muted-foreground/20" />
                  <p className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/40 italic">No historical records located</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          {editingCycle && (
            <form onSubmit={handleUpdateCycle} className="space-y-6">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Pencil className="size-5 text-primary" /> Edit Audit Period
                </DialogTitle>
                <DialogDescription>Modify dates for this cycle. Preceding cycle end date will auto-adjust.</DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Start Date</Label>
                  <Input type="date" value={editingCycle.startDate} onChange={e => setEditingCycle({...editingCycle, startDate: e.target.value})} className="h-11 rounded-xl font-bold" required disabled={isActionPending} />
                </div>
                <div className="grid gap-2">
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">End Date</Label>
                  <Input type="date" value={editingCycle.endDate} onChange={e => setEditingCycle({...editingCycle, endDate: e.target.value})} className="h-11 rounded-xl font-bold" required disabled={isActionPending} />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={isActionPending} className="w-full h-12 font-black uppercase tracking-[0.2em] shadow-lg active:scale-95 transition-all">
                  {isActionPending ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Save className="size-4 mr-2" />} Save Changes
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive uppercase tracking-tight font-headline">Delete Archive Record?</AlertDialogTitle>
            <AlertDialogDescription>This will remove this specific cycle window from history. It does NOT delete payment records, but they will no longer be visible in this audit context.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isActionPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteCycle} disabled={isActionPending} className="bg-destructive hover:bg-destructive/90 font-bold uppercase tracking-widest text-xs h-10 px-6">
              {isActionPending ? <Loader2 className="size-3 mr-2 animate-spin" /> : null} Confirm Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
