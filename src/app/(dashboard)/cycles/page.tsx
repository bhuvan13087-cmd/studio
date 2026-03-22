"use client"

import { useState, useMemo } from "react"
import { 
  CalendarClock, Plus, ChevronRight, ChevronLeft, 
  Users, IndianRupee, History, FolderKanban, 
  Loader2, CheckCircle2, AlertCircle, CalendarRange, 
  Trash2, Play, Pause, CreditCard, Search, CalendarDays,
  Wallet
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
import { cn, withTimeout } from "@/lib/utils"
import { createAuditLog } from "@/firebase/logging"
import { useToast } from "@/hooks/use-toast"

export default function CyclesDashboard() {
  // Navigation State: 'list' -> 'groups' -> 'members'
  const [view, setView] = useState<'list' | 'groups' | 'members'>('list')
  const [selectedCycle, setSelectedCycle] = useState<any>(null)
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null)

  // Dialog States
  const [isAddCycleOpen, setIsAddCycleOpen] = useState(false)
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false)
  const [isDailyAuditOpen, setIsDailyAuditOpen] = useState(false)
  
  // Data States
  const [targetMemberForPayment, setTargetMemberForPayment] = useState<any>(null)
  const [paymentAmount, setPaymentAmount] = useState<number>(0)
  const [paymentMethod, setPaymentMethod] = useState("Cash")
  const [auditDate, setAuditDate] = useState(format(new Date(), 'yyyy-MM-dd'))

  // Form State
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

  // Data Fetching
  const cyclesQuery = useMemoFirebase(() => query(collection(db, 'cycles'), orderBy('createdAt', 'desc')), [db])
  const { data: cycles, isLoading: cyclesLoading } = useCollection(cyclesQuery)

  const membersQuery = useMemoFirebase(() => collection(db, 'members'), [db])
  const { data: members } = useCollection(membersQuery)

  const paymentsQuery = useMemoFirebase(() => collection(db, 'payments'), [db])
  const { data: payments } = useCollection(paymentsQuery)

  const roundsQuery = useMemoFirebase(() => collection(db, 'chitRounds'), [db])
  const { data: rounds } = useCollection(roundsQuery)

  // Filtered Data for selected cycle
  const filteredPayments = useMemo(() => {
    if (!selectedCycle || !payments) return []
    const start = selectedCycle.startDate
    const end = selectedCycle.endDate
    
    return payments.filter(p => {
      if (p.status !== 'success' && p.status !== 'paid') return false
      const pDate = p.targetDate || (p.paymentDate ? format(parseISO(p.paymentDate), 'yyyy-MM-dd') : null)
      if (!pDate) return false
      return pDate >= start && pDate <= end
    })
  }, [selectedCycle, payments])

  const groupStats = useMemo(() => {
    if (!selectedCycle || !members) return []
    const groupNames = ['A', 'B', 'C', 'D']
    return groupNames.map(name => {
      const groupMembers = members.filter(m => m.chitGroup === name && m.status !== 'inactive')
      const totalInCycle = filteredPayments
        .filter(p => groupMembers.some(m => m.id === p.memberId))
        .reduce((acc, p) => acc + (p.amountPaid || 0), 0)
      
      return { name, collection: totalInCycle, membersCount: groupMembers.length }
    })
  }, [selectedCycle, members, filteredPayments])

  const auditTotal = useMemo(() => {
    if (!filteredPayments) return 0;
    return filteredPayments
      .filter(p => {
        const pDate = p.targetDate || (p.paymentDate ? format(parseISO(p.paymentDate), 'yyyy-MM-dd') : null)
        return pDate === auditDate
      })
      .reduce((acc, p) => acc + (p.amountPaid || 0), 0)
  }, [filteredPayments, auditDate])

  // Actions
  const handleAddCycle = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!db || isActionPending) return
    setIsActionPending(true)
    try {
      await addDoc(collection(db, 'cycles'), {
        ...newCycle,
        createdAt: serverTimestamp()
      })
      await createAuditLog(db, user, `Created new cycle: ${newCycle.name}`)
      setIsAddCycleOpen(false)
      setNewCycle({
        name: "",
        startDate: format(new Date(), 'yyyy-MM-dd'),
        endDate: format(new Date(), 'yyyy-MM-dd'),
        status: "active"
      })
      toast({ title: "Cycle Initialized" })
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message })
    } finally {
      setIsActionPending(false)
    }
  }

  const handleProcessPayment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!db || !targetMemberForPayment || isActionPending) return
    setIsActionPending(true)
    try {
      const batch = writeBatch(db)
      const paymentRef = doc(collection(db, 'payments'))
      const amount = Number(paymentAmount)
      const schemeAmount = targetMemberForPayment.monthlyAmount || 800
      
      batch.set(paymentRef, {
        id: paymentRef.id,
        memberId: targetMemberForPayment.id,
        memberName: targetMemberForPayment.name,
        month: format(new Date(), 'MMMM yyyy'),
        targetDate: format(new Date(), 'yyyy-MM-dd'),
        amountPaid: amount,
        paymentDate: new Date().toISOString(),
        status: "success",
        method: paymentMethod,
        createdAt: serverTimestamp()
      })

      const memberRef = doc(db, 'members', targetMemberForPayment.id)
      const currentPendingAmount = targetMemberForPayment.pendingAmount || 0
      const newPendingAmount = Math.max(0, currentPendingAmount - amount)
      const newPendingDays = Math.ceil(newPendingAmount / schemeAmount)

      batch.update(memberRef, {
        totalPaid: (targetMemberForPayment.totalPaid || 0) + amount,
        pendingAmount: newPendingAmount,
        pendingDays: newPendingDays
      })

      await batch.commit()
      await createAuditLog(db, user, `Cycle Payment: ₹${amount} for ${targetMemberForPayment.name}`)
      setIsPaymentDialogOpen(false)
      toast({ title: "Payment Recorded" })
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message })
    } finally {
      setIsActionPending(false)
    }
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
    } finally {
      setIsActionPending(false)
    }
  }

  if (cyclesLoading) return <div className="flex h-[60vh] items-center justify-center"><Loader2 className="size-8 animate-spin text-primary" /></div>

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-10">
      {/* HEADER */}
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
                ? 'Isolated period monitoring and auditing.' 
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
            <Button variant="outline" className="font-bold gap-2 h-11" onClick={() => setIsDailyAuditOpen(true)}>
              <Wallet className="size-4" /> Daily Audit
            </Button>
            <Badge variant={selectedCycle.status === 'active' ? 'default' : 'secondary'} className="h-11 px-4 text-xs font-black uppercase tracking-widest border-none">
              {selectedCycle.status}
            </Badge>
          </div>
        )}
      </div>

      {/* VIEW: CYCLE LIST */}
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
                <CardTitle className="text-xl font-black uppercase tracking-tight mt-3">
                  {cycle.name}
                </CardTitle>
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

      {/* VIEW: GROUPS IN CYCLE */}
      {view === 'groups' && (
        <div className="space-y-8 animate-in slide-in-from-right-4 duration-300">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {groupStats.map(group => (
              <Card 
                key={group.name} 
                className="group cursor-pointer hover:border-primary transition-all border-border/60 shadow-sm rounded-2xl bg-card"
                onClick={() => { setSelectedGroup(group.name); setView('members'); }}
              >
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Group {group.name}</CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="flex justify-between items-end">
                    <div>
                      <div className="text-2xl font-black text-emerald-600">₹{group.collection.toLocaleString()}</div>
                      <p className="text-[9px] font-bold text-muted-foreground uppercase">{group.membersCount} Active Seats</p>
                    </div>
                    <FolderKanban className="size-5 text-primary/20 group-hover:text-primary transition-colors" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="border-border/60 rounded-2xl bg-card overflow-hidden">
            <CardHeader className="bg-muted/10 border-b p-6">
              <CardTitle className="text-lg font-black uppercase">Cycle Administration</CardTitle>
              <CardDescription>Toggle status to enable or disable new payments for this period.</CardDescription>
            </CardHeader>
            <CardContent className="p-6 flex flex-col sm:flex-row gap-4">
              <Button 
                variant="outline" 
                className="flex-1 font-bold gap-2 h-12 rounded-xl"
                onClick={() => toggleCycleStatus(selectedCycle)}
                disabled={isActionPending}
              >
                {selectedCycle.status === 'active' ? <Pause className="size-4" /> : <Play className="size-4" />}
                {selectedCycle.status === 'active' ? 'Mark as Past (Lock Payments)' : 'Re-activate Cycle'}
              </Button>
              <Button 
                variant="destructive" 
                className="flex-1 font-bold gap-2 h-12 rounded-xl"
                onClick={async () => {
                  if(confirm('Delete this cycle record? Payment history remains.')) {
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

      {/* VIEW: MEMBERS IN GROUP */}
      {view === 'members' && (
        <Card className="rounded-2xl border-border/60 overflow-hidden shadow-sm animate-in slide-in-from-right-4 duration-300 bg-card">
          <CardHeader className="bg-muted/20 p-6 flex flex-row items-center justify-between border-b">
            <div>
              <CardTitle className="text-xl font-black uppercase">Group {selectedGroup} Members</CardTitle>
              <CardDescription>Ledger for cycle: {selectedCycle.name}</CardDescription>
            </div>
            <Badge variant="outline" className="font-bold text-[10px] border-primary/20 text-primary">
              {members?.filter(m => m.chitGroup === selectedGroup && m.status !== 'inactive').length} Participants
            </Badge>
          </CardHeader>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/10">
                <TableRow>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest h-12 pl-6">Participant</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest h-12">Cycle Total</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest h-12">Arrears</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest h-12 text-right pr-6">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members?.filter(m => m.chitGroup === selectedGroup && m.status !== 'inactive').map(m => {
                  const memberTotal = filteredPayments
                    .filter(p => p.memberId === m.id)
                    .reduce((acc, p) => acc + (p.amountPaid || 0), 0)
                  
                  return (
                    <TableRow key={m.id} className="hover:bg-muted/5 transition-colors">
                      <TableCell className="pl-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold">{m.name}</span>
                          <span className="text-[9px] font-bold text-muted-foreground uppercase">{m.phone}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm font-bold text-emerald-600 tabular-nums">₹{memberTotal.toLocaleString()}</span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn(
                          "text-[9px] font-bold uppercase",
                          (m.pendingDays || 0) > 0 ? "text-destructive border-destructive/20" : "text-emerald-600 border-emerald-200"
                        )}>
                          {(m.pendingDays || 0)} Days
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right pr-6">
                        {selectedCycle.status === 'active' ? (
                          <Button 
                            size="sm" 
                            className="h-8 gap-2 font-bold px-4 rounded-lg"
                            onClick={() => {
                              const scheme = rounds?.find(r => r.name === m.chitGroup)
                              setTargetMemberForPayment(m)
                              setPaymentAmount(scheme?.monthlyAmount || 800)
                              setIsPaymentDialogOpen(true)
                            }}
                          >
                            <IndianRupee className="size-3.5" /> Pay
                          </Button>
                        ) : (
                          <span className="text-[10px] font-bold text-muted-foreground uppercase italic">Locked</span>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* DIALOGS */}
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
                <Input 
                  value={newCycle.name} 
                  onChange={e => setNewCycle({...newCycle, name: e.target.value})} 
                  placeholder="e.g. Mar 22 - Apr 22 Audit"
                  required 
                  className="h-11 rounded-xl"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Start Date</Label>
                  <Input 
                    type="date" 
                    value={newCycle.startDate} 
                    onChange={e => setNewCycle({...newCycle, startDate: e.target.value})} 
                    required 
                    className="h-11 rounded-xl"
                  />
                </div>
                <div className="grid gap-2">
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">End Date</Label>
                  <Input 
                    type="date" 
                    value={newCycle.endDate} 
                    onChange={e => setNewCycle({...newCycle, endDate: e.target.value})} 
                    required 
                    className="h-11 rounded-xl"
                  />
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

      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          {targetMemberForPayment && (
            <form onSubmit={handleProcessPayment}>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <CreditCard className="size-5 text-primary" />
                  Cycle Payment
                </DialogTitle>
                <DialogDescription>Recording payment for <span className="font-bold text-primary">{targetMemberForPayment.name}</span> within active cycle.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-5 py-6">
                <div className="grid gap-2">
                  <Label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">Amount (₹)</Label>
                  <Input 
                    type="number" 
                    value={paymentAmount} 
                    onChange={e => setPaymentAmount(Number(e.target.value))} 
                    required 
                    className="h-12 text-lg font-black text-primary rounded-xl"
                  />
                </div>
                <div className="grid gap-2">
                  <Label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">Method</Label>
                  <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                    <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Cash">Cash</SelectItem>
                      <SelectItem value="UPI">UPI</SelectItem>
                      <SelectItem value="Transfer">Bank Transfer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={isActionPending} className="w-full font-black uppercase tracking-[0.2em] h-12 bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-lg transition-all active:scale-[0.98]">
                  {isActionPending ? <Loader2 className="mr-2 animate-spin" /> : null}
                  Confirm Cycle Payment
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isDailyAuditOpen} onOpenChange={setIsDailyAuditOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wallet className="size-5 text-primary" />
              Cycle Reconciliation
            </DialogTitle>
            <DialogDescription>Inspect intake for a specific date within this period.</DialogDescription>
          </DialogHeader>
          <div className="py-6 space-y-6">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Audit Target Date</Label>
              <Input 
                type="date" 
                value={auditDate} 
                min={selectedCycle?.startDate}
                max={selectedCycle?.endDate}
                onChange={e => setAuditDate(e.target.value)} 
                className="h-11 font-bold rounded-xl"
              />
            </div>
            <div className="flex flex-col items-center justify-center p-8 bg-emerald-50 rounded-3xl border border-dashed border-emerald-200 text-center">
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-600/60 mb-3">Verified Intake</p>
              <div className="text-5xl font-black text-emerald-600 tabular-nums tracking-tighter">
                ₹{auditTotal.toLocaleString()}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setIsDailyAuditOpen(false)} className="w-full font-bold h-11 rounded-xl">Close Audit</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
