
"use client"

import { useState, useEffect, useMemo } from "react"
import { History, Plus, Users, ChevronLeft, Loader2, IndianRupee, UserPlus, Info, Clock, AlertCircle, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { useFirestore, useCollection, useMemoFirebase, useUser } from "@/firebase"
import { collection, query, doc, serverTimestamp, orderBy, writeBatch } from "firebase/firestore"
import { useRole } from "@/hooks/use-role"
import { format, parseISO } from "date-fns"
import { cn, withTimeout } from "@/lib/utils"
import { createAuditLog } from "@/firebase/logging"

const INITIAL_CHIT_STATE = { 
  name: "", 
  monthlyAmount: 0, 
  totalMembers: 0, 
  startDate: new Date().toISOString().split('T')[0], 
  collectionType: "" 
}

const INITIAL_MEMBER_STATE = {
  name: "",
  phone: "",
  joinDate: new Date().toISOString().split('T')[0],
  paymentType: ""
}

const INITIAL_PAYMENT_STATE = {
  method: "Cash"
}

export default function RoundsPage() {
  const [selectedChitId, setSelectedChitId] = useState<string | null>(null)
  const [isAddChitDialogOpen, setIsAddChitDialogOpen] = useState(false)
  const [isAddMemberDialogOpen, setIsAddMemberDialogOpen] = useState(false)
  const [isQuickPaymentDialogOpen, setIsQuickPaymentDialogOpen] = useState(false)
  const [isMemberProfileDialogOpen, setIsMemberProfileDialogOpen] = useState(false)
  const [isPendingDetailsOpen, setIsPendingDetailsOpen] = useState(false)
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false)
  const [isActionPending, setIsActionPending] = useState(false)
  
  const [historyMember, setHistoryMember] = useState<any>(null)
  const [selectedMemberForPayment, setSelectedMemberForPayment] = useState<any>(null)
  const [selectedProfileMember, setSelectedProfileMember] = useState<any>(null)
  const [selectedPendingMember, setSelectedPendingMember] = useState<any>(null)
  const [newMember, setNewMember] = useState(INITIAL_MEMBER_STATE)
  const [paymentData, setPaymentData] = useState(INITIAL_PAYMENT_STATE)
  const [newChit, setNewChit] = useState(INITIAL_CHIT_STATE)
  
  const { toast } = useToast()
  const db = useFirestore()
  const { user } = useUser()
  const { isAdmin, isLoading: isRoleLoading } = useRole()

  const roundsQuery = useMemoFirebase(() => query(collection(db, 'chitRounds'), orderBy('createdAt', 'desc')), [db]);
  const { data: roundsData, isLoading: isRoundsLoading } = useCollection(roundsQuery);
  const chitSchemes = roundsData || [];

  const membersQuery = useMemoFirebase(() => query(collection(db, 'members'), orderBy('name', 'asc')), [db]);
  const { data: members } = useCollection(membersQuery);

  const paymentsQuery = useMemoFirebase(() => query(collection(db, 'payments'), orderBy('paymentDate', 'desc')), [db]);
  const { data: allPayments } = useCollection(paymentsQuery);

  useEffect(() => {
    const recoveryInterval = setInterval(() => {
      if (document.body.style.pointerEvents === 'none') {
        document.body.style.pointerEvents = 'auto'
        document.body.style.overflow = 'auto'
      }
    }, 1000)
    return () => clearInterval(recoveryInterval)
  }, [])

  const currentRound = useMemo(() => chitSchemes.find(r => r.id === selectedChitId), [chitSchemes, selectedChitId])
  const assignedMembers = useMemo(() => (members || []).filter(m => m.status !== 'inactive' && m.chitGroup === currentRound?.name), [members, currentRound])

  const calculateStatus = (member: any) => {
    if (!allPayments) return { paidToday: false };
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const paidToday = (allPayments || []).some(p => 
      p.memberId === member.id && 
      (p.status === 'success' || p.status === 'paid') &&
      (p.targetDate === todayStr || (p.paymentDate && format(parseISO(p.paymentDate), 'yyyy-MM-dd') === todayStr))
    );
    return { paidToday };
  };

  const handleQuickPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !selectedMemberForPayment || !currentRound || isActionPending) return;

    const schemeAmount = currentRound.monthlyAmount || 800;
    const paymentAmount = schemeAmount;
    
    setIsActionPending(true);
    const todayStr = format(new Date(), 'yyyy-MM-dd');

    try {
      const batch = writeBatch(db);
      const paymentRef = doc(collection(db, 'payments'));
      
      batch.set(paymentRef, {
        id: paymentRef.id,
        memberId: selectedMemberForPayment.id,
        memberName: selectedMemberForPayment.name,
        month: format(new Date(), 'MMMM yyyy'),
        targetDate: todayStr,
        amountPaid: paymentAmount,
        paymentDate: new Date().toISOString(),
        status: "success",
        method: paymentData.method,
        createdAt: serverTimestamp()
      });

      // Update Member Balance
      // Priority Rule: Payment first clears existing pendingAmount (Yesterday's debt)
      const memberRef = doc(db, 'members', selectedMemberForPayment.id);
      const currentArrears = selectedMemberForPayment.pendingAmount || 0;
      
      // Calculate remaining debt after this payment
      const newArrears = Math.max(0, currentArrears - paymentAmount);
      
      // Auto-clear pendingDays logic:
      // If payment settles a full unit of schemeAmount debt, decrement days.
      // If arrears become 0, pendingDays becomes 0.
      let newPendingDays = selectedMemberForPayment.pendingDays || 0;
      if (newArrears === 0) {
        newPendingDays = 0;
      } else if (newArrears < currentArrears) {
        // Reduced debt by one scheme amount unit
        newPendingDays = Math.max(0, newPendingDays - 1);
      }

      batch.update(memberRef, {
        totalPaid: (selectedMemberForPayment.totalPaid || 0) + paymentAmount,
        pendingAmount: newArrears,
        pendingDays: newPendingDays
      });

      await withTimeout(batch.commit());
      await createAuditLog(db, user, `Processed Payment ₹${paymentAmount} for ${selectedMemberForPayment.name}`);

      setPaymentData(INITIAL_PAYMENT_STATE);
      setIsQuickPaymentDialogOpen(false);
      toast({ title: "Payment Recorded", description: "Arrears updated. Daily aging happens at 10 PM." });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message || "Failed to record payment." });
    } finally {
      setIsActionPending(false);
    }
  }

  const handleAddChit = async (e: React.FormEvent) => {
    e.preventDefault(); 
    if (!db || isActionPending) return;
    setIsActionPending(true);
    try {
      const chitRef = doc(collection(db, 'chitRounds'));
      const chitData = {
        id: chitRef.id,
        ...newChit,
        monthlyAmount: Number(newChit.monthlyAmount),
        totalMembers: Number(newChit.totalMembers),
        createdAt: serverTimestamp()
      };
      const batch = writeBatch(db);
      batch.set(chitRef, chitData);
      await withTimeout(batch.commit());
      
      await createAuditLog(db, user, `Created new scheme: ${newChit.name}`)
      setIsAddChitDialogOpen(false); 
      setNewChit(INITIAL_CHIT_STATE);
      toast({ title: "Scheme Created", description: "The scheme has been added." });
    } catch (e: any) { 
      toast({ variant: "destructive", title: "Error", description: e.message || "Failed to create scheme." }); 
    } finally { 
      setIsActionPending(false); 
    }
  }

  const handleAddMemberToScheme = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !currentRound || isActionPending) return;
    setIsActionPending(true);
    try {
      const memberRef = doc(collection(db, 'members'));
      const memberData = {
        id: memberRef.id,
        ...newMember,
        chitGroup: currentRound.name,
        monthlyAmount: currentRound.monthlyAmount,
        status: "active",
        totalPaid: 0,
        pendingDays: 0,
        pendingAmount: 0,
        lastPendingUpdateDate: format(new Date(), 'yyyy-MM-dd'),
        createdAt: serverTimestamp(),
      };
      const batch = writeBatch(db);
      batch.set(memberRef, memberData);
      await withTimeout(batch.commit());

      await createAuditLog(db, user, `Registered ${newMember.name} to scheme ${currentRound.name}`);
      setIsAddMemberDialogOpen(false);
      setNewMember(INITIAL_MEMBER_STATE);
      toast({ title: "Member Registered", description: `${newMember.name} joined.` });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message || "Failed to register member." });
    } finally {
      setIsActionPending(false);
    }
  }

  if (isRoleLoading || isRoundsLoading) return (<div className="flex h-[60vh] items-center justify-center"><Loader2 className="size-8 animate-spin text-primary" /></div>)

  if (!selectedChitId) {
    return (
      <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-500 pb-10">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h2 className="text-2xl sm:text-3xl font-headline font-bold tracking-tight text-primary">Seat Reservations</h2>
            <p className="text-sm text-muted-foreground">Manage schemes and seat availability.</p>
          </div>
          <Button onClick={() => setIsAddChitDialogOpen(true)} className="font-bold gap-2">
            <Plus className="size-4" /> Add Scheme
          </Button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {chitSchemes.map((group) => (
            <Card key={group.id} className="hover:shadow-md transition-all border-border/50 overflow-hidden flex flex-col">
              <CardHeader className="bg-muted/20 p-4 space-y-2">
                <Badge variant="outline" className="text-[10px] font-bold uppercase w-fit">{group.collectionType}</Badge>
                <CardTitle className="text-lg truncate font-bold">{group.name}</CardTitle>
                <CardDescription className="text-xs">Capacity: {group.totalMembers} Seats</CardDescription>
              </CardHeader>
              <CardContent className="p-4 flex-1 space-y-3">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-muted-foreground">Scheme Amount:</span>
                  <span className="text-primary">₹{(group.monthlyAmount || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-muted-foreground">Occupancy:</span>
                  <span>{(members || []).filter(m => m.status !== 'inactive' && m.chitGroup === group.name).length} / {group.totalMembers}</span>
                </div>
              </CardContent>
              <CardFooter className="p-0 border-t">
                <Button variant="ghost" className="w-full h-10 rounded-none text-xs font-bold" onClick={() => setSelectedChitId(group.id)}>View Board</Button>
              </CardFooter>
            </Card>
          ))}
        </div>

        <Dialog open={isAddChitDialogOpen} onOpenChange={setIsAddChitDialogOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <form onSubmit={handleAddChit}>
              <DialogHeader><DialogTitle>New Scheme</DialogTitle><DialogDescription>Define a new chit fund scheme.</DialogDescription></DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2"><Label>Name</Label><Input value={newChit.name} onChange={e => setNewChit({...newChit, name: e.target.value})} required /></div>
                <div className="grid gap-2"><Label>Amount (₹)</Label><Input type="number" value={newChit.monthlyAmount || ""} onChange={e => setNewChit({...newChit, monthlyAmount: Number(e.target.value)})} required /></div>
                <div className="grid gap-2"><Label>Max Members</Label><Input type="number" value={newChit.totalMembers || ""} onChange={e => setNewChit({...newChit, totalMembers: Number(e.target.value)})} required /></div>
                <div className="grid gap-2">
                  <Label>Collection Type</Label>
                  <Select value={newChit.collectionType} onValueChange={(v) => setNewChit({...newChit, collectionType: v})}>
                    <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                    <SelectContent><SelectItem value="Daily">Daily</SelectItem><SelectItem value="Monthly">Monthly</SelectItem></SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter><Button type="submit" disabled={isActionPending} className="w-full font-bold">{isActionPending ? <Loader2 className="mr-2 animate-spin" /> : null}Create Scheme</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    )
  }

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-500 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setSelectedChitId(null)} className="rounded-full h-9 w-9"><ChevronLeft className="size-5" /></Button>
          <div className="min-w-0">
            <h2 className="text-xl sm:text-2xl font-bold truncate tracking-tight text-primary">{currentRound?.name}</h2>
            <p className="text-[10px] uppercase font-bold tracking-tight text-muted-foreground">Board Registry</p>
          </div>
        </div>
        <Button onClick={() => setIsAddMemberDialogOpen(true)} className="font-bold gap-2"><UserPlus className="size-4" /> Add Participant</Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="shadow-sm border-l-4 border-l-primary/40"><CardHeader className="p-3 pb-1"><CardTitle className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Type</CardTitle></CardHeader><CardContent className="p-3 pt-0"><div className="text-lg font-bold">{currentRound?.collectionType}</div></CardContent></Card>
        <Card className="shadow-sm border-l-4 border-l-primary"><CardHeader className="p-3 pb-1"><CardTitle className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Seats</CardTitle></CardHeader><CardContent className="p-3 pt-0"><div className="text-lg font-bold">{assignedMembers.length} / {currentRound?.totalMembers}</div></CardContent></Card>
        <Card className="shadow-sm border-l-4 border-l-amber-500"><CardHeader className="p-3 pb-1"><CardTitle className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Scheme Base</CardTitle></CardHeader><CardContent className="p-3 pt-0"><div className="text-lg font-bold text-amber-600">₹{(currentRound?.monthlyAmount || 0).toLocaleString()}</div></CardContent></Card>
        <Card className="shadow-sm border-l-4 border-l-emerald-500"><CardHeader className="p-3 pb-1"><CardTitle className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Group Total</CardTitle></CardHeader><CardContent className="p-3 pt-0"><div className="text-lg font-bold text-emerald-600">₹{assignedMembers.reduce((acc, m) => acc + (m.totalPaid || 0), 0).toLocaleString()}</div></CardContent></Card>
      </div>

      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <div className="p-4 border-b bg-muted/20 flex justify-between items-center"><h3 className="text-sm font-bold flex items-center gap-2 tracking-tight"><Users className="size-4 text-primary" /> Active Board</h3></div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead className="text-[10px] uppercase font-bold tracking-wider pl-6">Member</TableHead>
                <TableHead className="text-[10px] uppercase font-bold tracking-wider">Pending Dates</TableHead>
                <TableHead className="text-[10px] uppercase font-bold tracking-wider">Status</TableHead>
                <TableHead className="w-[120px] pr-6"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assignedMembers.length > 0 ? assignedMembers.map((m) => {
                const { paidToday } = calculateStatus(m);
                const isDaily = (m.paymentType || currentRound?.collectionType || "").toLowerCase() === 'daily';
                const pDays = m.pendingDays || 0;
                
                return (
                  <TableRow key={m.id} className="hover:bg-muted/5 transition-colors">
                    <TableCell className="pl-6">
                      <div className="flex items-center gap-2 cursor-pointer group" onClick={() => { setSelectedProfileMember(m); setIsMemberProfileDialogOpen(true); }}>
                        <div className="h-7 w-7 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-[10px]">{m.name.split(' ').map((n: string) => n[0]).join('')}</div>
                        <div className="flex flex-col">
                          <span className="text-xs font-semibold group-hover:text-primary transition-colors">{m.name}</span>
                          <span className="text-[9px] font-bold text-muted-foreground uppercase">{m.phone}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <button 
                        onClick={() => { setSelectedPendingMember(m); setIsPendingDetailsOpen(true); }}
                        className={cn(
                          "px-2 py-0.5 rounded-full text-[10px] font-bold tabular-nums transition-colors",
                          pDays > 0 ? "bg-destructive/10 text-destructive hover:bg-destructive/20" : "bg-muted text-muted-foreground"
                        )}
                      >
                        ⏳ {pDays} {pDays === 1 ? 'Date' : 'Dates'}
                      </button>
                    </TableCell>
                    <TableCell>
                      <Badge variant={paidToday ? 'default' : 'secondary'} className={cn("text-[8px] font-bold uppercase", paidToday ? "bg-emerald-500" : (isDaily ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"))}>
                        {paidToday ? 'paid' : (isDaily ? 'pending' : 'Due (Month End)')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right pr-6">
                      <div className="flex items-center justify-end gap-1">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-emerald-600" 
                          onClick={() => { setSelectedMemberForPayment(m); setIsQuickPaymentDialogOpen(true); }}
                        >
                          <IndianRupee className="size-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-muted-foreground" 
                          onClick={() => { setHistoryMember(m); setIsHistoryDialogOpen(true); }}
                        >
                          <History className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              }) : <TableRow><TableCell colSpan={4} className="h-32 text-center text-xs text-muted-foreground italic">No participants found.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={isPendingDetailsOpen} onOpenChange={setIsPendingDetailsOpen}>
        <DialogContent className="sm:max-w-[400px]">
          {selectedPendingMember && (
            <>
              <DialogHeader><DialogTitle>💬 Pending Arrears</DialogTitle></DialogHeader>
              <div className="space-y-4 py-4">
                <div className="p-4 bg-muted/30 rounded-xl space-y-3">
                   <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground font-medium">Member</span>
                      <span className="font-bold">{selectedPendingMember.name}</span>
                   </div>
                   <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground font-medium">Missed Installments</span>
                      <span className="font-bold">{selectedPendingMember.pendingDays} Dates</span>
                   </div>
                   <div className="flex justify-between items-center pt-2 border-t">
                      <span className="text-xs font-bold uppercase text-destructive tracking-widest">Total Pending Amount</span>
                      <span className="text-lg font-bold text-destructive">₹{(selectedPendingMember.pendingAmount || 0).toLocaleString()}</span>
                   </div>
                </div>
                <div className="p-3 bg-primary/5 rounded-lg border border-primary/10">
                   <p className="text-[10px] text-primary font-bold uppercase tracking-wider mb-1">Production Policy</p>
                   <p className="text-xs text-muted-foreground leading-relaxed italic">Arrears are aged daily at 10 PM. Payments first clear previous debt before applying to current cycle.</p>
                </div>
              </div>
              <DialogFooter><Button onClick={() => setIsPendingDetailsOpen(false)} className="w-full font-bold">Close</Button></DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isQuickPaymentDialogOpen} onOpenChange={setIsQuickPaymentDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          {selectedMemberForPayment && (
            <form onSubmit={handleQuickPayment}>
              <DialogHeader><DialogTitle>Process Fixed Payment</DialogTitle><DialogDescription>Installment for {selectedMemberForPayment.name}.</DialogDescription></DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label>Scheme Amount (₹) - Fixed</Label>
                  <Input type="number" value={currentRound?.monthlyAmount || 800} readOnly className="bg-muted font-bold text-lg" />
                  <p className="text-[10px] text-muted-foreground italic">Accepts only the full scheme amount. Debt age is calculated nightly at 10 PM.</p>
                </div>
                <div className="grid gap-2">
                  <Label>Method</Label>
                  <Select value={paymentData.method} onValueChange={(v) => setPaymentData({...paymentData, method: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="Cash">Cash</SelectItem><SelectItem value="UPI">UPI</SelectItem><SelectItem value="Transfer">Transfer</SelectItem></SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter><Button type="submit" disabled={isActionPending} className="w-full font-bold bg-emerald-600 hover:bg-emerald-700">{isActionPending ? <Loader2 className="mr-2 animate-spin" /> : <CheckCircle2 className="mr-2 size-4" />}Confirm Installment</Button></DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isAddMemberDialogOpen} onOpenChange={setIsAddMemberDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <form onSubmit={handleAddMemberToScheme}>
            <DialogHeader><DialogTitle>Register Participant</DialogTitle><DialogDescription>Join {currentRound?.name} scheme.</DialogDescription></DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2"><Label>Full Name</Label><Input value={newMember.name} onChange={e => setNewMember({...newMember, name: e.target.value})} required /></div>
              <div className="grid gap-2"><Label>Phone</Label><Input value={newMember.phone} onChange={e => setNewMember({...newMember, phone: e.target.value})} required /></div>
              <div className="grid gap-2"><Label>Join Date</Label><Input type="date" value={newMember.joinDate} onChange={e => setNewMember({...newMember, joinDate: e.target.value})} required /></div>
            </div>
            <DialogFooter><Button type="submit" disabled={isActionPending} className="w-full font-bold">{isActionPending ? <Loader2 className="mr-2 animate-spin" /> : null}Register Member</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isHistoryDialogOpen} onOpenChange={setIsHistoryDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader><DialogTitle>Payment History: {historyMember?.name}</DialogTitle></DialogHeader>
          <div className="py-4 overflow-x-auto">
            <Table>
              <TableHeader><TableRow><TableHead className="text-xs font-bold">Date</TableHead><TableHead className="text-xs font-bold">Amount</TableHead></TableRow></TableHeader>
              <TableBody>
                {allPayments?.filter(p => p.memberId === historyMember?.id).map((p, i) => (
                  <TableRow key={i}><TableCell className="text-xs font-medium">{format(parseISO(p.paymentDate), 'dd MMM yyyy')}</TableCell><TableCell className="text-xs font-bold text-emerald-600">₹{p.amountPaid?.toLocaleString()}</TableCell></TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <DialogFooter><Button onClick={() => setIsHistoryDialogOpen(false)} className="w-full font-bold">Close</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isMemberProfileDialogOpen} onOpenChange={setIsMemberProfileDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader><DialogTitle>Member Profile</DialogTitle></DialogHeader>
          {selectedProfileMember && (
            <div className="space-y-4 py-4">
               <div className="flex justify-between items-center py-2 border-b"><span className="text-xs text-muted-foreground">Name</span><span className="font-bold text-sm">{selectedProfileMember.name}</span></div>
               <div className="flex justify-between items-center py-2 border-b"><span className="text-xs text-muted-foreground">Phone</span><span className="font-bold text-sm">{selectedProfileMember.phone}</span></div>
               <div className="flex justify-between items-center py-2 border-b"><span className="text-xs text-muted-foreground">Joined</span><span className="font-bold text-sm">{selectedProfileMember.joinDate}</span></div>
               <div className="flex justify-between items-center py-2 border-b"><span className="text-xs text-muted-foreground">Total Contributed</span><span className="font-bold text-emerald-600 text-sm">₹{(selectedProfileMember.totalPaid || 0).toLocaleString()}</span></div>
            </div>
          )}
          <DialogFooter><Button onClick={() => setIsMemberProfileDialogOpen(false)} className="w-full font-bold">Close</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
