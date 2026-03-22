
"use client"

import { useState, useMemo } from "react"
import { 
  CalendarClock, Plus, ChevronRight, ChevronLeft, 
  Users, IndianRupee, History, FolderKanban, 
  Loader2, CheckCircle2, AlertCircle, CalendarRange, 
  Trash2, Play, Pause, CreditCard
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
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
import { format, parseISO, isWithinInterval, isValid } from "date-fns"
import { cn, withTimeout } from "@/lib/utils"
import { createAuditLog } from "@/firebase/logging"
import { useToast } from "@/hooks/use-toast"

export default function CyclesDashboard() {
  // Navigation State
  const [view, setView] = useState<'list' | 'groups' | 'schemes' | 'members'>('list')
  const [selectedCycle, setSelectedCycle] = useState<any>(null)
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null)
  const [selectedScheme, setSelectedScheme] = useState<any>(null)

  // Dialog States
  const [isAddCycleOpen, setIsAddCycleOpen] = useState(false)
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false)
  const [targetMemberForPayment, setTargetMemberForPayment] = useState<any>(null)
  const [paymentAmount, setPaymentAmount] = useState<number>(0)
  const [paymentMethod, setPaymentMethod] = useState("Cash")

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

  const schemesQuery = useMemoFirebase(() => collection(db, 'chitRounds'), [db])
  const { data: schemes } = useCollection(schemesQuery)

  const membersQuery = useMemoFirebase(() => collection(db, 'members'), [db])
  const { data: members } = useCollection(membersQuery)

  const paymentsQuery = useMemoFirebase(() => collection(db, 'payments'), [db])
  const { data: payments } = useCollection(paymentsQuery)

  // Derived Data
  const filteredPayments = useMemo(() => {
    if (!selectedCycle || !payments) return []
    const start = parseISO(selectedCycle.startDate)
    const end = parseISO(selectedCycle.endDate)
    
    return payments.filter(p => {
      if (p.status !== 'success' && p.status !== 'paid') return false
      const pDateStr = p.targetDate || (p.paymentDate ? format(parseISO(p.paymentDate), 'yyyy-MM-dd') : null)
      if (!pDateStr) return false
      try {
        const pDate = parseISO(pDateStr)
        return isWithinInterval(pDate, { start, end })
      } catch {
        return false
      }
    })
  }, [selectedCycle, payments])

  const schemeCollections = useMemo(() => {
    const map = new Map<string, number>()
    filteredPayments.forEach(p => {
      const current = map.get(p.memberId) || 0
      map.set(p.memberId, current + (p.amountPaid || 0))
    })
    return map
  }, [filteredPayments])

  const groupStats = useMemo(() => {
    if (!selectedCycle || !members || !schemes) return []
    const groups = ['A', 'B', 'C', 'D']
    return groups.map(g => {
      const groupMembers = members.filter(m => m.chitGroup === g && m.status !== 'inactive')
      const groupCollection = filteredPayments
        .filter(p => groupMembers.some(m => m.id === p.memberId))
        .reduce((acc, p) => acc + (p.amountPaid || 0), 0)
      
      return { name: g, collection: groupCollection, membersCount: groupMembers.length }
    })
  }, [selectedCycle, members, schemes, filteredPayments])

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
      await createAuditLog(db, user, `Created new cycle: ${newCycle.name} (${newCycle.startDate} to ${newCycle.endDate})`)
      setIsAddCycleOpen(false)
      setNewCycle({
        name: "",
        startDate: format(new Date(), 'yyyy-MM-dd'),
        endDate: format(new Date(), 'yyyy-MM-dd'),
        status: "active"
      })
      toast({ title: "Cycle Created", description: "New monitoring period added." })
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
      
      batch.set(paymentRef, {
        id: paymentRef.id,
        memberId: targetMemberForPayment.id,
        memberName: targetMemberForPayment.name,
        month: format(new Date(), 'MMMM yyyy'),
        targetDate: format(new Date(), 'yyyy-MM-dd'),
        amountPaid: Number(paymentAmount),
        paymentDate: new Date().toISOString(),
        status: "success",
        method: paymentMethod,
        createdAt: serverTimestamp()
      })

      const memberRef = doc(db, 'members', targetMemberForPayment.id)
      batch.update(memberRef, {
        totalPaid: (targetMemberForPayment.totalPaid || 0) + Number(paymentAmount)
      })

      await batch.commit()
      await createAuditLog(db, user, `Cycle Payment: ₹${paymentAmount} for ${targetMemberForPayment.name}`)
      setIsPaymentDialogOpen(false)
      toast({ title: "Payment Recorded", description: "Ledger updated." })
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
      await createAuditLog(db, user, `Changed cycle ${cycle.name} status to ${newStatus}`)
      setSelectedCycle({ ...cycle, status: newStatus })
      toast({ title: "Status Updated", description: `Cycle is now ${newStatus}.` })
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message })
    } finally {
      setIsActionPending(false)
    }
  }

  const deleteCycle = async (id: string) => {
    if (!db || isActionPending) return
    setIsActionPending(true)
    try {
      await deleteDoc(doc(db, 'cycles', id))
      await createAuditLog(db, user, `Deleted cycle record`)
      toast({ title: "Cycle Deleted" })
      setView('list')
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message })
    } finally {
      setIsActionPending(false)
    }
  }

  // Views
  if (cyclesLoading) return <div className="flex h-[60vh] items-center justify-center"><Loader2 className="size-8 animate-spin text-primary" /></div>

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-10 overflow-x-hidden">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          {view !== 'list' && (
            <Button 
              variant="outline" size="icon" 
              onClick={() => {
                if (view === 'groups') setView('list')
                else if (view === 'schemes') setView('groups')
                else if (view === 'members') setView('schemes')
              }}
              className="rounded-full"
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
                ? 'Select a custom period to audit collections.' 
                : `${format(parseISO(selectedCycle.startDate), 'MMM dd')} → ${format(parseISO(selectedCycle.endDate), 'MMM dd, yyyy')}`}
            </p>
          </div>
        </div>
        {view === 'list' && (
          <Button onClick={() => setIsAddCycleOpen(true)} className="font-bold gap-2">
            <Plus className="size-5" /> New Cycle
          </Button>
        )}
      </div>

      {/* VIEW: LIST OF CYCLES */}
      {view === 'list' && (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {cycles?.length === 0 ? (
            <Card className="col-span-full h-40 flex items-center justify-center border-dashed">
              <div className="text-center space-y-2">
                <CalendarRange className="size-10 text-muted-foreground/30 mx-auto" />
                <p className="text-muted-foreground italic text-sm">No cycles defined yet.</p>
              </div>
            </Card>
          ) : cycles?.map(cycle => (
            <Card 
              key={cycle.id} 
              className="group cursor-pointer hover:shadow-xl transition-all border-border/60 overflow-hidden relative shadow-sm rounded-2xl"
              onClick={() => { setSelectedCycle(cycle); setView('groups'); }}
            >
              <CardHeader className="p-5 pb-2 bg-muted/10 border-b border-border/40">
                <div className="flex justify-between items-start">
                  <Badge variant={cycle.status === 'active' ? 'default' : 'secondary'} className="uppercase text-[9px] font-black tracking-widest px-2">
                    {cycle.status}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground font-bold tabular-nums">
                    {format(parseISO(cycle.startDate), 'dd MMM')} - {format(parseISO(cycle.endDate), 'dd MMM yyyy')}
                  </span>
                </div>
                <CardTitle className="text-xl font-black uppercase tracking-tight mt-3">
                  {cycle.name}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-[9px] font-black uppercase text-muted-foreground/60 tracking-widest">Revenue captured</span>
                    <span className="text-lg font-bold text-emerald-600">₹{payments?.filter(p => {
                       const pDateStr = p.targetDate || (p.paymentDate ? format(parseISO(p.paymentDate), 'yyyy-MM-dd') : null)
                       if (!pDateStr) return false
                       return pDateStr >= cycle.startDate && pDateStr <= cycle.endDate && (p.status === 'success' || p.status === 'paid')
                    }).reduce((acc, p) => acc + (p.amountPaid || 0), 0).toLocaleString()}</span>
                  </div>
                  <ChevronRight className="size-5 text-primary opacity-30 group-hover:opacity-100 transition-all" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* VIEW: GROUPS IN CYCLE */}
      {view === 'groups' && selectedCycle && (
        <div className="space-y-8 animate-in slide-in-from-right-4 duration-300">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {groupStats.map(group => (
              <Card 
                key={group.name} 
                className="group cursor-pointer hover:border-primary transition-all border-border/60 shadow-sm rounded-2xl"
                onClick={() => { setSelectedGroup(group.name); setView('schemes'); }}
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

          <Card className="border-border/60 rounded-2xl">
            <CardHeader className="bg-muted/10 border-b p-6">
              <CardTitle className="text-lg font-black uppercase">Cycle Administration</CardTitle>
              <CardDescription>Manage this monitoring period's configuration.</CardDescription>
            </CardHeader>
            <CardContent className="p-6 flex flex-col sm:flex-row gap-4">
              <Button 
                variant="outline" 
                className="flex-1 font-bold gap-2 h-12"
                onClick={() => toggleCycleStatus(selectedCycle)}
                disabled={isActionPending}
              >
                {selectedCycle.status === 'active' ? <Pause className="size-4" /> : <Play className="size-4" />}
                {selectedCycle.status === 'active' ? 'Mark as Past' : 'Mark as Active'}
              </Button>
              <Button 
                variant="destructive" 
                className="flex-1 font-bold gap-2 h-12"
                onClick={() => deleteCycle(selectedCycle.id)}
                disabled={isActionPending}
              >
                <Trash2 className="size-4" /> Delete Cycle
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* VIEW: SCHEMES IN GROUP */}
      {view === 'schemes' && selectedGroup && (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 animate-in slide-in-from-right-4 duration-300">
          {schemes?.filter(s => s.name === selectedGroup || s.name.startsWith(selectedGroup)).map(scheme => {
            const schemeMembers = members?.filter(m => m.chitGroup === scheme.name && m.status !== 'inactive') || []
            const schemeTotal = filteredPayments
              .filter(p => schemeMembers.some(m => m.id === p.memberId))
              .reduce((acc, p) => acc + (p.amountPaid || 0), 0)

            return (
              <Card 
                key={scheme.id} 
                className="group cursor-pointer hover:shadow-lg transition-all border-border/60 shadow-sm rounded-2xl"
                onClick={() => { setSelectedScheme(scheme); setView('members'); }}
              >
                <CardHeader className="p-5 bg-muted/5 border-b">
                  <CardTitle className="text-lg font-black uppercase">{scheme.name}</CardTitle>
                  <CardDescription className="text-[10px] font-bold uppercase">{scheme.collectionType} Collection</CardDescription>
                </CardHeader>
                <CardContent className="p-5">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-[10px] font-black uppercase text-muted-foreground/60">Cycle Intake</span>
                    <span className="text-xl font-bold text-emerald-600">₹{schemeTotal.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-muted-foreground font-semibold">Total Seats</span>
                    <span className="font-bold">{schemeMembers.length} / {scheme.totalMembers}</span>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* VIEW: MEMBERS IN SCHEME */}
      {view === 'members' && selectedScheme && (
        <Card className="rounded-2xl border-border/60 overflow-hidden shadow-sm animate-in slide-in-from-right-4 duration-300">
          <CardHeader className="bg-muted/20 p-6 flex flex-row items-center justify-between border-b">
            <div>
              <CardTitle className="text-xl font-black uppercase">{selectedScheme.name} Members</CardTitle>
              <CardDescription>Ledger for cycle: {selectedCycle.name}</CardDescription>
            </div>
            <Badge variant={selectedCycle.status === 'active' ? 'default' : 'secondary'} className="uppercase font-black text-[9px] tracking-widest">
              {selectedCycle.status === 'active' ? 'Payments Open' : 'Historical View'}
            </Badge>
          </CardHeader>
          <Table>
            <TableHeader className="bg-muted/10">
              <TableRow>
                <TableHead className="text-[10px] font-black uppercase tracking-widest h-12 pl-6">Participant</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest h-12">Cycle Total</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest h-12 text-right pr-6">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members?.filter(m => m.chitGroup === selectedScheme.name && m.status !== 'inactive').map(m => {
                const memberTotal = schemeCollections.get(m.id) || 0
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
                    <TableCell className="text-right pr-6">
                      <Button 
                        size="sm" 
                        variant={selectedCycle.status === 'active' ? 'default' : 'ghost'}
                        className={cn("h-8 gap-2", selectedCycle.status !== 'active' && "cursor-default")}
                        disabled={selectedCycle.status !== 'active' || isActionPending}
                        onClick={() => {
                          if (selectedCycle.status === 'active') {
                            setTargetMemberForPayment(m)
                            setPaymentAmount(selectedScheme.monthlyAmount)
                            setIsPaymentDialogOpen(true)
                          }
                        }}
                      >
                        {selectedCycle.status === 'active' ? (
                          <><IndianRupee className="size-3.5" /> Pay</>
                        ) : (
                          <><History className="size-3.5" /> History</>
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* DIALOGS */}
      <Dialog open={isAddCycleOpen} onOpenChange={setIsAddCycleOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <form onSubmit={handleAddCycle}>
            <DialogHeader>
              <DialogTitle className="text-xl font-bold">New Monitoring Cycle</DialogTitle>
              <DialogDescription>Define a custom date range to audit performance.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-5 py-6">
              <div className="grid gap-2">
                <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Cycle Name</Label>
                <Input 
                  value={newCycle.name} 
                  onChange={e => setNewCycle({...newCycle, name: e.target.value})} 
                  placeholder="e.g. March 22 - April 22"
                  required 
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
                  />
                </div>
                <div className="grid gap-2">
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">End Date</Label>
                  <Input 
                    type="date" 
                    value={newCycle.endDate} 
                    onChange={e => setNewCycle({...newCycle, endDate: e.target.value})} 
                    required 
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={isActionPending} className="w-full font-bold">
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
                <DialogTitle>Cycle Payment</DialogTitle>
                <DialogDescription>Record a payment within {selectedCycle?.name}.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-5 py-6">
                <div className="p-3 bg-muted rounded-lg text-sm">
                  <p className="text-muted-foreground font-semibold">Member</p>
                  <p className="font-bold text-lg">{targetMemberForPayment.name}</p>
                </div>
                <div className="grid gap-2">
                  <Label className="text-[10px] font-bold uppercase text-muted-foreground">Amount (₹)</Label>
                  <Input 
                    type="number" 
                    value={paymentAmount} 
                    onChange={e => setPaymentAmount(Number(e.target.value))} 
                    required 
                  />
                </div>
                <div className="grid gap-2">
                  <Label className="text-[10px] font-bold uppercase text-muted-foreground">Method</Label>
                  <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Cash">Cash</SelectItem>
                      <SelectItem value="UPI">UPI</SelectItem>
                      <SelectItem value="Transfer">Bank Transfer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={isActionPending} className="w-full font-bold h-12 bg-emerald-600 hover:bg-emerald-700">
                  {isActionPending ? <Loader2 className="mr-2 animate-spin" /> : <CreditCard className="mr-2 size-5" />}
                  Confirm Cycle Payment
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
