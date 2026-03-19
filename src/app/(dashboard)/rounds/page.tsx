
"use client"

import { useState, useEffect, useMemo } from "react"
import { History, Plus, Users, MoreVertical, ChevronLeft, Loader2, Pencil, Trash2, IndianRupee, CalendarDays, UserPlus, CheckCircle2, User, Info, Save, X, Clock, AlertCircle, PlusCircle, Calendar as CalendarIcon, RefreshCw, Printer } from "lucide-react"
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
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog"
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { useToast } from "@/hooks/use-toast"
import { useFirestore, useCollection, useMemoFirebase, useUser } from "@/firebase"
import { collection, query, doc, serverTimestamp, orderBy, updateDoc, deleteDoc, writeBatch, limit, where, getDocs } from "firebase/firestore"
import { addDocumentNonBlocking } from "@/firebase/non-blocking-updates"
import { useRole } from "@/hooks/use-role"
import { format, parseISO, isSameMonth, startOfDay, eachDayOfInterval, differenceInDays, isValid, subDays, isBefore } from "date-fns"
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
  method: "Cash",
  amount: 0
}

export default function RoundsPage() {
  const [selectedChitId, setSelectedChitId] = useState<string | null>(null)
  const [isAddChitDialogOpen, setIsAddChitDialogOpen] = useState(false)
  const [isEditChitDialogOpen, setIsEditChitDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false)
  const [isAddMemberDialogOpen, setIsAddMemberDialogOpen] = useState(false)
  const [isQuickPaymentDialogOpen, setIsQuickPaymentDialogOpen] = useState(false)
  const [isMemberProfileDialogOpen, setIsMemberProfileDialogOpen] = useState(false)
  const [isEditingProfile, setIsEditingProfile] = useState(false)
  const [isActionPending, setIsActionPending] = useState(false)
  const [paymentSuccessful, setPaymentSuccessful] = useState(false)
  
  const [editingChit, setEditingChit] = useState<any>(null)
  const [chitToDelete, setChitToDelete] = useState<any>(null)
  const [historyMember, setHistoryMember] = useState<any>(null)
  const [selectedMemberForPayment, setSelectedMemberForPayment] = useState<any>(null)
  const [selectedProfileMember, setSelectedProfileMember] = useState<any>(null)
  const [editFormData, setEditFormData] = useState<any>(null)
  const [newMember, setNewMember] = useState(INITIAL_MEMBER_STATE)
  const [paymentData, setPaymentData] = useState(INITIAL_PAYMENT_STATE)
  
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

  const [newChit, setNewChit] = useState(INITIAL_CHIT_STATE)

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

  const analyzePaymentStatus = (member: any) => {
    if (!member || !allPayments) return { amount: 0, paid: false, totalCredits: 0 };
    
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const memberPayments = (allPayments || []).filter(p => p.memberId === member.id);
    
    const paidToday = memberPayments.some(p => 
      (p.status === 'success' || p.status === 'paid') &&
      (p.targetDate === todayStr || (p.paymentDate && format(parseISO(p.paymentDate), 'yyyy-MM-dd') === todayStr))
    );

    const successPayments = memberPayments.filter(p => p.status === 'success' || p.status === 'paid');
    const totalCredits = successPayments.reduce((acc, p) => acc + (p.amountPaid || 0), 0);
    
    return { 
      amount: 0, 
      paid: paidToday,
      totalCredits 
    };
  };

  useEffect(() => {
    if (isAddMemberDialogOpen && currentRound) {
      setNewMember(prev => ({ ...prev, paymentType: currentRound.collectionType }));
    }
  }, [isAddMemberDialogOpen, currentRound]);

  const handleAddChit = async (e: React.FormEvent) => {
    e.preventDefault(); 
    if (!db || isActionPending) return;
    
    if (!newChit.collectionType) {
      toast({ variant: "destructive", title: "Selection Required", description: "Please select a collection type." });
      return;
    }

    setIsActionPending(true);
    try {
      await withTimeout(addDocumentNonBlocking(collection(db, 'chitRounds'), {
        ...newChit,
        monthlyAmount: Number(newChit.monthlyAmount),
        totalMembers: Number(newChit.totalMembers),
        createdAt: serverTimestamp()
      }));
      await createAuditLog(db, user, `Created new scheme: ${newChit.name}`)
      setIsAddChitDialogOpen(false); 
      setNewChit(INITIAL_CHIT_STATE);
      toast({ title: "Scheme Created", description: "The scheme has been added to the registry." });
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
      await withTimeout(addDocumentNonBlocking(collection(db, 'members'), {
        ...newMember,
        chitGroup: currentRound.name,
        monthlyAmount: currentRound.monthlyAmount,
        status: "active",
        totalPaid: 0,
        pendingDays: 0,
        yesterdayPending: 0,
        lastPendingUpdateDate: format(new Date(), 'yyyy-MM-dd'),
        createdAt: serverTimestamp(),
      }));
      
      await createAuditLog(db, user, `Registered ${newMember.name} to scheme ${currentRound.name}`);
      
      setIsAddMemberDialogOpen(false);
      setNewMember(INITIAL_MEMBER_STATE);
      toast({ title: "Member Registered", description: `${newMember.name} joined ${currentRound.name}.` });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message || "Failed to register member." });
    } finally {
      setIsActionPending(false);
    }
  }

  const handleQuickPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !selectedMemberForPayment || !currentRound || isActionPending) return;

    const { paid: alreadyPaid } = analyzePaymentStatus(selectedMemberForPayment);
    
    if (alreadyPaid) {
      toast({ variant: "destructive", title: "Action Blocked", description: "Payment for today is already recorded." });
      return;
    }

    const amountToSave = Number(paymentData.amount);
    setIsActionPending(true);
    const currentMonth = format(new Date(), 'MMMM yyyy');
    const todayStr = format(new Date(), 'yyyy-MM-dd');

    try {
      const batch = writeBatch(db);
      
      const paymentRef = doc(collection(db, 'payments'));
      batch.set(paymentRef, {
        id: paymentRef.id,
        memberId: selectedMemberForPayment.id,
        memberName: selectedMemberForPayment.name,
        month: currentMonth,
        targetDate: todayStr,
        amountPaid: amountToSave,
        paymentDate: new Date().toISOString(),
        status: "success",
        method: paymentData.method,
        createdAt: serverTimestamp()
      });

      const memberRef = doc(db, 'members', selectedMemberForPayment.id);
      
      batch.update(memberRef, {
        totalPaid: (selectedMemberForPayment.totalPaid || 0) + amountToSave,
        pendingDays: 0,
        yesterdayPending: 0,
        lastPendingUpdateDate: todayStr
      });

      await withTimeout(batch.commit());
      await createAuditLog(db, user, `Recorded Payment ₹${amountToSave} for ${selectedMemberForPayment.name}`);

      setPaymentSuccessful(true);
      setPaymentData(INITIAL_PAYMENT_STATE);
      toast({ title: "Payment Recorded", description: "Ledger updated successfully." });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message || "Failed to record payment." });
    } finally {
      setIsActionPending(false);
    }
  }

  const confirmDelete = async () => {
    if (!db || !chitToDelete || isActionPending) return;
    
    setIsActionPending(true);
    try { 
      await withTimeout(deleteDoc(doc(db, 'chitRounds', chitToDelete.id))); 
      await createAuditLog(db, user, `Deleted scheme: ${chitToDelete.name}`)
      toast({ title: "Scheme Deleted", description: "The scheme record has been removed." }); 
      setIsDeleteDialogOpen(false); 
      setChitToDelete(null)
    } catch (e: any) { 
      toast({ variant: "destructive", title: "Error", description: e.message || "Failed to delete scheme." }); 
    } finally { 
      setIsActionPending(false); 
    }
  }

  const getMonthlyCollectionForScheme = useMemo(() => (schemeName: string) => {
    if (!allPayments || !members) return 0;
    const now = new Date();
    const schemeMembers = members.filter(m => m.chitGroup === schemeName);
    const memberIds = new Set(schemeMembers.map(m => m.id));
    
    return allPayments
      .filter(p => 
        memberIds.has(p.memberId) && 
        (p.status === 'paid' || p.status === 'success') &&
        p.paymentDate && 
        isSameMonth(parseISO(p.paymentDate), now)
      )
      .reduce((acc, p) => acc + (p.amountPaid || 0), 0);
  }, [allPayments, members]);

  const todayCollection = useMemo(() => {
    if (!allPayments || !assignedMembers.length) return 0;
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const assignedMemberIds = new Set(assignedMembers.map(m => m.id));

    return allPayments
      .filter(p => 
        assignedMemberIds.has(p.memberId) && 
        (p.status === 'paid' || p.status === 'success') &&
        (p.targetDate === todayStr || (p.paymentDate && format(parseISO(p.paymentDate), 'yyyy-MM-dd') === todayStr))
      )
      .reduce((acc, p) => acc + (p.amountPaid || 0), 0);
  }, [allPayments, assignedMembers])

  const handlePrintHistory = () => {
    if (!historyMember || !allPayments) return;
    window.print();
  };

  const historyPrintData = useMemo(() => {
    if (!historyMember || !allPayments) return null;
    const successful = allPayments.filter(p => p.memberId === historyMember.id && (p.status === 'paid' || p.status === 'success'));
    const { totalCredits } = analyzePaymentStatus(historyMember);
    const pendingAmount = (historyMember.pendingDays || 0) * (currentRound?.monthlyAmount || 0);

    return {
      name: historyMember.name,
      group: historyMember.chitGroup,
      history: successful.map(p => ({
        date: format(parseISO(p.targetDate || p.paymentDate), 'dd MMM yy'),
        month: format(parseISO(p.targetDate || p.paymentDate), 'MMM yy'),
        status: 'paid',
        amt: p.amountPaid || 0
      })),
      totalPaid: totalCredits,
      pending: pendingAmount,
      timestamp: format(new Date(), 'dd/MM/yyyy HH:mm')
    };
  }, [historyMember, allPayments, currentRound]);

  if (isRoleLoading || isRoundsLoading) return (<div className="flex h-[60vh] items-center justify-center"><Loader2 className="size-8 animate-spin text-primary" /></div>)

  if (!selectedChitId) {
    return (
      <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-500 pb-10 overflow-x-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-2xl sm:text-3xl font-headline font-bold tracking-tight text-primary">Seat Reservations</h2>
            <p className="text-sm text-muted-foreground">Manage active fund schemes and seat availability.</p>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {chitSchemes.map((group) => {
            const monthlyColl = getMonthlyCollectionForScheme(group.name);
            const pendingCount = (members || []).filter(m => {
              if (m.status === 'inactive' || m.chitGroup !== group.name) return false;
              const isDaily = (m.paymentType || group.collectionType || "").toLowerCase() === 'daily';
              if (!isDaily) return false; 
              const { paid } = analyzePaymentStatus(m);
              return !paid;
            }).length;

            return (
              <Card key={group.id} className="hover:shadow-md transition-all border-border/50 overflow-hidden flex flex-col">
                <CardHeader className="bg-muted/20 p-4 space-y-2">
                  <div className="flex justify-between items-start">
                    <Badge variant="outline" className="text-[10px] font-bold uppercase">{group.collectionType}</Badge>
                  </div>
                  <CardTitle className="text-lg truncate font-bold">{group.name}</CardTitle>
                  <CardDescription className="text-xs">Capacity: {group.totalMembers} Seats</CardDescription>
                </CardHeader>
                <CardContent className="p-4 flex-1 space-y-3">
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-primary/70">Scheme Amount:</span>
                    <span className="text-primary font-bold">₹{(group.monthlyAmount || 800).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-primary/70">Occupancy:</span>
                    <span className="text-foreground">{(members || []).filter(m => m.status !== 'inactive' && m.chitGroup === group.name).length} / {group.totalMembers}</span>
                  </div>
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-amber-600">Pending (Daily):</span>
                    <span className="text-amber-700 font-extrabold">{pendingCount}</span>
                  </div>
                  <div className="pt-2 border-t flex justify-between items-center">
                    <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Monthly Collection</span>
                    <span className="text-sm font-bold text-emerald-600">₹{monthlyColl.toLocaleString()}</span>
                  </div>
                </CardContent>
                <CardFooter className="p-0 border-t">
                  <Button variant="ghost" className="w-full h-10 rounded-none text-xs font-bold" onClick={() => setSelectedChitId(group.id)}>View Board</Button>
                </CardFooter>
              </Card>
            )
          })}
        </div>
      </div>
    )
  }

  const pendingMembersInCurrentGroup = assignedMembers.filter(m => {
    const isDaily = (m.paymentType || currentRound?.collectionType || "").toLowerCase() === 'daily';
    if (!isDaily) return false;
    return !analyzePaymentStatus(m).paid;
  }).length;

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-500 pb-10 overflow-x-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setSelectedChitId(null)} className="rounded-full h-9 w-9" disabled={isActionPending}><ChevronLeft className="size-5" /></Button>
          <div className="min-w-0">
            <h2 className="text-xl sm:text-2xl font-bold truncate tracking-tight text-primary">{currentRound?.name}</h2>
            <p className="text-[10px] sm:text-xs text-muted-foreground uppercase font-bold tracking-tight">Reservation Board</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card className="shadow-sm border-l-4 border-l-primary/40"><CardHeader className="p-3 pb-1"><CardTitle className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Type</CardTitle></CardHeader><CardContent className="p-3 pt-0"><div className="text-lg font-bold">{currentRound?.collectionType}</div></CardContent></Card>
        <Card className="shadow-sm border-l-4 border-l-primary"><CardHeader className="p-3 pb-1"><CardTitle className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Seats Filled</CardTitle></CardHeader><CardContent className="p-3 pt-0"><div className="text-lg font-bold">{assignedMembers.length} / {currentRound?.totalMembers}</div></CardContent></Card>
        <Card className="shadow-sm border-l-4 border-l-destructive bg-white">
          <CardHeader className="p-3 pb-1 flex flex-row items-center justify-between space-y-0 text-destructive">
            <CardTitle className="text-[10px] uppercase font-bold tracking-wider">Daily Pending</CardTitle>
            <Clock className="size-3 opacity-60" />
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-lg font-bold text-destructive">{pendingMembersInCurrentGroup} Members</div>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-l-4 border-l-emerald-500 bg-white">
          <CardHeader className="p-3 pb-1 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-[10px] uppercase font-bold text-emerald-700 tracking-wider">Today Collection</CardTitle>
            <CalendarDays className="size-3 text-emerald-600 opacity-60" />
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-lg font-bold text-emerald-600">₹{todayCollection.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-l-4 border-l-amber-500"><CardHeader className="p-3 pb-1"><CardTitle className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Scheme Amount</CardTitle></CardHeader><CardContent className="p-3 pt-0"><div className="text-lg font-bold text-amber-600">₹{(currentRound?.monthlyAmount || 800).toLocaleString()}</div></CardContent></Card>
      </div>

      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <div className="p-4 border-b bg-muted/20 flex justify-between items-center"><h3 className="text-sm font-bold flex items-center gap-2 tracking-tight"><Users className="size-4 text-primary" /> Active Board</h3><Badge variant="secondary" className="text-[10px] tabular-nums font-bold uppercase tracking-tight">{assignedMembers.length} Joined</Badge></div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="text-[10px] uppercase font-bold tracking-wider pl-6">Member</TableHead>
                <TableHead className="text-[10px] uppercase font-bold tracking-wider">Pending Days</TableHead>
                <TableHead className="text-[10px] uppercase font-bold tracking-wider">Status</TableHead>
                <TableHead className="w-[120px] pr-6"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assignedMembers.length > 0 ? assignedMembers.map((m) => {
                const { paid } = analyzePaymentStatus(m);
                const isDaily = (m.paymentType || currentRound?.collectionType || "").toLowerCase() === 'daily';
                
                return (
                  <TableRow key={m.id} className="hover:bg-muted/5 transition-colors">
                    <TableCell className="pl-6">
                      <div 
                        className="flex items-center gap-2 cursor-pointer group" 
                        onClick={() => { 
                          if(!isActionPending) { 
                            setSelectedProfileMember(m); 
                            setIsEditingProfile(false);
                            setIsMemberProfileDialogOpen(true); 
                          } 
                        }}
                      >
                        <div className="h-7 w-7 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-[10px] group-hover:bg-primary group-hover:text-white transition-colors">
                          {m.name.split(' ').map((n: string) => n[0]).join('')}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-xs font-semibold truncate max-w-[120px] group-hover:text-primary transition-colors">{m.name}</span>
                          <span className="text-[10px] font-bold text-primary uppercase tracking-tight mt-0.5">
                            {m.paymentType || currentRound?.collectionType || 'N/A'}
                          </span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={cn(
                        "text-xs font-bold tabular-nums",
                        (m.pendingDays || 0) > 0 ? "text-destructive" : "text-muted-foreground"
                      )}>
                        {(m.pendingDays || 0) > 0 ? m.pendingDays : "-"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant={paid ? 'default' : 'secondary'} 
                        className={cn(
                          "text-[8px] sm:text-[9px] font-bold uppercase px-1.5 w-fit", 
                          paid ? "bg-emerald-500" : (isDaily ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700")
                        )}
                      >
                        {paid ? 'paid' : (isDaily ? 'pending' : 'Due (Month End)')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right pr-6">
                      <div className="flex items-center justify-end gap-1">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50" 
                          onClick={() => { setSelectedMemberForPayment(m); setPaymentData({ ...paymentData, amount: currentRound?.monthlyAmount || 0 }); setIsQuickPaymentDialogOpen(true); setPaymentSuccessful(false); }} 
                          title="Record Payment"
                        >
                          <IndianRupee className="size-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-muted-foreground hover:text-primary" 
                          onClick={() => { if(!isActionPending) { setHistoryMember(m); setIsHistoryDialogOpen(true); } }} 
                          disabled={isActionPending}
                          title="View History"
                        >
                          <History className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              }) : <TableRow><TableCell colSpan={4} className="h-32 text-center text-xs text-muted-foreground italic">No participants registered in this scheme.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={isMemberProfileDialogOpen} onOpenChange={(open) => { 
        if(!isActionPending) {
          setIsMemberProfileDialogOpen(open); 
          if(!open) {
            setSelectedProfileMember(null);
            setIsEditingProfile(false);
            setEditFormData(null);
          }
        }
      }}>
        <DialogContent className="sm:max-w-[450px] p-0 overflow-hidden border-none shadow-2xl">
          <DialogHeader className="p-6 bg-gradient-to-br from-primary/10 to-transparent border-b">
            <DialogTitle className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm shadow-md ring-2 ring-white/20">
                {selectedProfileMember?.name?.split(' ').map((n: string) => n[0]).join('')}
              </div>
              <div className="flex flex-col">
                <span className="font-headline tracking-tight text-xl">
                   Member Profile
                </span>
                <span className="text-[10px] uppercase font-bold tracking-widest text-primary/70">Registry #M-{selectedProfileMember?.id?.slice(0, 4)}</span>
              </div>
            </DialogTitle>
          </DialogHeader>

          {selectedProfileMember && (
            <div className="px-6 py-2">
              <div className="flex justify-between items-center py-4 border-b">
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Full Name</span>
                <span className="font-bold text-sm text-foreground">{selectedProfileMember.name}</span>
              </div>
              <div className="flex justify-between items-center py-4 border-b">
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Phone Number</span>
                <span className="font-bold text-sm text-foreground tabular-nums">{selectedProfileMember.phone}</span>
              </div>
              <div className="flex justify-between items-center py-4 border-b">
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Assigned Group</span>
                <span className="font-bold text-sm text-primary">{currentRound?.name}</span>
              </div>
              <div className="flex justify-between items-center py-4 border-b">
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Payment Mode</span>
                <Badge variant="secondary" className="font-bold text-[10px] uppercase bg-primary/5 text-primary border-primary/20">
                  {selectedProfileMember.paymentType || currentRound?.collectionType}
                </Badge>
              </div>
              <div className="flex justify-between items-center py-4 border-b">
                <span className="text-[10px] font-bold uppercase tracking-widest text-destructive">Pending Days</span>
                <span className="font-bold text-sm text-destructive">{selectedProfileMember.pendingDays || 0}</span>
              </div>
              <div className="flex justify-between items-center py-4 border-b">
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Registration Date</span>
                <span className="font-bold text-sm text-foreground">
                  {selectedProfileMember.joinDate ? format(parseISO(selectedProfileMember.joinDate), 'MMM dd, yyyy') : '-'}
                </span>
              </div>
              <div className="mt-6 flex justify-between items-center p-3 bg-emerald-50 rounded-lg border border-emerald-100">
                <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-600">Total Contribution</span>
                <span className="font-bold text-sm text-emerald-700 tabular-nums">₹{(analyzePaymentStatus(selectedProfileMember).totalCredits).toLocaleString()}</span>
              </div>
            </div>
          )}

          <DialogFooter className="p-6 bg-muted/30 flex flex-col sm:flex-row gap-3">
             <Button 
                className="w-full font-bold h-10 px-8 uppercase text-[10px] tracking-widest shadow-sm" 
                onClick={() => setIsMemberProfileDialogOpen(false)}
                disabled={isActionPending}
              >
                Close Profile
              </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isQuickPaymentDialogOpen} onOpenChange={(open) => { if (!isActionPending) { setIsQuickPaymentDialogOpen(open); if (!open) { setSelectedMemberForPayment(null); setPaymentData(INITIAL_PAYMENT_STATE); setPaymentSuccessful(false); } } }}>
        <DialogContent className="sm:max-w-[450px]">
          {selectedMemberForPayment && (
            <div className="space-y-6">
              <DialogHeader>
                <DialogTitle className="flex items-center justify-between">
                  <span>Member Payment</span>
                </DialogTitle>
                <DialogDescription>Process transaction for {selectedMemberForPayment.name}.</DialogDescription>
              </DialogHeader>

              <form onSubmit={handleQuickPayment} className="space-y-4">
                {analyzePaymentStatus(selectedMemberForPayment).paid && (
                  <Alert variant="default" className="bg-emerald-50 border-emerald-200 animate-in fade-in slide-in-from-top-2 duration-300">
                    <CheckCircle2 className="size-4 text-emerald-600" />
                    <AlertTitle className="text-emerald-800 font-bold">Payment Already Completed</AlertTitle>
                    <AlertDescription className="text-emerald-700 text-xs">
                      A successful transaction for today is already recorded in the system.
                    </AlertDescription>
                  </Alert>
                )}

                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <Label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">Member Name</Label>
                    <Input value={selectedMemberForPayment.name} readOnly className="bg-muted font-bold" />
                  </div>
                  <div className="grid gap-2">
                    <Label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">Payment Amount (₹)</Label>
                    <Input 
                      type="number"
                      value={paymentData.amount || ""} 
                      onChange={e => setPaymentData({ ...paymentData, amount: Number(e.target.value) })}
                      className="font-bold text-emerald-600 h-12 text-xl [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" 
                      placeholder="Enter amount"
                      disabled={isActionPending || paymentSuccessful || analyzePaymentStatus(selectedMemberForPayment).paid}
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">Payment Method</Label>
                    <Select 
                      value={paymentData.method} 
                      onValueChange={(v) => setPaymentData({ ...paymentData, method: v })}
                      disabled={isActionPending || paymentSuccessful || analyzePaymentStatus(selectedMemberForPayment).paid}
                    >
                      <SelectTrigger className="h-10"><SelectValue placeholder="Select method" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Cash">Cash</SelectItem>
                        <SelectItem value="UPI">UPI</SelectItem>
                        <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex gap-3 pt-4 border-t">
                  <Button variant="outline" type="button" onClick={() => setIsQuickPaymentDialogOpen(false)} disabled={isActionPending} className="flex-1 font-bold h-11">Cancel</Button>
                  <Button 
                    type="submit" 
                    disabled={isActionPending} 
                    className={cn(
                      "flex-1 font-bold gap-2 h-11", 
                      (paymentSuccessful || analyzePaymentStatus(selectedMemberForPayment).paid) 
                        ? "bg-muted text-muted-foreground grayscale cursor-not-allowed opacity-60" 
                        : "bg-emerald-600 hover:bg-emerald-700"
                    )}
                  >
                    {isActionPending ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                    {(paymentSuccessful || analyzePaymentStatus(selectedMemberForPayment).paid) ? "Paid Recorded" : "Record Paid"}
                  </Button>
                </div>
              </form>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isHistoryDialogOpen} onOpenChange={(open) => { if (!isActionPending) { setIsHistoryDialogOpen(open); if (!open) setHistoryMember(null) } }}>
        <DialogContent className="sm:max-w-[600px]">
          {isHistoryDialogOpen && (
            <>
              <DialogHeader>
                <div className="flex items-center justify-between w-full pr-8">
                  <DialogTitle className="text-xl font-headline font-bold tracking-tight text-primary flex items-center gap-2">
                    <History className="size-5 text-primary/40" /> 
                    Financial Record: {historyMember?.name}
                  </DialogTitle>
                  <Button variant="outline" size="sm" onClick={handlePrintHistory} className="h-8 gap-2 font-bold print:hidden">
                    <Printer className="size-4" /> Print History
                  </Button>
                </div>
              </DialogHeader>
              <div className="py-4 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead className="text-[10px] uppercase font-bold text-muted-foreground pl-4">Date</TableHead>
                      <TableHead className="text-[10px] uppercase font-bold text-muted-foreground">Amount</TableHead>
                      <TableHead className="text-right text-[10px] uppercase font-bold text-muted-foreground pr-4">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historyMember && (allPayments || []).filter(p => p.memberId === historyMember.id && (p.status === 'paid' || p.status === 'success')).map((p, i) => (
                      <TableRow key={i} className="hover:bg-muted/5 transition-colors">
                        <TableCell className="text-xs font-semibold pl-4">
                          {format(parseISO(p.targetDate || p.paymentDate), 'dd MMM yyyy')}
                        </TableCell>
                        <TableCell className={cn("text-xs font-bold", 'text-emerald-600')}>₹{p.amountPaid?.toLocaleString()}</TableCell>
                        <TableCell className="text-right pr-4">
                          <Badge variant={'default'} className={cn("text-[8px] font-bold uppercase px-1.5", 'bg-emerald-500')}>
                            paid
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <DialogFooter><Button className="w-full sm:w-auto font-bold print:hidden" onClick={() => setIsHistoryDialogOpen(false)}>Close History</Button></DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <div id="thermal-receipt" className="hidden">
        {historyPrintData && (
          <div className="font-mono text-[10px] leading-tight w-full">
            <div className="text-center font-bold mb-2 uppercase">CHIT FUND</div>
            <div className="border-b border-dashed border-black mb-2"></div>
            <div className="mb-1">Member Name: {historyPrintData.name}</div>
            <div className="mb-2">Group: {historyPrintData.group}</div>
            <div className="border-b border-dashed border-black mb-2"></div>
            <div className="flex justify-between font-bold mb-1">
              <span className="w-[10ch]">Date</span>
              <span className="w-[8ch]">Month</span>
              <span className="w-[6ch]">Stat</span>
              <span className="w-[6ch] text-right">Amt</span>
            </div>
            {historyPrintData.history.map((row, idx) => (
              <div key={idx} className="flex justify-between mb-0.5">
                <span className="w-[10ch]">{row.date}</span>
                <span className="w-[8ch]">{row.month}</span>
                <span className="w-[6ch]">{row.status}</span>
                <span className="w-[6ch] text-right">{row.amt}</span>
              </div>
            ))}
            <div className="border-b border-dashed border-black my-2"></div>
            <div className="flex justify-between font-bold">
              <span>Total Paid:</span>
              <span>₹{historyPrintData.totalPaid.toLocaleString()}</span>
            </div>
            <div className="flex justify-between font-bold">
              <span>Pending:</span>
              <span>₹{historyPrintData.pending.toLocaleString()}</span>
            </div>
            <div className="border-b border-dashed border-black my-2"></div>
            <div className="text-center font-bold mt-2">Thank You</div>
            <div className="text-center text-[8px] mt-1 opacity-60">{historyPrintData.timestamp}</div>
          </div>
        )}
      </div>
    </div>
  )
}
