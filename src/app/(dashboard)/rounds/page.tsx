
"use client"

import { useState, useEffect, useMemo } from "react"
import { History, Plus, Users, ChevronLeft, Loader2, IndianRupee, UserPlus, Info, Clock, AlertCircle, CheckCircle2, LayoutDashboard, Search, RefreshCcw, TrendingUp, MoreVertical, Pencil, Trash2, User, Calendar, Wallet, CalendarDays, Edit3, Printer, X } from "lucide-react"
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useToast } from "@/hooks/use-toast"
import { useFirestore, useCollection, useMemoFirebase, useUser } from "@/firebase"
import { collection, query, doc, serverTimestamp, orderBy, writeBatch, updateDoc, deleteDoc, addDoc } from "firebase/firestore"
import { useRole } from "@/hooks/use-role"
import { format, parseISO, isSameMonth, eachDayOfInterval, isBefore, isAfter, startOfDay, endOfDay, differenceInDays, addDays, max } from "date-fns"
import { cn, withTimeout } from "@/lib/utils"
import { createAuditLog } from "@/firebase/logging"

// STRICT SYSTEM START DATE
const CALCULATION_START_DATE = parseISO('2026-04-01');

const INITIAL_CHIT_STATE = { 
  name: "", 
  monthlyAmount: 0, 
  totalMembers: 0, 
  startDate: format(new Date(), 'yyyy-MM-dd'), 
  endDate: format(new Date(), 'yyyy-MM-dd'),
  collectionType: "Daily" 
}

const INITIAL_MEMBER_STATE = {
  name: "",
  phone: "",
  joinDate: format(new Date(), 'yyyy-MM-dd'),
  paymentType: ""
}

const INITIAL_PAYMENT_STATE = {
  method: "Cash",
  amount: 0,
  date: format(new Date(), 'yyyy-MM-dd')
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];
const YEARS = ["2024", "2025", "2026", "2027", "2028"];

export default function RoundsPage() {
  const [selectedChitId, setSelectedChitId] = useState<string | null>(null)
  const [isAddChitDialogOpen, setIsAddChitDialogOpen] = useState(false)
  const [isEditChitDialogOpen, setIsEditChitDialogOpen] = useState(false)
  const [chitToEdit, setChitToEdit] = useState<any>(null)
  const [isDeleteChitDialogOpen, setIsDeleteChitDialogOpen] = useState(false)
  const [chitToDelete, setChitToDelete] = useState<any>(null)
  
  const [isAddMemberDialogOpen, setIsAddMemberDialogOpen] = useState(false)
  const [isQuickPaymentDialogOpen, setIsQuickPaymentDialogOpen] = useState(false)
  const [isMemberProfileDialogOpen, setIsMemberProfileDialogOpen] = useState(false)
  const [isEditMemberProfileOpen, setIsEditMemberProfileOpen] = useState(false)
  const [memberProfileToEdit, setMemberProfileToEdit] = useState<any>(null)
  const [isPendingDetailsOpen, setIsPendingDetailsOpen] = useState(false)
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false)
  const [isActionPending, setIsActionPending] = useState(false)
  
  const [isCollectionPopupOpen, setIsCollectionPopupOpen] = useState(false)
  const [activePopupGroupName, setActivePopupGroupName] = useState<string | null>(null)
  
  const [isDailyAuditOpen, setIsDailyAuditOpen] = useState(false)
  const [auditDate, setAuditDate] = useState(format(new Date(), 'yyyy-MM-dd'))

  const [historyMember, setHistoryMember] = useState<any>(null)
  const [selectedMemberForPayment, setSelectedMemberForPayment] = useState<any>(null)
  const [selectedProfileMember, setSelectedProfileMember] = useState<any>(null)
  const [selectedPendingMember, setSelectedPendingMember] = useState<any>(null)
  const [newMember, setNewMember] = useState(INITIAL_MEMBER_STATE)
  const [paymentData, setPaymentData] = useState(INITIAL_PAYMENT_STATE)
  const [newChit, setNewChit] = useState(INITIAL_CHIT_STATE)
  
  const [viewMonth, setViewMonth] = useState<string>(format(new Date(), 'MMMM'))
  const [viewYear, setViewYear] = useState<string>(format(new Date(), 'yyyy'))
  
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

  // NEW STRICT DATE-WISE DYNAMIC CALCULATIONS
  const membersWithCalculatedStats = useMemo(() => {
    if (!members || !allPayments) return [];
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const today = startOfDay(new Date());

    return members.map(m => {
      const mPayments = allPayments.filter(p => p.memberId === m.id && (p.status === 'success' || p.status === 'paid'));
      
      // Calculate pending days: ONLY from max(joinDate, CALCULATION_START_DATE) to today
      let pendingDaysCount = 0;
      if (m.joinDate && m.status !== 'inactive') {
        try {
          const rawJoinDate = parseISO(m.joinDate);
          const effectiveStart = startOfDay(max([rawJoinDate, CALCULATION_START_DATE]));
          
          if (isBefore(effectiveStart, addDays(today, 1))) {
            const interval = eachDayOfInterval({ start: effectiveStart, end: today });
            
            interval.forEach(day => {
              const dStr = format(day, 'yyyy-MM-dd');
              const dayPaymentSum = mPayments
                .filter(p => p.targetDate === dStr)
                .reduce((acc, p) => acc + (p.amountPaid || 0), 0);
              
              if (dayPaymentSum < (m.monthlyAmount || 800)) {
                pendingDaysCount++;
              }
            });
          }
        } catch (e) {
          console.error("Date calculation error for member", m.name, e);
        }
      }

      const isPaidToday = mPayments
        .filter(p => p.targetDate === todayStr)
        .reduce((acc, p) => acc + (p.amountPaid || 0), 0) >= (m.monthlyAmount || 800);

      return {
        ...m,
        calculatedPendingDays: pendingDaysCount,
        calculatedPendingAmount: pendingDaysCount * (m.monthlyAmount || 800),
        isPaidToday: isPaidToday
      };
    });
  }, [members, allPayments]);

  const currentRound = useMemo(() => chitSchemes.find(r => r.id === selectedChitId), [chitSchemes, selectedChitId])
  const assignedMembers = useMemo(() => membersWithCalculatedStats.filter(m => m.status !== 'inactive' && m.chitGroup === currentRound?.name), [membersWithCalculatedStats, currentRound])

  const totalPaidByMember = useMemo(() => {
    const map = new Map<string, number>();
    (allPayments || []).forEach(p => {
      if ((p.status === 'paid' || p.status === 'success') && (p.amountPaid || 0) > 0) {
        const current = map.get(p.memberId) || 0;
        map.set(p.memberId, current + (p.amountPaid || 0));
      }
    });
    return map;
  }, [allPayments]);

  const getDisplayName = (name: string) => {
    if (!name) return "";
    const clean = name.replace(/Group/gi, '').trim();
    return `Group ${clean}`;
  };

  const getGroupCollectionForDate = (groupName: string, dateStr: string) => {
    if (!allPayments || !members) return 0;
    const groupMemberIds = new Set(members.filter(m => m.chitGroup === groupName).map(m => m.id));
    return allPayments
      .filter(p => 
        groupMemberIds.has(p.memberId) && 
        (p.status === 'success' || p.status === 'paid') &&
        (p.amountPaid || 0) > 0 &&
        p.targetDate === dateStr
      )
      .reduce((acc, p) => acc + (p.amountPaid || 0), 0);
  };

  const getGroupTodayCollection = (groupName: string) => {
    return getGroupCollectionForDate(groupName, format(new Date(), 'yyyy-MM-dd'));
  };

  const getGroupMonthlyCollection = (groupName: string, monthStr?: string) => {
    if (!allPayments || !members) return 0;
    const targetMonth = monthStr || format(new Date(), 'MMMM yyyy');
    const groupMemberIds = new Set(members.filter(m => m.chitGroup === groupName).map(m => m.id));
    return allPayments
      .filter(p => 
        groupMemberIds.has(p.memberId) && 
        (p.status === 'success' || p.status === 'paid') &&
        (p.amountPaid || 0) > 0 &&
        p.month === targetMonth
      )
      .reduce((acc, p) => acc + (p.amountPaid || 0), 0);
  };

  const getGroupPendingCount = (groupName: string) => {
    return membersWithCalculatedStats.filter(m => m.chitGroup === groupName && m.status !== 'inactive' && !m.isPaidToday).length;
  };

  const handleQuickPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !selectedMemberForPayment || !currentRound || isActionPending) return;

    const paymentAmount = Number(paymentData.amount);
    const targetDateStr = paymentData.date; 
    
    setIsActionPending(true);

    try {
      const paymentRef = doc(collection(db, 'payments'));
      
      const paymentRecord = {
        id: paymentRef.id,
        memberId: selectedMemberForPayment.id,
        memberName: selectedMemberForPayment.name,
        month: format(parseISO(targetDateStr), 'MMMM yyyy'),
        targetDate: targetDateStr, 
        amountPaid: paymentAmount,
        paymentDate: new Date().toISOString(), 
        status: "success",
        method: paymentData.method,
        createdAt: serverTimestamp()
      };

      await addDoc(collection(db, 'payments'), paymentRecord);
      await createAuditLog(db, user, `Processed Payment ₹${paymentAmount} for ${selectedMemberForPayment.name} targeted for ${targetDateStr}`);

      setPaymentData(INITIAL_PAYMENT_STATE);
      setIsQuickPaymentDialogOpen(false);
      toast({ title: "Payment Recorded", description: "Date marked as paid." });
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
      await addDoc(collection(db, 'chitRounds'), chitData);
      
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

  const handleUpdateChit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !chitToEdit || isActionPending) return;
    setIsActionPending(true);
    try {
      const chitRef = doc(db, 'chitRounds', chitToEdit.id);
      await updateDoc(chitRef, {
        name: chitToEdit.name,
        monthlyAmount: Number(chitToEdit.monthlyAmount),
        totalMembers: Number(chitToEdit.totalMembers),
        collectionType: chitToEdit.collectionType,
        startDate: chitToEdit.startDate,
        endDate: chitToEdit.endDate
      });
      await createAuditLog(db, user, `Updated scheme: ${chitToEdit.name}`);
      setIsEditChitDialogOpen(false);
      setChitToEdit(null);
      toast({ title: "Scheme Updated", description: "Changes saved." });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message || "Failed to update scheme." });
    } finally {
      setIsActionPending(false);
    }
  }

  const handleDeleteChit = async () => {
    if (!db || !chitToDelete || isActionPending) return;
    setIsActionPending(true);
    try {
      await deleteDoc(doc(db, 'chitRounds', chitToDelete.id));
      await createAuditLog(db, user, `Deleted scheme: ${chitToDelete.name}`);
      setIsDeleteChitDialogOpen(false);
      setChitToDelete(null);
      toast({ title: "Scheme Deleted", description: "Record removed." });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message || "Failed to delete scheme." });
    } finally {
      setIsActionPending(false);
    }
  }

  const handleAddMemberToScheme = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !currentRound || isActionPending) return;
    setIsActionPending(true);
    try {
      const memberData = {
        ...newMember,
        paymentType: newMember.paymentType || currentRound.collectionType,
        chitGroup: currentRound.name,
        monthlyAmount: currentRound.monthlyAmount,
        status: "active",
        createdAt: serverTimestamp(),
      };
      await addDoc(collection(db, 'members'), memberData);

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

  const handleUpdateMemberProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !memberProfileToEdit || isActionPending) return;
    setIsActionPending(true);
    try {
      const memberRef = doc(db, 'members', memberProfileToEdit.id);
      await updateDoc(memberRef, {
        name: memberProfileToEdit.name,
        phone: memberProfileToEdit.phone,
        joinDate: memberProfileToEdit.joinDate,
        paymentType: memberProfileToEdit.paymentType
      });
      
      await createAuditLog(db, user, `Updated member profile: ${memberProfileToEdit.name}`);
      setIsEditMemberProfileOpen(false);
      setMemberProfileToEdit(null);
      setIsMemberProfileDialogOpen(false);
      toast({ title: "Profile Updated", description: "Details saved successfully." });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message || "Failed to update profile." });
    } finally {
      setIsActionPending(false);
    }
  }

  // GET LOG OF ALL DATES FOR PENDING POPUP (STRICT WINDOW)
  const memberDateLog = useMemo(() => {
    if (!selectedPendingMember || !allPayments) return [];
    try {
      const rawJoinDate = parseISO(selectedPendingMember.joinDate);
      const effectiveStart = startOfDay(max([rawJoinDate, CALCULATION_START_DATE]));
      const today = startOfDay(new Date());
      
      if (isAfter(effectiveStart, today)) return [];

      const mPayments = allPayments.filter(p => p.memberId === selectedPendingMember.id && (p.status === 'success' || p.status === 'paid'));
      
      return eachDayOfInterval({ start: effectiveStart, end: today }).map(day => {
        const dStr = format(day, 'yyyy-MM-dd');
        const dayPaymentSum = mPayments
          .filter(p => p.targetDate === dStr)
          .reduce((acc, p) => acc + (p.amountPaid || 0), 0);
        
        const isPaid = dayPaymentSum >= (selectedPendingMember.monthlyAmount || 800);

        return {
          date: dStr,
          status: isPaid ? 'Paid' : 'Not Paid',
          amount: dayPaymentSum,
          label: format(day, 'dd MMM yyyy')
        };
      }).reverse(); // Newest first
    } catch (e) {
      return [];
    }
  }, [selectedPendingMember, allPayments]);

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
            const groupPendingCount = getGroupPendingCount(group.name);
            const monthlyCollection = getGroupMonthlyCollection(group.name, format(new Date(), 'MMMM yyyy'));
            
            return (
              <Card key={group.id} className="group hover:shadow-xl transition-all border-border/60 overflow-hidden flex flex-col relative bg-card shadow-sm rounded-2xl">
                <div className="absolute top-3 right-3 flex items-center gap-1">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                        <MoreVertical className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => { setChitToEdit(group); setIsEditChitDialogOpen(true); }}>
                        <Pencil className="size-4 mr-2" /> Edit Scheme
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-destructive" onClick={() => { setChitToDelete(group); setIsDeleteChitDialogOpen(true); }}>
                        <Trash2 className="size-4 mr-2" /> Delete Scheme
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 rounded-full hover:bg-primary/10 text-primary/70 hover:text-primary transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActivePopupGroupName(group.name);
                      setIsCollectionPopupOpen(true);
                    }}
                  >
                    <Wallet className="size-4" />
                  </Button>
                </div>

                <CardHeader className="p-5 pb-3 space-y-3 border-b border-border/40">
                  <Badge variant="outline" className="w-fit text-[10px] font-black uppercase tracking-widest px-2 py-0.5 bg-primary/5 border-primary/20 text-primary">
                    {group.collectionType}
                  </Badge>
                  <CardTitle className="text-xl font-bold tracking-tight text-foreground truncate">
                    {getDisplayName(group.name)}
                  </CardTitle>
                </CardHeader>

                <CardContent className="p-5 flex-1 space-y-4">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-muted-foreground font-semibold">Scheme Amount</span>
                      <span className="font-bold text-primary">₹{(group.monthlyAmount || 0).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-amber-600 font-semibold">Pending Today</span>
                      <span className={cn("font-bold text-sm", groupPendingCount > 0 ? "text-amber-500" : "text-emerald-600")}>
                        {groupPendingCount}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-muted-foreground font-semibold">Occupancy</span>
                      <span className="font-black tabular-nums">
                        {currentOccupancy} <span className="text-muted-foreground font-medium">/ {group.totalMembers}</span>
                      </span>
                    </div>
                    
                    <div className="pt-4 border-t border-dashed border-border/60 mt-4">
                       <div className="flex justify-between items-center">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">Monthly Collection</span>
                          <span className="font-black text-emerald-600 text-base tabular-nums">₹{monthlyCollection.toLocaleString()}</span>
                       </div>
                    </div>
                  </div>
                </CardContent>

                <CardFooter className="p-1.5 bg-muted/5 border-t border-border/40">
                  <Button 
                    variant="ghost" 
                    className="w-full h-7 font-black text-[10px] uppercase tracking-[0.2em] hover:bg-primary hover:text-primary-foreground transition-all rounded-lg"
                    onClick={() => setSelectedChitId(group.id)}
                  >
                    View Board
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>

        <Dialog open={isCollectionPopupOpen} onOpenChange={(open) => {
          setIsCollectionPopupOpen(open);
          if (!open) {
            setViewMonth(format(new Date(), 'MMMM'));
            setViewYear(format(new Date(), 'yyyy'));
            setActivePopupGroupName(null);
          }
        }}>
          <DialogContent className="sm:max-w-[420px]">
            {activePopupGroupName && (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Wallet className="size-5 text-primary" />
                    Reconciliation Board
                  </DialogTitle>
                  <DialogDescription>
                    Summary for {getDisplayName(activePopupGroupName)}.
                  </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-6 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Period Month</Label>
                      <Select value={viewMonth} onValueChange={setViewMonth}>
                        <SelectTrigger className="h-10 text-xs font-bold">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {MONTHS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Period Year</Label>
                      <Select value={viewYear} onValueChange={setViewYear}>
                        <SelectTrigger className="h-10 text-xs font-bold">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {YEARS.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex flex-col items-center justify-center p-8 bg-emerald-50 rounded-3xl border border-dashed border-emerald-200 text-center">
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-600/60 mb-3">Verified Monthly Intake</p>
                    <div className="text-5xl font-black text-emerald-600 tabular-nums tracking-tighter">
                      ₹{getGroupMonthlyCollection(activePopupGroupName, `${viewMonth} ${viewYear}`).toLocaleString()}
                    </div>
                  </div>
                </div>

                <DialogFooter>
                  <Button onClick={() => setIsCollectionPopupOpen(false)} className="w-full font-bold">
                    Close Audit
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>

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
                  <Input value={newChit.name ?? ""} onChange={e => setNewChit({...newChit, name: e.target.value})} required className="h-11 rounded-xl" placeholder="e.g. Group A" />
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
                  <Select value={newChit.collectionType ?? "Daily"} onValueChange={(v) => setNewChit({...newChit, collectionType: v})}>
                    <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Select frequency" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Daily">Daily</SelectItem>
                      <SelectItem value="Monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Start Date</Label>
                    <Input type="date" value={newChit.startDate ?? ""} onChange={e => setNewChit({...newChit, startDate: e.target.value})} required className="h-11 rounded-xl" />
                  </div>
                  <div className="grid gap-2">
                    <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">End Date</Label>
                    <Input type="date" value={newChit.endDate ?? ""} onChange={e => setNewChit({...newChit, endDate: e.target.value})} required className="h-11 rounded-xl" />
                  </div>
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

        <Dialog open={isEditChitDialogOpen} onOpenChange={setIsEditChitDialogOpen}>
          <DialogContent className="sm:max-w-[425px]">
            {chitToEdit && (
              <form onSubmit={handleUpdateChit}>
                <DialogHeader>
                  <DialogTitle className="text-xl font-bold">Edit Scheme</DialogTitle>
                  <DialogDescription className="font-medium">Modify parameters for {chitToEdit.name}.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-5 py-6">
                  <div className="grid gap-2">
                    <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Scheme Name</Label>
                    <Input value={chitToEdit.name ?? ""} onChange={e => setChitToEdit({...chitToEdit, name: e.target.value})} required className="h-11 rounded-xl" />
                  </div>
                  <div className="grid gap-2">
                    <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Amount (₹)</Label>
                    <Input type="number" value={chitToEdit.monthlyAmount || ""} onChange={e => setChitToEdit({...chitToEdit, monthlyAmount: Number(e.target.value)})} required className="h-11 rounded-xl" />
                  </div>
                  <div className="grid gap-2">
                    <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Max Members</Label>
                    <Input type="number" value={chitToEdit.totalMembers || ""} onChange={e => setChitToEdit({...chitToEdit, totalMembers: Number(e.target.value)})} required className="h-11 rounded-xl" />
                  </div>
                  <div className="grid gap-2">
                    <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Collection Type</Label>
                    <Select value={chitToEdit.collectionType ?? "Daily"} onValueChange={(v) => setChitToEdit({...chitToEdit, collectionType: v})}>
                      <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Select frequency" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Daily">Daily</SelectItem>
                        <SelectItem value="Monthly">Monthly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Start Date</Label>
                      <Input type="date" value={chitToEdit.startDate ?? ""} onChange={e => setChitToEdit({...chitToEdit, startDate: e.target.value})} required className="h-11 rounded-xl" />
                    </div>
                    <div className="grid gap-2">
                      <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">End Date</Label>
                      <Input type="date" value={chitToEdit.endDate ?? ""} onChange={e => setChitToEdit({...chitToEdit, endDate: e.target.value})} required className="h-11 rounded-xl" />
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={isActionPending} className="w-full h-11 font-bold">
                    {isActionPending ? <Loader2 className="mr-2 animate-spin" /> : null}
                    Save Changes
                  </Button>
                </DialogFooter>
              </form>
            )}
          </DialogContent>
        </Dialog>

        <AlertDialog open={isDeleteChitDialogOpen} onOpenChange={setIsDeleteChitDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="text-destructive">Delete Scheme?</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete <strong>{chitToDelete?.name}</strong>? This will permanently remove the scheme and its configuration.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isActionPending}>Cancel</AlertDialogCancel>
              <AlertDialogAction className="bg-destructive hover:bg-destructive/90 font-bold" onClick={handleDeleteChit} disabled={isActionPending}>
                {isActionPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                Delete Scheme
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    )
  }

  const todayGroupCollection = getGroupTodayCollection(currentRound?.name || "");

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
          </div>
        </div>
        <div className="flex items-center gap-3">
           <Button onClick={() => setIsAddMemberDialogOpen(true)} className="font-bold gap-2 h-11 px-6 shadow-lg active:scale-95 transition-all">
             <UserPlus className="size-5" /> Add Member
           </Button>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="shadow-sm border-l-4 border-l-primary/40 bg-card rounded-xl">
          <CardHeader className="p-2.5 pb-1">
            <CardTitle className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Scheme Amount</CardTitle>
          </CardHeader>
          <CardContent className="p-2.5 pt-0">
            <div className="text-lg font-bold tabular-nums tracking-tight">₹{(currentRound?.monthlyAmount || 0).toLocaleString()}</div>
          </CardContent>
        </Card>
        
        <Card className="shadow-sm border-l-4 border-l-primary bg-card rounded-xl">
          <CardHeader className="p-2.5 pb-1">
            <CardTitle className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Occupancy</CardTitle>
          </CardHeader>
          <CardContent className="p-2.5 pt-0">
            <div className="text-lg font-bold tabular-nums tracking-tight">
              {assignedMembers.length} <span className="text-xs font-semibold text-muted-foreground">/ {currentRound?.totalMembers}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-l-4 border-l-amber-500 bg-card rounded-xl">
          <CardHeader className="p-2.5 pb-1">
            <CardTitle className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Pending Today</CardTitle>
          </CardHeader>
          <CardContent className="p-2.5 pt-0">
            <div className="text-lg font-bold tabular-nums text-amber-600 tracking-tight">
              {assignedMembers.filter(m => !m.isPaidToday).length}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-l-4 border-l-emerald-500 bg-card rounded-xl">
          <CardHeader className="p-2.5 pb-1 flex flex-row items-center justify-between">
            <CardTitle className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Today's Collection</CardTitle>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-6 w-6 rounded-full hover:bg-emerald-50 text-emerald-600/70 hover:text-emerald-600 transition-colors"
              onClick={() => setIsDailyAuditOpen(true)}
            >
              <Wallet className="size-3" />
            </Button>
          </CardHeader>
          <CardContent className="p-2.5 pt-0">
            <div className="text-lg font-bold tabular-nums text-emerald-600 tracking-tight">₹{todayGroupCollection.toLocaleString()}</div>
          </CardContent>
        </Card>
      </div>

      <div className="rounded-2xl border bg-card shadow-sm overflow-hidden border-border/60">
        <div className="p-5 border-b bg-muted/30 flex justify-between items-center">
          <h3 className="text-sm font-bold flex items-center gap-2 tracking-tight text-foreground/80 uppercase">
            <Users className="size-4 text-primary" /> Current Active Board
          </h3>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/10">
              <TableRow className="hover:bg-transparent border-b">
                <TableHead className="text-[10px] uppercase font-black tracking-[0.2em] h-12 pl-6 text-muted-foreground/70">Member Participant</TableHead>
                <TableHead className="text-[10px] uppercase font-black tracking-[0.2em] h-12 text-muted-foreground/70">Arrears Count</TableHead>
                <TableHead className="text-[10px] uppercase font-black tracking-[0.2em] h-12 text-muted-foreground/70">Status Indicator</TableHead>
                <TableHead className="w-[120px] pr-6"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assignedMembers.length > 0 ? assignedMembers.map((m) => {
                const paidToday = m.isPaidToday;
                const pDays = m.calculatedPendingDays;
                
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
                        onClick={() => { 
                          setSelectedPendingMember(m); 
                          setIsPendingDetailsOpen(true); 
                        }}
                        className={cn(
                          "px-4 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest tabular-nums transition-all active:scale-95 tabular-nums hover:underline cursor-pointer hover:bg-muted/5",
                          pDays > 0 ? "text-destructive font-bold" : "text-muted-foreground/40"
                        )}
                      >
                        {pDays} Days
                      </button>
                    </TableCell>
                    <TableCell>
                      <Badge variant={paidToday ? 'default' : 'secondary'} className={cn(
                        "text-[9px] font-black uppercase tracking-widest px-3 py-1 border-none shadow-sm",
                        paidToday ? "bg-emerald-500 hover:bg-emerald-600" : "bg-amber-100 text-amber-700"
                      )}>
                        {paidToday ? 'SUCCESS' : 'PENDING'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right pr-6">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className={cn(
                            "h-9 w-9 rounded-xl transition-all",
                            paidToday 
                              ? "text-emerald-500 bg-emerald-50 cursor-default" 
                              : "text-emerald-600 hover:bg-emerald-50 active:scale-90"
                          )}
                          disabled={paidToday || isActionPending}
                          onClick={() => { 
                            if (!paidToday) {
                              setSelectedMemberForPayment(m); 
                              setPaymentData({
                                  ...INITIAL_PAYMENT_STATE,
                                  amount: currentRound?.monthlyAmount || 0,
                                  date: format(new Date(), 'yyyy-MM-dd')
                              });
                              setIsQuickPaymentDialogOpen(true); 
                            }
                          }}
                        >
                          {paidToday ? <CheckCircle2 className="size-4.5" /> : <IndianRupee className="size-4.5" />}
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

      <Dialog open={isDailyAuditOpen} onOpenChange={setIsDailyAuditOpen}>
        <DialogContent className="sm:max-w-[400px]">
          {currentRound && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Wallet className="size-5 text-primary" />
                  Daily Reconciliation
                </DialogTitle>
                <DialogDescription>
                  Review collections for a specific date in {getDisplayName(currentRound.name)}.
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-6 py-4">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Select Audit Date</Label>
                  <div className="relative">
                    <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                    <Input 
                      type="date" 
                      value={auditDate ?? ""} 
                      onChange={e => setAuditDate(e.target.value)} 
                      className="pl-10 h-11 font-bold text-sm"
                    />
                  </div>
                </div>

                <div className="flex flex-col items-center justify-center p-8 bg-emerald-50 rounded-3xl border border-dashed border-emerald-200 text-center">
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-600/60 mb-3">Audit Total Intake</p>
                  <div className="text-5xl font-black text-emerald-600 tabular-nums tracking-tighter">
                    ₹{getGroupCollectionForDate(currentRound.name, auditDate).toLocaleString()}
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button onClick={() => setIsDailyAuditOpen(false)} className="w-full font-bold h-11 rounded-xl">
                  Close Audit
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isHistoryDialogOpen} onOpenChange={(open) => { if (!isActionPending) { setIsHistoryDialogOpen(open); if (!open) setHistoryMember(null) } }}>
        <DialogContent className="sm:max-w-[550px]">
          {isHistoryDialogOpen && (
            <>
              <DialogHeader><DialogTitle className="text-xl">Payment History: {historyMember?.name}</DialogTitle></DialogHeader>
              <div className="py-4 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs uppercase font-bold text-muted-foreground">Month</TableHead>
                      <TableHead className="text-xs uppercase font-bold text-muted-foreground">Amount</TableHead>
                      <TableHead className="text-right text-xs uppercase font-bold text-muted-foreground">Target Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historyMember && (allPayments || [])
                      .filter(p => p.memberId === historyMember.id && (p.status === 'paid' || p.status === 'success'))
                      .map((p, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-sm font-semibold">{p.month}</TableCell>
                        <TableCell className="text-sm font-bold text-emerald-600">₹{p.amountPaid?.toLocaleString()}</TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground font-medium">{p.targetDate || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <DialogFooter>
                <Button variant="outline" className="gap-2 font-bold" onClick={() => window.print()}>
                  <Printer className="size-4" /> Print History
                </Button>
                <Button className="w-full sm:w-auto font-bold" onClick={() => setIsHistoryDialogOpen(false)}>Close</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isMemberProfileDialogOpen} onOpenChange={setIsMemberProfileDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          {selectedProfileMember && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <User className="size-5 text-primary" /> Member Profile
                </DialogTitle>
                <DialogDescription>
                  Detailed participant information for {selectedProfileMember.name}.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="flex justify-between items-center p-3 bg-muted/30 rounded-lg">
                  <span className="text-xs font-bold uppercase text-muted-foreground">Phone</span>
                  <span className="font-bold text-sm">{selectedProfileMember.phone}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-muted/30 rounded-lg">
                  <span className="text-xs font-bold uppercase text-muted-foreground">Joined</span>
                  <span className="font-bold text-sm">
                    {selectedProfileMember.joinDate ? format(parseISO(selectedProfileMember.joinDate), 'MMM dd, yyyy') : '-'}
                  </span>
                </div>
                <div className="flex justify-between items-center p-3 bg-muted/30 rounded-lg">
                  <span className="text-xs font-bold uppercase text-muted-foreground">Scheme Amount</span>
                  <span className="font-bold text-sm text-primary">₹{(selectedProfileMember.monthlyAmount || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-emerald-50 rounded-lg">
                  <span className="text-xs font-bold uppercase text-emerald-600">Total Contribution</span>
                  <span className="font-bold text-sm text-emerald-700">
                    ₹{(totalPaidByMember.get(selectedProfileMember.id) || 0).toLocaleString()}
                  </span>
                </div>
              </div>
              <DialogFooter className="flex-col sm:flex-row gap-2">
                <Button 
                  variant="outline" 
                  className="w-full sm:w-auto font-bold gap-2"
                  onClick={() => {
                    setMemberProfileToEdit({ 
                      ...selectedProfileMember,
                      paymentType: selectedProfileMember.paymentType || currentRound?.collectionType || "Daily"
                    });
                    setIsEditMemberProfileOpen(true);
                  }}
                >
                  <Edit3 className="size-4" />
                  Edit Profile
                </Button>
                <Button onClick={() => setIsMemberProfileDialogOpen(false)} className="w-full sm:w-auto font-bold ml-auto">
                  Close
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isPendingDetailsOpen} onOpenChange={setIsPendingDetailsOpen}>
        <DialogContent 
          className="sm:max-w-[450px] p-0 overflow-hidden rounded-xl border-none shadow-2xl"
        >
          {selectedPendingMember && (
            <>
              <DialogHeader className="p-6 bg-gradient-to-br from-muted/50 to-background border-b relative">
                <DialogTitle className="text-xl font-bold tracking-tight text-primary">Member Audit Ledger</DialogTitle>
                <DialogDescription className="text-xs font-medium text-muted-foreground">Date-wise payment status for {selectedPendingMember.name} (Post April 2026)</DialogDescription>
                <Button variant="ghost" size="icon" onClick={() => setIsPendingDetailsOpen(false)} className="absolute right-4 top-4 rounded-full"><X className="size-4" /></Button>
              </DialogHeader>
              
              <div className="p-0 bg-background">
                <div className="grid grid-cols-2 p-4 bg-muted/20 border-b gap-4">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest block">Total Arrears</span>
                    <span className="text-lg font-black text-destructive tabular-nums tracking-tighter">
                      ₹{selectedPendingMember.calculatedPendingAmount.toLocaleString()}
                    </span>
                  </div>
                  <div className="space-y-1 text-right">
                    <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest block">Unpaid Interval</span>
                    <span className="text-lg font-black text-destructive tabular-nums tracking-tighter">
                      {selectedPendingMember.calculatedPendingDays} Days
                    </span>
                  </div>
                </div>

                <ScrollArea className="h-[350px]">
                  <Table>
                    <TableHeader className="bg-muted/30 sticky top-0 z-10">
                      <TableRow>
                        <TableHead className="text-[10px] font-black uppercase tracking-widest pl-6">Collection Date</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-widest text-center">Status</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-widest text-right pr-6">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {memberDateLog.map((log, i) => (
                        <TableRow key={i} className="hover:bg-muted/5 transition-colors border-b">
                          <TableCell className="pl-6 py-3 font-semibold text-xs text-foreground/80">{log.label}</TableCell>
                          <TableCell className="text-center">
                            <Badge 
                              variant="outline" 
                              className={cn(
                                "text-[9px] font-black uppercase tracking-widest px-2 py-0.5",
                                log.status === 'Paid' ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-destructive/5 text-destructive border-destructive/20"
                              )}
                            >
                              {log.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right pr-6 font-bold text-xs tabular-nums">
                            {log.amount > 0 ? `₹${log.amount.toLocaleString()}` : '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </div>
              
              <DialogFooter className="p-4 bg-muted/5 border-t">
                <Button 
                  onClick={() => setIsPendingDetailsOpen(false)} 
                  className="w-full h-11 font-black uppercase tracking-widest text-xs rounded-xl shadow-md"
                >
                  Close Board
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isQuickPaymentDialogOpen} onOpenChange={setIsQuickPaymentDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          {selectedMemberForPayment && (
            <form onSubmit={handleQuickPayment}>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">Record Payment</DialogTitle>
                <DialogDescription className="font-medium">Mark specific date as paid for <span className="font-bold text-primary">{selectedMemberForPayment.name}</span>.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-6 py-4">
                <div className="grid gap-2">
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Payment Amount (₹)</Label>
                  <input 
                    type="number" 
                    value={paymentData.amount ?? ""} 
                    onChange={e => setPaymentData({...paymentData, amount: Number(e.target.value)})} 
                    required 
                    className="flex h-12 w-full rounded-xl border border-input bg-background px-3 py-2 text-lg font-black text-primary ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" 
                    placeholder="Enter amount"
                  />
                </div>
                <div className="grid gap-2">
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Target Date (Paying FOR)</Label>
                  <input 
                    type="date" 
                    value={paymentData.date ?? ""} 
                    onChange={e => setPaymentData({...paymentData, date: e.target.value})} 
                    required 
                    className="flex h-11 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" 
                  />
                  <p className="text-[10px] text-muted-foreground italic ml-1">The system will mark this specific date as 'Paid'.</p>
                </div>
                <div className="grid gap-2">
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Payment Method</Label>
                  <Select value={paymentData.method ?? "Cash"} onValueChange={(v) => setPaymentData({...paymentData, method: v})}>
                    <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Cash">Cash (Primary)</SelectItem>
                      <SelectItem value="UPI">UPI Transfer</SelectItem>
                      <SelectItem value="Transfer">Bank Transfer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter className="mt-4">
                <Button type="submit" disabled={isActionPending} className="w-full h-12 font-black uppercase tracking-[0.2em] bg-emerald-600 hover:bg-emerald-700 shadow-lg active:scale-[0.98] transition-all">
                  {isActionPending ? <Loader2 className="mr-2 animate-spin" /> : <CheckCircle2 className="mr-2 size-5" />}
                  Confirm Payment
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
                <input
                  className="flex h-11 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={newMember.name ?? ""} 
                  onChange={e => setNewMember({...newMember, name: e.target.value})} 
                  required 
                />
              </div>
              <div className="grid gap-2">
                <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Phone Number</Label>
                <input
                  className="flex h-11 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={newMember.phone ?? ""} 
                  onChange={e => setNewMember({...newMember, phone: e.target.value})} 
                  required 
                />
              </div>
              <div className="grid gap-2">
                <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Collection Type</Label>
                <Select value={newMember.paymentType || (currentRound?.collectionType || "Daily")} onValueChange={(v) => setNewMember({...newMember, paymentType: v})}>
                  <SelectTrigger className="h-11 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Daily">Daily</SelectItem>
                    <SelectItem value="Monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[9px] text-muted-foreground italic ml-1">Leave empty to use scheme default ({currentRound?.collectionType}).</p>
              </div>
              <div className="grid gap-2">
                <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Enrollment Date</Label>
                <input
                  type="date"
                  className="flex h-11 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={newMember.joinDate ?? ""} 
                  onChange={e => setNewMember({...newMember, joinDate: e.target.value})} 
                  required 
                />
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
