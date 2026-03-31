
"use client"

import * as React from "react"
import { Loader2, ChevronLeft, ArrowRight, ChevronRight, Calendar, History, Clock, Pencil, Save, ShieldCheck, Archive } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useFirestore, useCollection, useMemoFirebase, useUser } from "@/firebase"
import { collection, query, orderBy, doc, updateDoc } from "firebase/firestore"
import { useRouter } from "next/navigation"
import { format, parseISO, isValid } from "date-fns"
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

/**
 * @fileOverview Refined Group-Specific Cycle Audit Page.
 * 
 * Displays a chronological list of cycle date ranges with a compact, professional UI.
 * Now categorizes cycles into "Active" and "Past" states for better auditing flow.
 */
export default function GroupCyclesPage({ params }: { params: Promise<{ groupName: string }> }) {
  const router = useRouter()
  const resolvedParams = React.use(params)
  const { toast } = useToast()
  const { user } = useUser()
  
  // Safe Param Handling
  const rawGroupName = resolvedParams?.groupName || ""
  const groupName = decodeURIComponent(rawGroupName).trim()

  const db = useFirestore()

  // Edit State
  const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false)
  const [isActionPending, setIsActionPending] = React.useState(false)
  const [editingCycle, setEditingCycle] = React.useState<{id: string, startDate: string, endDate: string} | null>(null)

  // Fetch all cycles safely
  const cyclesQuery = useMemoFirebase(() => query(collection(db, 'cycles'), orderBy('startDate', 'desc')), [db])
  const { data: allCycles, isLoading } = useCollection(cyclesQuery)

  // Data Sanitization - Categorize by Status
  const { activeCycles, pastCycles } = React.useMemo(() => {
    if (!Array.isArray(allCycles)) return { activeCycles: [], pastCycles: [] }
    
    const filtered = allCycles
      .filter((c) => String(c?.name || "").trim() === groupName)
      .map((c) => ({
        id: String(c?.id || ""),
        startDate: String(c?.startDate || "-"),
        endDate: String(c?.endDate || "-"),
        status: c?.status || 'active'
      }))

    return {
      activeCycles: filtered.filter(c => c.status === 'active'),
      pastCycles: filtered.filter(c => c.status !== 'active')
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
    setEditingCycle({ ...cycle })
    setIsEditDialogOpen(true)
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
      const cycleRef = doc(db, 'cycles', editingCycle.id)
      await withTimeout(updateDoc(cycleRef, {
        startDate: editingCycle.startDate,
        endDate: editingCycle.endDate,
        updatedAt: new Date().toISOString()
      }))

      await createAuditLog(db, user, `Updated cycle dates for ${groupName}: ${editingCycle.startDate} to ${editingCycle.endDate}`)
      
      toast({ title: "Cycle Updated", description: "The period dates have been corrected." })
      setIsEditDialogOpen(false)
      setEditingCycle(null)
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message || "Failed to update cycle." })
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
      onClick={() => handleCycleClick(cycle)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          handleCycleClick(cycle)
        }
      }}
      role="button"
      tabIndex={0}
      className={cn(
        "group relative flex items-center justify-between w-full p-4 rounded-xl border transition-all duration-200 text-left active:scale-[0.99] overflow-hidden cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-primary",
        isActive 
          ? "border-emerald-200 bg-emerald-50/40 hover:border-emerald-300 hover:bg-emerald-50/60 shadow-sm" 
          : "border-border/50 bg-card hover:border-primary/30 hover:shadow-sm"
      )}
    >
      <div className={cn(
        "absolute left-0 top-0 bottom-0 w-1 transition-colors",
        isActive ? "bg-emerald-500" : "bg-muted group-hover:bg-primary/40"
      )} />
      
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
            <span className={cn("text-xs font-bold tabular-nums", isActive ? "text-emerald-700" : "text-muted-foreground/80")}>
              {formatDateLabel(cycle.endDate)}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {isActive && (
          <Badge variant="outline" className="text-[8px] font-black uppercase tracking-tighter border-emerald-200 text-emerald-700 bg-emerald-50 h-5 px-1.5 hidden sm:flex">
            Active
          </Badge>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-emerald-100 text-emerald-700"
          onClick={(e) => handleEditClick(e, cycle)}
        >
          <Pencil className="size-3.5" />
        </Button>
        <span className={cn(
          "text-[8px] font-black uppercase tracking-[0.2em] transition-all",
          isActive ? "text-emerald-600/0 group-hover:text-emerald-600/60" : "text-primary/0 group-hover:text-primary/60"
        )}>
          View
        </span>
        <ChevronRight className={cn(
          "size-4 text-muted-foreground/20 transition-colors",
          isActive ? "group-hover:text-emerald-600" : "group-hover:text-primary"
        )} />
      </div>
    </div>
  )

  return (
    <div className="max-w-2xl mx-auto space-y-10 animate-in fade-in duration-500 pb-10 overflow-x-hidden">
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

      <div className="space-y-8">
        {/* Active Cycles Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 px-1">
            <ShieldCheck className="size-3 text-emerald-500" />
            <h3 className="text-[9px] font-black uppercase tracking-[0.25em] text-emerald-600">
              Current Audit Period
            </h3>
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

        {/* Historical Cycles Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 px-1">
            <Archive className="size-3 text-muted-foreground/60" />
            <h3 className="text-[9px] font-black uppercase tracking-[0.25em] text-muted-foreground/80">
              Historical Archives
            </h3>
            <div className="h-px flex-1 bg-muted" />
            <span className="text-[9px] font-bold text-muted-foreground/40 uppercase tracking-widest">
              {pastCycles.length} Records
            </span>
          </div>
          
          <div className="grid gap-2">
            {pastCycles.length > 0 ? (
              pastCycles.map((cycle) => (
                <CycleItem key={cycle.id} cycle={cycle} isActive={false} />
              ))
            ) : (
              <div className="p-12 text-center border-2 border-dashed rounded-3xl bg-muted/5 text-muted-foreground/40 space-y-3">
                <History className="size-8 mx-auto opacity-20" />
                <p className="text-[9px] font-black uppercase tracking-[0.2em] italic">
                  No historical records located
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          {editingCycle && (
            <form onSubmit={handleUpdateCycle} className="space-y-6">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Pencil className="size-5 text-primary" />
                  Edit Audit Period
                </DialogTitle>
                <DialogDescription>
                  Modify the operational start and end dates for this cycle in {groupName}.
                </DialogDescription>
              </DialogHeader>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Start Date</Label>
                  <Input 
                    type="date" 
                    value={editingCycle.startDate} 
                    onChange={e => setEditingCycle({...editingCycle, startDate: e.target.value})}
                    className="h-11 rounded-xl font-bold"
                    required
                    disabled={isActionPending}
                  />
                </div>
                <div className="grid gap-2">
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">End Date</Label>
                  <Input 
                    type="date" 
                    value={editingCycle.endDate} 
                    onChange={e => setEditingCycle({...editingCycle, endDate: e.target.value})}
                    className="h-11 rounded-xl font-bold"
                    required
                    disabled={isActionPending}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button 
                  type="submit" 
                  disabled={isActionPending}
                  className="w-full h-12 font-black uppercase tracking-[0.2em] shadow-lg active:scale-95 transition-all"
                >
                  {isActionPending ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Save className="size-4 mr-2" />}
                  Save Period Changes
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
