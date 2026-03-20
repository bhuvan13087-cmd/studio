
"use client"

import { useState, useEffect, useMemo } from "react"
import { History, Plus, Users, ChevronLeft, Loader2, IndianRupee, UserPlus, Info, Clock, AlertCircle, CheckCircle2, LayoutDashboard, Search, RefreshCcw, TrendingUp } from "lucide-react"
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

  const membersQuery = useMemoFirebase(() => collection(db, 'members'), [db]);
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

  const getGroupMonthlyCollection = (groupName: string) => {
    if (!allPayments || !members) return 0;
    const currentMonth = format(new Date(), 'MMMM yyyy');
    const groupMemberIds = new Set(members.filter(m => m.chitGroup === groupName).map(m => m.id));
    return allPayments
      .filter(p => groupMemberIds.has(p.memberId) && p.month === currentMonth && (p.status === 'success' || p.status === 'paid'))
      .reduce((acc, p) => acc + (p.amountPaid || 0), 0);
  };

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

      const memberRef = doc(db, 'members', selectedMemberForPayment.id);
      const currentArrears = selectedMemberForPayment.pendingAmount || 0;
      const newArrears = Math.max(0, currentArrears - paymentAmount);
      
      let newPendingDays = selectedMemberForPayment.pendingDays || 0;
      if (newArrears === 0) {
        newPendingDays = 0;
      } else if (newArrears < currentArrears) {
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
      toast({ title: "Payment Recorded", description: "Arrears updated." });
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
      <div className="space-y-8 animate-in fade-in duration-500 pb-10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-primary font-headline">Seat Reservations</h2>
            <p className="text-sm text-muted-foreground font-medium">Manage schemes and seat availability.</p>
          </div>
          <Button onClick={() => setIsAddChitDialogOpen(true)} className="font-bold gap-2 px-6 h-11 shadow-lg bg-primary hover:bg-primary/90 transition-all active:scale-95">
            <Plus className="size-5" /> Add Scheme
          </Button>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {chitSchemes.map((group) => {
            const currentOccupancy = (members || []).filter(m => m.status !== 'inactive' && m.chitGroup === group.name).length;
            const groupMonthCollection = getGroupMonthlyCollection(group.name);
            return (
              <Card key={group.id} className="group hover:shadow-xl transition-all border-border/60 overflow-hidden flex flex-col relative bg-card shadow-sm rounded-2xl">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary/40 via-primary to-primary/40" />
                <CardHeader className="bg-muted/30 p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 bg-background border-primary/20 text-primary">
                      {group.collectionType}
                    </Badge>
                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                      <Users className="size-3" /> {group.totalMembers} Seats
                    </div>
                  </div>
                  <CardTitle className="text-xl font-bold tracking-tight text-foreground truncate">Group {group.name}</CardTitle>
                </CardHeader>
                <CardContent className="p-5 flex-1 space-y-4">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-muted-foreground font-semibold">Scheme Amount</span>
                      <span className="font-bold text-primary text-sm">₹{(group.monthlyAmount || 0).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-muted-foreground font-semibold">Group Collection</span>
                      <span className="font-bold text-emerald-600 text-sm">₹{groupMonthCollection.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-muted-foreground font-semibold">Occupancy</span>
                      <span className="font-black tabular-nums">
                        {currentOccupancy} <span className="text-muted-foreground font-medium">/ {group.totalMembers}</span>
                      </span>
                    </div>
                  </div>
                  <div className="w-full bg-muted h-1.5 rounded-full overflow-hidden">
                    <div 
                      className="bg-primary h-full transition-all duration-500" 
                      style={{ width: `${(currentOccupancy / group.totalMembers) * 100}%` }}
                    />
                  </div>
                </CardContent>
                <CardFooter className="p-4 bg-muted/10 border-t border-border/50">
                  <Button 
                    variant="ghost" 
                    className="w-full h-10 font-black text-[10px] uppercase tracking-[0.2em] hover:bg-primary hover:text-primary-foreground transition-all rounded-xl"
                    onClick={() => setSelectedChitId(group.id)}
                  >
                    View Board
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>

        <Dialog open={isAddChitDialogOpen} onOpenChange={setIsAddChitDialogOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <form onSubmit={handleAddChit}>
              <DialogHeader>
                <DialogTitle className="text-xl font-bold">New Scheme</DialogTitle>
                <DialogDescription className="font-medium">Define a new chit fund scheme parameters.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-5 py-6">
                <div className="grid gap-2">
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Scheme Name</Label>
                  <Input value={newChit.name} onChange={e => setNewChit({...newChit, name: e.target.value})} required className="h-11 rounded-xl" placeholder="e.g. Group A" />
                </div>
                <div className="grid gap-2">
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Amount (₹)</Label>
                  <Input type="number" value={newChit.monthlyAmount || ""} onChange={e => setNewChit({...newChit, monthlyAmount: Number(e.target.value)})} required className="h-11 rounded-xl" placeholder="800" />
                </div>
                <div className="grid gap-2">
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Max Members</Label>
                  <Input type="number" value={newChit.totalMembers || ""} onChange={e => setNewChit({...newChit, totalMembers: Number(e.target.value)})} required className="h-11 rounded-xl" placeholder="20" />
                </div>
                <div className="grid gap-2">
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Collection Type</Label>
                  <Select value={newChit.collectionType} onValueChange={(v) => setNewChit({...newChit, collectionType: v})}>
                    <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Select frequency" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Daily">Daily</SelectItem>
                      <SelectItem value="Monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={isActionPending} className="w-full h-11 font-bold text-base shadow-lg active:scale-[0.98] transition-all">
                  {isActionPending ? <Loader2 className="mr-2 animate-spin" /> : null}
                  Create Scheme
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    )
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => setSelectedChitId(null)} className="rounded-full h-10 w-10 shadow-sm hover:shadow-md transition-all active:scale-95"><ChevronLeft className="size-5" /></Button>
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-xl sm:text-2xl font-black truncate tracking-tight text-primary font-headline uppercase">{currentRound?.name}</h2>
              <Badge variant="secondary" className="text-[9px] font-black tracking-tighter bg-primary/10 text-primary border-none">{currentRound?.collectionType}</Badge>
            </div>
            <p className="text-[10px] uppercase font-bold tracking-[0.2em] text-muted-foreground/60 flex items-center gap-1.5">
              <LayoutDashboard className="size-3" /> Management Board Registry
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
           <Button variant="outline" className="font-bold gap-2 h-11 px-4 shadow-sm border-border/60 hover:bg-muted/50">
             <RefreshCcw className="size-4 text-muted-foreground" /> Sync Pending
           </Button>
           <Button onClick={() => setIsAddMemberDialogOpen(true)} className="font-bold gap-2 h-11 px-6 shadow-lg active:scale-95 transition-all">
             <UserPlus className="size-5" /> Add Member
           </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="shadow-sm border-l-4 border-l-primary/40 bg-card rounded-2xl"><CardHeader className="p-4 pb-2"><CardTitle className="text-[10px] uppercase font-bold text-muted-foreground/60 tracking-widest">Base Scheme</CardTitle></CardHeader><CardContent className="p-4 pt-0"><div className="text-2xl font-black tabular-nums">₹{(currentRound?.monthlyAmount || 0).toLocaleString()}</div></CardContent></Card>
        <Card className="shadow-sm border-l-4 border-l-primary bg-card rounded-2xl"><CardHeader className="p-4 pb-2"><CardTitle className="text-[10px] uppercase font-bold text-muted-foreground/60 tracking-widest">Occupancy</CardTitle></CardHeader><CardContent className="p-4 pt-0"><div className="text-2xl font-black tabular-nums">{assignedMembers.length} <span className="text-sm font-bold text-muted-foreground">/ {currentRound?.totalMembers}</span></div></CardContent></Card>
        <Card className="shadow-sm border-l-4 border-l-amber-500 bg-card rounded-2xl"><CardHeader className="p-4 pb-2"><CardTitle className="text-[10px] uppercase font-bold text-muted-foreground/60 tracking-widest">Pending Count</CardTitle></CardHeader><CardContent className="p-4 pt-0"><div className="text-2xl font-black tabular-nums text-amber-600">{assignedMembers.filter(m => calculateStatus(m).paidToday === false).length}</div></CardContent></Card>
        <Card className="shadow-sm border-l-4 border-l-emerald-500 bg-card rounded-2xl"><CardHeader className="p-4 pb-2"><CardTitle className="text-[10px] uppercase font-bold text-muted-foreground/60 tracking-widest">Board Revenue</CardTitle></CardHeader><CardContent className="p-4 pt-0"><div className="text-2xl font-black tabular-nums text-emerald-600">₹{assignedMembers.reduce((acc, m) => acc + (m.totalPaid || 0), 0).toLocaleString()}</div></CardContent></Card>
      </div>

      <div className="rounded-2xl border bg-card shadow-sm overflow-hidden border-border/60">
        <div className="p-5 border-b bg-muted/30 flex justify-between items-center">
          <h3 className="text-sm font-bold flex items-center gap-2 tracking-tight text-foreground/80 uppercase">
            <Users className="size-4 text-primary" /> Current Active Board
          </h3>
          <div className="relative w-full max-w-[240px]">
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
             <Input placeholder="Search board..." className="h-8 pl-9 text-xs border-none bg-background/80" />
          </div>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/10">
              <TableRow className="hover:bg-transparent border-b">
                <TableHead className="text-[10px] uppercase font-black tracking-[0.2em] h-12 pl-6 text-muted-foreground/70">Member Participant</TableHead>
                <TableHead className="text-[10px] uppercase font-black tracking-[0.2em] h-12 text-muted-foreground/70">📅 Pending Days</TableHead>
                <TableHead className="text-[10px] uppercase font-black tracking-[0.2em] h-12 text-muted-foreground/70">Status Indicator</TableHead>
                <TableHead className="w-[120px] pr-6"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assignedMembers.length > 0 ? assignedMembers.map((m) => {
                const { paidToday } = calculateStatus(m);
                const isDaily = (m.paymentType || currentRound?.collectionType || "").toLowerCase() === 'daily';
                const pDays = m.pendingDays || 0;
                
                return (
                  <TableRow key={m.id} className="hover:bg-muted/5 transition-colors group">
                    <TableCell className="pl-6 py-4">
                      <div className="flex items-center gap-4 cursor-pointer" onClick={() => { setSelectedProfileMember(m); setIsMemberProfileDialogOpen(true); }}>
                        <div className="h-10 w-10 rounded-xl bg-secondary text-primary flex items-center justify-center font-black text-xs group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-300 shadow-sm uppercase">
                          {m.name.split(' ').map((n: string) => n[0]).join('')}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-sm font-bold truncate group-hover:text-primary transition-colors tracking-tight">{m.name}</span>
                          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest tabular-nums">
                            {m.paymentType || currentRound?.collectionType}
                          </span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <button 
                        onClick={() => { setSelectedPendingMember(m); setIsPendingDetailsOpen(true); }}
                        className={cn(
                          "px-4 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest tabular-nums transition-all active:scale-95 shadow-sm border",
                          pDays > 0 ? "bg-destructive/5 text-destructive border-destructive/20 hover:bg-destructive/10" : "bg-muted/50 text-muted-foreground/60 border-transparent"
                        )}
                      >
                        ⏳ {pDays} {pDays === 1 ? 'Day' : 'Days'}
                      </button>
                    </TableCell>
                    <TableCell>
                      <Badge variant={paidToday ? 'default' : 'secondary'} className={cn(
                        "text-[9px] font-black uppercase tracking-widest px-3 py-1 border-none shadow-sm",
                        paidToday ? "bg-emerald-500 hover:bg-emerald-600" : (isDaily ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700")
                      )}>
                        {paidToday ? 'success' : (isDaily ? 'pending' : 'Due Cycle')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right pr-6">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-9 w-9 text-emerald-600 hover:bg-emerald-50 rounded-xl active:scale-90" 
                          onClick={() => { setSelectedMemberForPayment(m); setIsQuickPaymentDialogOpen(true); }}
                        >
                          <IndianRupee className="size-4.5" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-9 w-9 text-muted-foreground hover:bg-muted/50 rounded-xl active:scale-90" 
                          onClick={() => { setHistoryMember(m); setIsHistoryDialogOpen(true); }}
                        >
                          <History className="size-4.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              }) : <TableRow><TableCell colSpan={4} className="h-48 text-center text-[11px] uppercase tracking-[0.2em] text-muted-foreground/60 font-bold italic">No participant records located on this board.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={isPendingDetailsOpen} onOpenChange={setIsPendingDetailsOpen}>
        <DialogContent className="sm:max-w-[400px]">
          {selectedPendingMember && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">💬 Pending Arrears</DialogTitle>
                <DialogDescription className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Financial deficit summary</DialogDescription>
              </DialogHeader>
              <div className="space-y-5 py-4">
                <div className="p-5 bg-muted/40 rounded-2xl space-y-4 border border-border/50 shadow-inner">
                   <div className="flex justify-between items-center text-xs">
                      <span className="text-muted-foreground font-bold uppercase tracking-widest">Member</span>
                      <span className="font-bold text-foreground">{selectedPendingMember.name}</span>
                   </div>
                   <div className="flex justify-between items-center text-xs">
                      <span className="text-muted-foreground font-bold uppercase tracking-widest">Missed Count</span>
                      <span className="font-black tabular-nums">{selectedPendingMember.pendingDays} Installments</span>
                   </div>
                   <div className="pt-4 border-t border-border/50 flex flex-col items-center justify-center">
                      <span className="text-[9px] font-black uppercase text-destructive tracking-[0.3em] mb-2">Total Arrears Amount</span>
                      <span className="text-3xl font-black text-destructive tabular-nums tracking-tighter">₹{(selectedPendingMember.pendingAmount || 0).toLocaleString()}</span>
                   </div>
                </div>
                <div className="p-4 bg-primary/5 rounded-xl border border-primary/10 flex gap-3">
                   <div className="size-4 text-primary shrink-0 mt-0.5">
                      <Info className="size-4" />
                   </div>
                   <p className="text-[10px] text-muted-foreground leading-relaxed italic font-medium">Arrears aging occurs automatically at 10 PM. All incoming payments settle earliest debt first.</p>
                </div>
              </div>
              <DialogFooter><Button onClick={() => setIsPendingDetailsOpen(false)} className="w-full h-11 font-black uppercase tracking-widest active:scale-95 transition-all">Close Summary</Button></DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isQuickPaymentDialogOpen} onOpenChange={setIsQuickPaymentDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          {selectedMemberForPayment && (
            <form onSubmit={handleQuickPayment}>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">Process Fixed Payment</DialogTitle>
                <DialogDescription className="font-medium italic">Installment collection for {selectedMemberForPayment.name}.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-6 py-8">
                <div className="flex flex-col items-center justify-center p-8 bg-muted/40 rounded-2xl border border-dashed border-border/60 text-center">
                   <span className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.3em] mb-2">Scheme Installment</span>
                   <div className="text-4xl font-black text-primary tabular-nums tracking-tighter">₹{(currentRound?.monthlyAmount || 800).toLocaleString()}</div>
                </div>
                <div className="grid gap-2">
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Payment Method</Label>
                  <Select value={paymentData.method} onValueChange={(v) => setPaymentData({...paymentData, method: v})}>
                    <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Cash">Cash (Primary)</SelectItem>
                      <SelectItem value="UPI">UPI Transfer</SelectItem>
                      <SelectItem value="Transfer">Bank Transfer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={isActionPending} className="w-full h-12 font-black uppercase tracking-[0.2em] bg-emerald-600 hover:bg-emerald-700 shadow-lg active:scale-95 transition-all">
                  {isActionPending ? <Loader2 className="mr-2 animate-spin" /> : <CheckCircle2 className="mr-2 size-5" />}
                  Confirm Installment
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isAddMemberDialogOpen} onOpenChange={setIsAddMemberDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <form onSubmit={handleAddMemberToScheme}>
            <DialogHeader>
              <DialogTitle className="text-xl font-bold">Register Participant</DialogTitle>
              <DialogDescription className="font-medium">Enroll new member into {currentRound?.name} Board.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-5 py-6">
              <div className="grid gap-2">
                <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Participant Name</Label>
                <Input value={newMember.name} onChange={e => setNewMember({...newMember, name: e.target.value})} required className="h-11 rounded-xl" />
              </div>
              <div className="grid gap-2">
                <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Phone Number</Label>
                <Input value={newMember.phone} onChange={e => setNewMember({...newMember, phone: e.target.value})} required className="h-11 rounded-xl" />
              </div>
              <div className="grid gap-2">
                <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Enrollment Date</Label>
                <Input type="date" value={newMember.joinDate} onChange={e => setNewMember({...newMember, joinDate: e.target.value})} required className="h-11 rounded-xl" />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={isActionPending} className="w-full h-11 font-black uppercase tracking-widest active:scale-95 transition-all shadow-lg">
                {isActionPending ? <Loader2 className="mr-2 animate-spin" /> : null}
                Register Member
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
