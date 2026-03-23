
"use client"

import { useState, useMemo } from "react"
import { 
  CalendarClock, Plus, ChevronRight, ChevronLeft, 
  Users, IndianRupee, History, FolderKanban, 
  Loader2, CheckCircle2, AlertCircle, CalendarRange, 
  Trash2, Play, Pause, CreditCard, Search, CalendarDays,
  Wallet, TrendingUp, User, LayoutDashboard, Database
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { 
  Dialog, DialogContent, DialogDescription, 
  DialogFooter, DialogHeader, DialogTitle 
} from "@/components/ui/dialog"
import {
  Table, TableBody, TableCell, TableHead, 
  TableHeader, TableRow 
} from "@/components/ui/table"
import {
  Select, SelectContent, SelectItem, 
  SelectTrigger, SelectValue 
} from "@/components/ui/select"
import { useFirestore, useCollection, useMemoFirebase, useUser } from "@/firebase"
import { collection, query, orderBy, doc, addDoc, serverTimestamp, writeBatch, updateDoc, deleteDoc } from "firebase/firestore"
import { format, parseISO, isWithinInterval, isValid, isSameDay } from "date-fns"
import { cn } from "@/lib/utils"
import { createAuditLog } from "@/firebase/logging"
import { useToast } from "@/hooks/use-toast"

export default function CyclesDashboard() {
  const [view, setView] = useState<'list' | 'groups' | 'members'>('list')
  const [selectedCycle, setSelectedCycle] = useState<any>(null)
  const [selectedGroup, setSelectedGroup] = useState<any>(null)

  const [isAddCycleOpen, setIsAddCycleOpen] = useState(false)
  const [isDailyAuditOpen, setIsDailyAuditOpen] = useState(false)
  
  const [auditDate, setAuditDate] = useState(format(new Date(), 'yyyy-MM-dd'))

  const [newCycle, setNewCycle] = useState({
    name: "",
    startDate: format(new Date(), 'yyyy-MM-dd'),
    endDate: format(new Date(), 'yyyy-MM-dd'),
    status: "active" as "active" | "past"
  })

  const [isActionPending, setIsActionPending] = useState(false)
  const { toast } = useToast()
  const db = useFirestore()
  const { user } = useUser()

  const cyclesQuery = useMemoFirebase(() => query(collection(db, 'cycles'), orderBy('createdAt', 'desc')), [db])
  const { data: cycles, isLoading: cyclesLoading } = useCollection(cyclesQuery)

  const membersQuery = useMemoFirebase(() => collection(db, 'members'), [db])
  const { data: members } = useCollection(membersQuery)

  const paymentsQuery = useMemoFirebase(() => collection(db, 'payments'), [db])
  const { data: payments } = useCollection(paymentsQuery)

  const roundsQuery = useMemoFirebase(() => query(collection(db, 'chitRounds'), orderBy('createdAt', 'desc')), [db])
  const { data: rounds } = useCollection(roundsQuery)

  const matchedRounds = useMemo(() => {
    if (!selectedCycle || !rounds) return []
    return rounds.filter(r => 
      r.startDate && r.endDate && 
      r.startDate >= selectedCycle.startDate && 
      r.endDate <= selectedCycle.endDate
    )
  }, [selectedCycle, rounds])

  const filteredPayments = useMemo(() => {
    if (!selectedCycle || !payments) return []
    const start = selectedCycle.startDate
    const end = selectedCycle.endDate
    
    return payments.filter(p => {
      if (p.status !== 'success' && p.status !== 'paid') return false
      let pDateStr = p.targetDate; 
      if (!pDateStr && p.paymentDate) {
        try {
          const dateObj = p.paymentDate?.toDate ? p.paymentDate.toDate() : parseISO(p.paymentDate);
          if (isValid(dateObj)) {
            pDateStr = format(dateObj, 'yyyy-MM-dd');
          }
        } catch (e) { return false; }
      }
      return pDateStr && pDateStr >= start && pDateStr <= end;
    })
  }, [selectedCycle, payments])

  const cycleSummary = useMemo(() => {
    if (!selectedCycle || !members || !filteredPayments) return null;
    const totalCollection = filteredPayments.reduce((acc, p) => acc + (p.amountPaid || 0), 0);
    const uniquePaidMemberIds = new Set(filteredPayments.map(p => p.memberId));
    const totalPendingAmount = members
      .filter(m => m.status !== 'inactive')
      .reduce((acc, m) => acc + (m.pendingAmount || 0), 0);

    return { totalCollection, totalPendingAmount, paidMembersCount: uniquePaidMemberIds.size };
  }, [selectedCycle, members, filteredPayments]);

  const groupStats = useMemo(() => {
    if (!selectedCycle || !members || !matchedRounds) return []
    return matchedRounds.map(round => {
      const groupMembers = members.filter(m => m.chitGroup === round.name && m.status !== 'inactive');
      const groupPayments = filteredPayments.filter(p => groupMembers.some(m => m.id === p.memberId))
      const totalInCycle = groupPayments.reduce((acc, p) => acc + (p.amountPaid || 0), 0)
      const paidInGroupCount = new Set(groupPayments.map(p => p.memberId)).size;
      
      return { 
        id: round.id,
        name: round.name, 
        collection: totalInCycle, 
        membersCount: groupMembers.length,
        paidCount: paidInGroupCount,
        pendingCount: Math.max(0, groupMembers.length - paidInGroupCount)
      }
    })
  }, [selectedCycle, members, filteredPayments, matchedRounds])

  const handleAddCycle = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!db || isActionPending) return
    setIsActionPending(true)
    try {
      await addDoc(collection(db, 'cycles'), { ...newCycle, createdAt: serverTimestamp() })
      await createAuditLog(db, user, `Created new cycle: ${newCycle.name}`)
      setIsAddCycleOpen(false)
      setNewCycle({ name: "", startDate: format(new Date(), 'yyyy-MM-dd'), endDate: format(new Date(), 'yyyy-MM-dd'), status: "active" })
      toast({ title: "Cycle Initialized" })
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message })
    } finally { setIsActionPending(false) }
  }

  const toggleCycleStatus = async (cycle: any) => {
    if (!db || isActionPending) return
    setIsActionPending(true)
    try {
      const newStatus = cycle.status === 'active' ? 'past' : 'active'
      await updateDoc(doc(db, 'cycles', cycle.id), { status: newStatus })
      setSelectedCycle({ ...cycle, status: newStatus })
      toast({ title: "Cycle Updated" })
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message })
    } finally { setIsActionPending(false) }
  }

  if (cyclesLoading) return <div className="flex h-[60vh] items-center justify-center"><Loader2 className="size-8 animate-spin text-primary" /></div>

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          {view !== 'list' && (
            <Button 
              variant="outline" size="icon" 
              onClick={() => {
                if (view === 'groups') setView('list')
                else if (view === 'members') setView('groups')
              }}
              className="rounded-full h-10 w-10 shadow-sm"
            >
              <ChevronLeft className="size-5" />
            </Button>
          )}
          <div className="space-y-1">
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-primary font-headline uppercase">
              {view === 'list' ? 'Cycle Dashboard' : selectedCycle?.name}
            </h2>
            <p className="text-sm text-muted-foreground font-medium">
              {view === 'list' 
                ? 'Isolated historical monitoring and auditing.' 
                : `${format(parseISO(selectedCycle.startDate), 'MMM dd')} → ${format(parseISO(selectedCycle.endDate), 'MMM dd, yyyy')}`}
            </p>
          </div>
        </div>
        {view === 'list' ? (
          <Button onClick={() => setIsAddCycleOpen(true)} className="font-bold gap-2 h-11 px-6 shadow-lg">
            <Plus className="size-5" /> New Cycle
          </Button>
        ) : (
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="h-11 px-4 text-[10px] font-black uppercase tracking-widest border-primary/20 text-primary">
              <History className="size-3.5 mr-2" /> History Mode
            </Badge>
            <Badge variant={selectedCycle.status === 'active' ? 'default' : 'secondary'} className="h-11 px-4 text-xs font-black uppercase tracking-widest border-none shadow-sm">
              {selectedCycle.status}
            </Badge>
          </div>
        )}
      </div>

      {view === 'list' && (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {cycles?.map(cycle => (
            <Card 
              key={cycle.id} 
              className="group cursor-pointer hover:shadow-xl transition-all border-border/60 overflow-hidden relative shadow-sm rounded-2xl bg-card"
              onClick={() => { setSelectedCycle(cycle); setView('groups'); }}
            >
              <CardHeader className="p-5 pb-2 bg-muted/10 border-b border-border/40">
                <div className="flex justify-between items-center">
                  <Badge variant={cycle.status === 'active' ? 'default' : 'secondary'} className="uppercase text-[9px] font-black tracking-widest">
                    {cycle.status}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground font-bold tabular-nums">
                    Created {cycle.createdAt ? format(cycle.createdAt.toDate(), 'dd MMM') : '-'}
                  </span>
                </div>
                <CardTitle className="text-xl font-black uppercase tracking-tight mt-3">{cycle.name}</CardTitle>
              </CardHeader>
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-[9px] font-black uppercase text-muted-foreground/60 tracking-widest mb-1">Range Captured</span>
                    <span className="text-xs font-bold">{format(parseISO(cycle.startDate), 'MMM dd')} - {format(parseISO(cycle.endDate), 'MMM dd, yyyy')}</span>
                  </div>
                  <ChevronRight className="size-5 text-primary opacity-30 group-hover:opacity-100 transition-all" />
                </div>
              </CardContent>
            </Card>
          ))}
          {cycles?.length === 0 && (
            <div className="col-span-full h-40 flex flex-col items-center justify-center border-2 border-dashed rounded-2xl text-muted-foreground italic">
              <CalendarRange className="size-10 mb-2 opacity-20" />
              <p>No cycles defined yet.</p>
            </div>
          )}
        </div>
      )}

      {view === 'groups' && cycleSummary && (
        <div className="space-y-8 animate-in slide-in-from-right-4 duration-300">
          <div className="grid gap-4 sm:grid-cols-3">
            <Card className="bg-primary/5 border-primary/10 shadow-none rounded-2xl">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-primary/60">Cycle Collection</span>
                  <IndianRupee className="size-4 text-emerald-600" />
                </div>
                <div className="text-3xl font-black text-emerald-600 tracking-tight">₹{cycleSummary.totalCollection.toLocaleString()}</div>
              </CardContent>
            </Card>
            <Card className="bg-destructive/5 border-destructive/10 shadow-none rounded-2xl">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-destructive/60">Total Arrears</span>
                  <AlertCircle className="size-4 text-destructive" />
                </div>
                <div className="text-3xl font-black text-destructive tracking-tight">₹{cycleSummary.totalPendingAmount.toLocaleString()}</div>
              </CardContent>
            </Card>
            <Card className="bg-indigo-50 border-indigo-100 shadow-none rounded-2xl">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600/60">Paid Members</span>
                  <CheckCircle2 className="size-4 text-indigo-600" />
                </div>
                <div className="text-3xl font-black text-indigo-600 tracking-tight">{cycleSummary.paidMembersCount} Members</div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {groupStats.map(group => (
              <Card 
                key={group.id} 
                className="group cursor-pointer hover:border-primary transition-all border-border/60 shadow-sm rounded-2xl bg-card"
                onClick={() => { setSelectedGroup(group); setView('members'); }}
              >
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">{group.name}</CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="flex justify-between items-end">
                    <div>
                      <div className="text-2xl font-black text-emerald-600">₹{group.collection.toLocaleString()}</div>
                      <div className="flex flex-col mt-1">
                        <p className="text-[9px] font-bold text-muted-foreground uppercase">{group.membersCount} Active Seats</p>
                        <p className="text-[9px] font-bold text-indigo-600 uppercase">{group.paidCount} Paid / {group.pendingCount} Pending</p>
                      </div>
                    </div>
                    <FolderKanban className="size-5 text-primary/20 group-hover:text-primary transition-colors" />
                  </div>
                </CardContent>
              </Card>
            ))}
            {groupStats.length === 0 && (
              <div className="col-span-full h-32 flex flex-col items-center justify-center border-2 border-dashed rounded-2xl bg-muted/5 text-muted-foreground">
                <Database className="size-8 mb-2 opacity-20" />
                <p className="text-xs font-bold uppercase tracking-widest">No groups matched this cycle date range</p>
              </div>
            )}
          </div>

          <Card className="border-border/60 rounded-2xl bg-card overflow-hidden">
            <CardHeader className="bg-muted/10 border-b p-6">
              <CardTitle className="text-lg font-black uppercase">Cycle Configuration</CardTitle>
              <CardDescription>Archive or manage visibility for this historical period.</CardDescription>
            </CardHeader>
            <CardContent className="p-6 flex flex-col sm:flex-row gap-4">
              <Button 
                variant="outline" 
                className="flex-1 font-bold gap-2 h-12 rounded-xl"
                onClick={() => toggleCycleStatus(selectedCycle)}
                disabled={isActionPending}
              >
                {selectedCycle.status === 'active' ? <Pause className="size-4" /> : <Play className="size-4" />}
                {selectedCycle.status === 'active' ? 'Mark as Past (Lock Period)' : 'Re-activate Cycle'}
              </Button>
              <Button 
                variant="destructive" 
                className="flex-1 font-bold gap-2 h-12 rounded-xl"
                onClick={async () => {
                  if(confirm('Delete this cycle record? This will not affect scheme or payment data.')) {
                    await deleteDoc(doc(db, 'cycles', selectedCycle.id))
                    setView('list')
                  }
                }}
                disabled={isActionPending}
              >
                <Trash2 className="size-4" /> Delete Cycle Record
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {view === 'members' && (
        <Card className="rounded-2xl border-border/60 overflow-hidden shadow-sm animate-in slide-in-from-right-4 duration-300 bg-card">
          <CardHeader className="bg-muted/20 p-6 flex flex-row items-center justify-between border-b">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-black shadow-inner">
                <Users className="size-6" />
              </div>
              <div>
                <CardTitle className="text-xl font-black uppercase">{selectedGroup?.name} Registry</CardTitle>
                <CardDescription>Cycle Historical Ledger: {selectedCycle.name}</CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="font-bold text-[10px] border-amber-200 text-amber-700 py-1 px-3 bg-amber-50">
                Read Only Mode
              </Badge>
            </div>
          </CardHeader>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/10">
                <TableRow>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest h-12 pl-6">Participant</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest h-12">Cycle Total</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest h-12">Total Arrears</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest h-12 pr-6 text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members?.filter(m => m.chitGroup === selectedGroup?.name && m.status !== 'inactive').length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-40 text-center text-muted-foreground italic text-sm">
                      No participants found in this group for this cycle.
                    </TableCell>
                  </TableRow>
                ) : (
                  members?.filter(m => m.chitGroup === selectedGroup?.name && m.status !== 'inactive').map(m => {
                    const memberTotalInCycle = filteredPayments
                      .filter(p => p.memberId === m.id)
                      .reduce((acc, p) => acc + (p.amountPaid || 0), 0)
                    
                    const todayStr = format(new Date(), 'yyyy-MM-dd');
                    const isPaidToday = payments?.some(p => 
                      p.memberId === m.id && 
                      (p.status === 'success' || p.status === 'paid') &&
                      (p.targetDate === todayStr || (p.paymentDate && format(p.paymentDate?.toDate ? p.paymentDate.toDate() : parseISO(p.paymentDate), 'yyyy-MM-dd') === todayStr))
                    );

                    return (
                      <TableRow key={m.id} className="hover:bg-muted/5 transition-colors">
                        <TableCell className="pl-6 py-4">
                          <div className="flex flex-col">
                            <span className="text-sm font-bold tracking-tight">{m.name}</span>
                            <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">{m.phone}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm font-black text-emerald-600 tabular-nums">₹{memberTotalInCycle.toLocaleString()}</span>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-destructive tabular-nums">₹{(m.pendingAmount || 0).toLocaleString()}</span>
                            <span className="text-[9px] font-bold text-muted-foreground uppercase">{m.pendingDays || 0} Days</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right pr-6">
                          <Badge variant={isPaidToday ? "default" : "secondary"} className={cn(
                            "text-[9px] font-black uppercase tracking-widest px-3 py-1 border-none",
                            isPaidToday ? "bg-emerald-500 hover:bg-emerald-600" : "bg-amber-100 text-amber-700"
                          )}>
                            {isPaidToday ? "PAID TODAY" : "UNPAID"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      <Dialog open={isAddCycleOpen} onOpenChange={setIsAddCycleOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <form onSubmit={handleAddCycle}>
            <DialogHeader>
              <DialogTitle className="text-xl font-bold">New Monitoring Cycle</DialogTitle>
              <DialogDescription>Define a custom date range to audit collection performance.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-5 py-6">
              <div className="grid gap-2">
                <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Cycle Name</Label>
                <Input value={newCycle.name} onChange={e => setNewCycle({...newCycle, name: e.target.value})} placeholder="e.g. Mar 22 - Apr 22 Audit" required className="h-11 rounded-xl" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Start Date</Label>
                  <Input type="date" value={newCycle.startDate} onChange={e => setNewCycle({...newCycle, startDate: e.target.value})} required className="h-11 rounded-xl" />
                </div>
                <div className="grid gap-2">
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">End Date</Label>
                  <Input type="date" value={newCycle.endDate} onChange={e => setNewCycle({...newCycle, endDate: e.target.value})} required className="h-11 rounded-xl" />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={isActionPending} className="w-full font-bold h-11 rounded-xl shadow-lg">
                {isActionPending ? <Loader2 className="mr-2 animate-spin" /> : null}
                Initialize Cycle
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
