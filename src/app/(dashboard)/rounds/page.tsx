
"use client"

import { useState, useEffect, useMemo } from "react"
import { History, Plus, Users, ChevronLeft, Loader2, IndianRupee, UserPlus, Info, Clock, AlertCircle, CheckCircle2, LayoutDashboard, Search, RefreshCcw, TrendingUp, MoreVertical, Pencil, Trash2, User, Calendar, Wallet, CalendarDays, Edit3, Printer, X, Save } from "lucide-react"
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
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Calendar as CalendarPicker } from "@/components/ui/calendar"
import { useToast } from "@/hooks/use-toast"
import { useFirestore, useCollection, useMemoFirebase, useUser } from "@/firebase"
import { collection, query, doc, serverTimestamp, orderBy, writeBatch, updateDoc, deleteDoc, addDoc, where, getDocs } from "firebase/firestore"
import { useRole } from "@/hooks/use-role"
import { format, parseISO, isSameMonth, eachDayOfInterval, isBefore, isAfter, startOfDay, endOfDay, differenceInDays, addDays, max, isValid, subDays } from "date-fns"
import { cn, withTimeout } from "@/lib/utils"
import { createAuditLog } from "@/firebase/logging"

const INITIAL_CHIT_STATE = { 
  name: "", 
  monthlyAmount: 0, 
  totalMembers: 0, 
  startDate: format(new Date(), 'yyyy-MM-dd'), 
  endDate: format(new Date(), 'yyyy-MM-dd'),
  collectionType: "Daily",
  dueDate: 5
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

const getInitials = (name: string) => {
  if (!name) return "??";
  return name.split(' ').filter(Boolean).map(n => n[0]).join('').toUpperCase();
};

function GroupCycleControl({ group, latestCycle }: { group: any, latestCycle: any }) {
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [isOpen, setIsOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  
  const db = useFirestore()
  const { user } = useUser()
  const { toast } = useToast()

  const isLatestActive = latestCycle && latestCycle.status === 'active';

  useEffect(() => {
    if (isOpen) {
      if (isLatestActive) {
        setStartDate(latestCycle.startDate || "")
        setEndDate(latestCycle.endDate || "")
      } else {
        setStartDate("")
        setEndDate("")
      }
    }
  }, [isOpen, latestCycle, isLatestActive])

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const batch = writeBatch(db);
      const now = new Date();
      let finalStart = startDate || format(now, 'yyyy-MM-dd');
      let finalEnd = endDate || format(addDays(parseISO(finalStart), 5), 'yyyy-MM-dd');

      const q = query(collection(db, 'cycles'), where('name', '==', group.name));
      const querySnapshot = await getDocs(q);
      let cycles = querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
      
      const targetCycleId = isLatestActive ? latestCycle.id : null;
      
      if (targetCycleId) {
        cycles = cycles.map(c => c.id === targetCycleId ? { ...c, startDate: finalStart, endDate: finalEnd } : c);
      } else {
        cycles.push({ id: 'NEW_TEMP', startDate: finalStart, endDate: finalEnd, name: group.name, status: 'active' });
      }

      cycles.sort((a, b) => a.startDate.localeCompare(b.startDate));
      
      for (let i = 0; i < cycles.length - 1; i++) {
        const nextStart = parseISO(cycles[i+1].startDate);
        const expectedEnd = format(subDays(nextStart, 1), 'yyyy-MM-dd');
        
        if (cycles[i].endDate !== expectedEnd) {
          cycles[i].endDate = expectedEnd;
          if (cycles[i].id !== 'NEW_TEMP') {
            batch.update(doc(db, 'cycles', cycles[i].id), { 
              endDate: expectedEnd,
              updatedAt: new Date().toISOString()
            });
          }
        }
      }

      if (targetCycleId) {
        batch.update(doc(db, 'cycles', targetCycleId), {
          startDate: finalStart,
          endDate: finalEnd,
          updatedAt: new Date().toISOString()
        });
      } else {
        const newRef = doc(collection(db, 'cycles'));
        batch.set(newRef, {
          name: group.name,
          startDate: finalStart,
          endDate: finalEnd,
          status: 'active',
          createdAt: new Date().toISOString()
        });
        const newIdx = cycles.findIndex(c => c.id === 'NEW_TEMP');
        cycles[newIdx].id = newRef.id;
      }

      const pQuery = query(collection(db, 'payments'), where('memberId', '!=', 'null'));
      const pSnapshot = await getDocs(pQuery);
      
      pSnapshot.docs.forEach(pDoc => {
        const pData = pDoc.data();
        const targetDate = pData.targetDate || (pData.paymentDate ? (pData.paymentDate.toDate ? format(pData.paymentDate.toDate(), 'yyyy-MM-dd') : pData.paymentDate.split('T')[0]) : null);
        if (!targetDate) return;
        
        const matchingCycle = cycles.find(c => targetDate >= c.startDate && targetDate <= c.endDate);
        if (matchingCycle && pData.cycleId !== matchingCycle.id) {
          batch.update(pDoc.ref, { cycleId: matchingCycle.id });
        }
      });

      await withTimeout(batch.commit());
      await createAuditLog(db, user, `Timeline Chain-Synced for ${group.name}. Cycle updated/created.`);
      toast({ title: "Cycle Saved", description: "Operational timeline and payments synchronized." });
      setIsOpen(false);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Persistence Error", description: error.message || "Failed to save cycle." });
    } finally {
      setIsSaving(false);
      document.body.style.pointerEvents = 'auto';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if(!open) document.body.style.pointerEvents = 'auto'; setIsOpen(open); }}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className={cn("h-8 w-8 rounded-full transition-colors", isLatestActive ? "text-primary/70 hover:text-primary hover:bg-primary/10" : "text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50")}>
          {isLatestActive ? <CalendarDays className="size-4" /> : <Plus className="size-4" />}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[360px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base"><CalendarDays className="size-4 text-primary" />{isLatestActive ? 'Update Period' : 'Start New Cycle'}</DialogTitle>
          <DialogDescription className="text-[11px]">Timeline will auto-adjust predecessor boundaries.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label className="text-[10px] font-bold uppercase text-muted-foreground">Start</Label><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-9 text-xs rounded-lg" disabled={isSaving} /></div>
            <div className="space-y-1"><Label className="text-[10px] font-bold uppercase text-muted-foreground">End</Label><Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-9 text-xs rounded-lg" disabled={isSaving} /></div>
          </div>
        </div>
        <DialogFooter><Button onClick={handleSave} disabled={isSaving} className="w-full font-black uppercase tracking-[0.1em] h-10 rounded-xl active:scale-95 transition-all shadow-sm">{isSaving ? <Loader2 className="size-3 mr-2 animate-spin" /> : <Save className="size-3 mr-2" />}{isLatestActive ? 'Apply' : 'Launch'}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function RoundsPage() {
  const [mounted, setMounted] = useState(false)
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
  const [selectedReconciliationCycleId, setSelectedReconciliationCycleId] = useState<string | null>(null)
  
  const [isDailyAuditOpen, setIsDailyAuditOpen] = useState(false)
  const [auditDate, setAuditDate] = useState(format(new Date(), 'yyyy-MM-dd'))

  const [historyMember, setHistoryMember] = useState<any>(null)
  const [selectedMemberForPayment, setSelectedMemberForPayment] = useState<any>(null)
  const [selectedProfileMember, setSelectedProfileMember] = useState<any>(null)
  const [selectedPendingMember, setSelectedPendingMember] = useState<any>(null)
  const [newMember, setNewMember] = useState(INITIAL_MEMBER_STATE)
  const [paymentData, setPaymentData] = useState(INITIAL_PAYMENT_STATE)
  const [newChit, setNewChit] = useState(INITIAL_CHIT_STATE)
  
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

  const cyclesQuery = useMemoFirebase(() => query(collection(db, 'cycles'), orderBy('createdAt', 'desc')), [db]);
  const { data: allCycles } = useCollection(cyclesQuery);

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    return () => {
      document.body.style.pointerEvents = 'auto';
      document.body.style.overflow = 'auto';
    };
  }, []);

  useEffect(() => {
    if (isCollectionPopupOpen && activePopupGroupName && allCycles) {
      const groupCycles = allCycles.filter(c => String(c.name).trim() === String(activePopupGroupName).trim());
      const active = groupCycles.find(c => c.status === 'active') || groupCycles[0];
      if (active) {
        setSelectedReconciliationCycleId(active.id);
      }
    }
  }, [isCollectionPopupOpen, activePopupGroupName, allCycles]);

  const getPaymentAmount = (p: any) => Number(p.amountPaid || p.amount || 0);
  
  const getIntakeDateStr = (p: any) => {
    const cAt = p.createdAt;
    if (cAt) {
      try {
        const d = cAt.toDate ? cAt.toDate() : new Date(cAt);
        if (isValid(d)) return format(d, 'yyyy-MM-dd');
      } catch (e) {}
    }
    const pDt = p.paymentDate;
    if (pDt) {
      try {
        const d = pDt.toDate ? pDt.toDate() : new Date(pDt);
        if (isValid(d)) return format(d, 'yyyy-MM-dd');
      } catch (e) {}
    }
    return getRecordDate(p);
  };

  const getRecordDate = (p: any) => {
    if (p.targetDate) return p.targetDate;
    if (p.paymentDate) {
      const d = p.paymentDate?.toDate ? p.paymentDate.toDate() : parseISO(p.paymentDate);
      if (isValid(d)) return format(d, 'yyyy-MM-dd');
    }
    return null;
  };

  const membersWithCalculatedStats = useMemo(() => {
    if (!members || !allPayments || !chitSchemes) return [];
    const now = startOfDay(new Date());
    const todayStr = format(now, 'yyyy-MM-dd');
    const today = now;

    return members.map(m => {
      const activeCycle = (allCycles || []).find(c => String(c.name).trim() === String(m.chitGroup).trim() && c.status === 'active');
      const mPayments = allPayments.filter(p => p.memberId === m.id && (p.status === 'success' || p.status === 'paid'));
      const scheme = chitSchemes.find(r => String(r.name).trim() === String(m.chitGroup).trim());
      const resolvedType = (m.paymentType || scheme?.collectionType || "Daily");
      
      let pendingDaysCount = 0;
      let memberStatus: 'paid' | 'pending' | 'waiting' = 'pending';

      if (!activeCycle) {
        return { ...m, calculatedPendingDays: 0, calculatedPendingAmount: 0, memberStatus: 'paid' as const };
      }

      if (resolvedType === 'Daily') {
        if (m.joinDate && m.status !== 'inactive') {
          try {
            const rawJoinDate = parseISO(m.joinDate);
            const cycleStart = parseISO(activeCycle.startDate);
            const cycleEnd = parseISO(activeCycle.endDate);
            const effectiveStart = startOfDay(max([rawJoinDate, cycleStart]));
            const effectiveEnd = isBefore(today, cycleEnd) ? today : cycleEnd;
            if (isBefore(effectiveStart, addDays(effectiveEnd, 1))) {
              const interval = eachDayOfInterval({ start: effectiveStart, end: effectiveEnd });
              interval.forEach(day => {
                const dStr = format(day, 'yyyy-MM-dd');
                const dayPaymentSum = mPayments.filter(p => getRecordDate(p) === dStr).reduce((acc, p) => acc + getPaymentAmount(p), 0);
                if (dayPaymentSum < (m.monthlyAmount || 800)) { pendingDaysCount++; }
              });
            }
          } catch (e) {}
        }
        memberStatus = mPayments.filter(p => getRecordDate(p) === todayStr).reduce((acc, p) => acc + getPaymentAmount(p), 0) >= (m.monthlyAmount || 800) ? 'paid' : 'pending';
      } else {
        const hasPaidThisCycle = mPayments.some(p => {
          const pDate = getRecordDate(p);
          return pDate && pDate >= activeCycle.startDate && pDate <= activeCycle.endDate;
        });
        
        if (hasPaidThisCycle) {
          memberStatus = 'paid';
          pendingDaysCount = 0;
        } else {
          const cycleStart = parseISO(activeCycle.startDate);
          const cycleEnd = parseISO(activeCycle.endDate);
          const numericDueDate = scheme?.dueDate || 5;
          let isPastDue = !isSameMonth(today, cycleStart) || today.getDate() > numericDueDate;
          let dueDateLimit = startOfDay(addDays(cycleStart, numericDueDate - 1));
          
          if (!isPastDue) {
            memberStatus = 'waiting';
            pendingDaysCount = 0;
          } else {
            memberStatus = 'pending';
            const rawJoinDate = parseISO(m.joinDate);
            const countFrom = addDays(dueDateLimit, 1);
            const effectiveStart = startOfDay(max([rawJoinDate, cycleStart, countFrom]));
            const effectiveEnd = isBefore(today, cycleEnd) ? today : cycleEnd;
            if (isBefore(effectiveStart, addDays(effectiveEnd, 1))) {
              pendingDaysCount = differenceInDays(effectiveEnd, effectiveStart) + 1;
            } else {
              pendingDaysCount = 0;
            }
          }
        }
      }

      return { ...m, calculatedPendingDays: pendingDaysCount, calculatedPendingAmount: pendingDaysCount * (m.monthlyAmount || 800), memberStatus: memberStatus };
    });
  }, [members, allPayments, chitSchemes, allCycles]);

  const currentRound = useMemo(() => chitSchemes.find(r => r.id === selectedChitId), [chitSchemes, selectedChitId])
  const assignedMembers = useMemo(() => membersWithCalculatedStats.filter(m => m.status !== 'inactive' && String(m.chitGroup).trim() === String(currentRound?.name).trim()), [membersWithCalculatedStats, currentRound])

  const totalPaidByMember = useMemo(() => {
    const map = new Map<string, number>();
    if (!allPayments || !members || !allCycles) return map;
    (allPayments || []).forEach(p => {
      if ((p.status === 'paid' || p.status === 'success')) {
        const member = members.find(m => m.id === p.memberId);
        if (!member) return;
        const activeCycle = (allCycles || []).find(c => String(c.name).trim() === String(member.chitGroup).trim() && c.status === 'active');
        if (!activeCycle) return;
        const pDate = getRecordDate(p);
        if (pDate && pDate >= activeCycle.startDate && pDate <= activeCycle.endDate) {
          const amt = getPaymentAmount(p);
          if (amt > 0) {
            const current = map.get(p.memberId) || 0;
            map.set(p.memberId, current + amt);
          }
        }
      }
    });
    return map;
  }, [allPayments, members, allCycles]);

  const missedDatesForSelectedMember = useMemo(() => {
    if (!selectedPendingMember || !allPayments || !allCycles || !chitSchemes) return [];
    
    const m = selectedPendingMember;
    const activeCycle = (allCycles || []).find(c => String(c.name).trim() === String(m.chitGroup).trim() && c.status === 'active');
    if (!activeCycle) return [];

    const scheme = chitSchemes.find(r => String(r.name).trim() === String(m.chitGroup).trim());
    const resolvedType = (m.paymentType || scheme?.collectionType || "Daily");
    const mPayments = allPayments.filter(p => p.memberId === m.id && (p.status === 'success' || p.status === 'paid'));
    
    const missed: string[] = [];
    const today = startOfDay(new Date());

    if (resolvedType === 'Daily') {
      if (m.joinDate && m.status !== 'inactive') {
        try {
          const rawJoinDate = parseISO(m.joinDate);
          const cycleStart = parseISO(activeCycle.startDate);
          const cycleEnd = parseISO(activeCycle.endDate);
          const effectiveStart = startOfDay(max([rawJoinDate, cycleStart]));
          const effectiveEnd = isBefore(today, cycleEnd) ? today : cycleEnd;
          
          if (isBefore(effectiveStart, addDays(effectiveEnd, 1))) {
            const interval = eachDayOfInterval({ start: effectiveStart, end: effectiveEnd });
            interval.forEach(day => {
              const dStr = format(day, 'yyyy-MM-dd');
              const dayPaymentSum = mPayments.filter(p => getRecordDate(p) === dStr).reduce((acc, p) => acc + getPaymentAmount(p), 0);
              if (dayPaymentSum < (m.monthlyAmount || 800)) {
                missed.push(dStr);
              }
            });
          }
        } catch (e) {}
      }
    } else {
      if (m.memberStatus === 'pending') {
        missed.push(activeCycle.startDate);
      }
    }
    
    return missed;
  }, [selectedPendingMember, allPayments, allCycles, chitSchemes]);

  const getDisplayName = (name: string) => {
    if (!name) return "";
    const clean = name.replace(/Group/gi, '').trim();
    return `Group ${clean}`;
  };

  const getGroupCollectionForDate = (groupName: string, dateStr: string) => {
    if (!allPayments || !members) return 0;
    const groupMemberIds = new Set(members.filter(m => String(m.chitGroup).trim() === String(groupName).trim()).map(m => m.id));
    return allPayments
      .filter(p => {
        if (!groupMemberIds.has(p.memberId)) return false;
        if (p.status !== 'success' && p.status !== 'paid') return false;
        const intakeDate = getIntakeDateStr(p);
        return intakeDate === dateStr;
      })
      .reduce((acc, p) => acc + getPaymentAmount(p), 0);
  };

  const getGroupTodayCollection = (groupName: string) => {
    return getGroupCollectionForDate(groupName, format(new Date(), 'yyyy-MM-dd'));
  };

  const getGroupActiveCycleCollection = (groupName: string) => {
    const activeCycle = (allCycles || []).find(c => String(c.name).trim() === String(groupName).trim() && c.status === 'active');
    if (!activeCycle || !allPayments || !members) return 0;
    const groupMemberIds = new Set(members.filter(m => String(m.chitGroup).trim() === String(groupName).trim()).map(m => m.id));
    return allPayments
      .filter(p => {
        const pDate = getRecordDate(p);
        return groupMemberIds.has(p.memberId) && (p.status === 'success' || p.status === 'paid') && pDate && pDate >= activeCycle.startDate && pDate <= activeCycle.endDate;
      })
      .reduce((acc, p) => acc + getPaymentAmount(p), 0);
  };

  const reconciliationCycles = useMemo(() => {
    if (!activePopupGroupName || !allCycles) return [];
    const uniqueMap = new Map<string, any>();
    allCycles
      .filter(c => String(c?.name || "").trim().toLowerCase() === activePopupGroupName.toLowerCase())
      .forEach(c => {
        const start = String(c?.startDate || "-");
        const existing = uniqueMap.get(start);
        if (!existing || (c.status === 'active' && existing.status !== 'active')) {
          uniqueMap.set(start, c);
        }
      });

    return Array.from(uniqueMap.values())
      .filter(c => !viewYear || format(parseISO(c.startDate), 'yyyy') === viewYear)
      .sort((a, b) => b.startDate.localeCompare(a.startDate));
  }, [activePopupGroupName, allCycles, viewYear]);

  const reconciliationTotal = useMemo(() => {
    if (!activePopupGroupName || !selectedReconciliationCycleId || !allPayments || !members || !allCycles) return 0;
    const cycle = allCycles.find(c => c.id === selectedReconciliationCycleId);
    if (!cycle) return 0;
    const groupMemberIds = new Set(members.filter(m => String(m.chitGroup).trim() === String(activePopupGroupName).trim()).map(m => m.id));
    return allPayments
      .filter(p => groupMemberIds.has(p.memberId) && (p.status === 'success' || p.status === 'paid') && getRecordDate(p) >= cycle.startDate && getRecordDate(p) <= cycle.endDate)
      .reduce((acc, p) => acc + getPaymentAmount(p), 0);
  }, [activePopupGroupName, selectedReconciliationCycleId, allPayments, members, allCycles]);

  const handleQuickPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !selectedMemberForPayment || !currentRound || isActionPending) return;
    const pAmt = Number(paymentData.amount);
    const tDate = paymentData.date; 
    const alreadyPaid = (allPayments || []).some(p => p.memberId === selectedMemberForPayment.id && getRecordDate(p) === tDate && (p.status === 'success' || p.status === 'paid'));
    if (alreadyPaid) {
      toast({ variant: "destructive", title: "Duplicate Entry", description: "Already paid for this date." });
      return;
    }
    setIsActionPending(true);
    try {
      const activeCycle = (allCycles || []).find(c => String(c.name).trim() === String(currentRound.name).trim() && c.status === 'active');
      const paymentRef = doc(collection(db, 'payments'));
      await addDoc(collection(db, 'payments'), {
        id: paymentRef.id,
        memberId: selectedMemberForPayment.id,
        memberName: selectedMemberForPayment.name,
        month: format(parseISO(tDate), 'MMMM yyyy'),
        targetDate: tDate,
        amountPaid: pAmt,
        paymentDate: new Date().toISOString(),
        status: "success",
        method: paymentData.method,
        cycleId: activeCycle?.id || null,
        createdAt: serverTimestamp()
      });
      await createAuditLog(db, user, `Processed Payment ₹${pAmt} for ${selectedMemberForPayment.name} (${tDate})`);
      setIsQuickPaymentDialogOpen(false);
      toast({ title: "Payment Recorded", description: "Record attributed to operational cycle." });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message || "Failed to record payment." });
    } finally {
      setIsActionPending(false);
      document.body.style.pointerEvents = 'auto';
    }
  }

  const handleAddChit = async (e: React.FormEvent) => {
    e.preventDefault(); 
    if (!db || isActionPending) return;
    setIsActionPending(true);
    try {
      const chitData = { ...newChit, monthlyAmount: Number(newChit.monthlyAmount), totalMembers: Number(newChit.totalMembers), dueDate: Number(newChit.dueDate || 5), createdAt: serverTimestamp() };
      await addDoc(collection(db, 'chitRounds'), chitData);
      await createAuditLog(db, user, `Created new scheme: ${newChit.name}`);
      setIsAddChitDialogOpen(false); 
      setNewChit(INITIAL_CHIT_STATE);
      toast({ title: "Scheme Created", description: "The scheme has been added." });
    } catch (e: any) { toast({ variant: "destructive", title: "Error", description: e.message || "Failed to create scheme." }); } finally { setIsActionPending(false); document.body.style.pointerEvents = 'auto'; }
  }

  const handleUpdateChit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !chitToEdit || isActionPending) return;
    setIsActionPending(true);
    try {
      await updateDoc(doc(db, 'chitRounds', chitToEdit.id), { name: chitToEdit.name, monthlyAmount: Number(chitToEdit.monthlyAmount), totalMembers: Number(chitToEdit.totalMembers), collectionType: chitToEdit.collectionType, dueDate: Number(chitToEdit.dueDate || 5) });
      await createAuditLog(db, user, `Updated scheme parameters: ${chitToEdit.name}`);
      setIsEditChitDialogOpen(false);
      toast({ title: "Scheme Updated", description: "Changes saved." });
    } catch (e: any) { toast({ variant: "destructive", title: "Error", description: e.message || "Failed to update scheme." }); } finally { setIsActionPending(false); document.body.style.pointerEvents = 'auto'; }
  }

  const handleDeleteChit = async () => {
    if (!db || !chitToDelete || isActionPending) return;
    setIsActionPending(true);
    try {
      await deleteDoc(doc(db, 'chitRounds', chitToDelete.id));
      await createAuditLog(db, user, `Deleted scheme: ${chitToDelete.name}`);
      setIsDeleteChitDialogOpen(false);
      toast({ title: "Scheme Deleted", description: "Record removed." });
    } catch (e: any) { toast({ variant: "destructive", title: "Error", description: e.message || "Failed to delete scheme." }); } finally { setIsActionPending(false); document.body.style.pointerEvents = 'auto'; }
  }

  const handleAddMemberToScheme = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !currentRound || isActionPending) return;
    setIsActionPending(true);
    try {
      await addDoc(collection(db, 'members'), { ...newMember, paymentType: newMember.paymentType || currentRound.collectionType, chitGroup: currentRound.name, monthlyAmount: currentRound.monthlyAmount, status: "active", createdAt: serverTimestamp() });
      await createAuditLog(db, user, `Registered ${newMember.name} to scheme ${currentRound.name}`);
      setIsAddMemberDialogOpen(false);
      setNewMember(INITIAL_MEMBER_STATE);
      toast({ title: "Member Registered", description: `${newMember.name} joined.` });
    } catch (e: any) { toast({ variant: "destructive", title: "Error", description: e.message || "Failed to register member." }); } finally { setIsActionPending(false); document.body.style.pointerEvents = 'auto'; }
  }

  const handleUpdateMemberProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !memberProfileToEdit || isActionPending) return;
    setIsActionPending(true);
    try {
      await updateDoc(doc(db, 'members', memberProfileToEdit.id), { name: memberProfileToEdit.name, phone: memberProfileToEdit.phone, joinDate: memberProfileToEdit.joinDate, paymentType: memberProfileToEdit.paymentType });
      await createAuditLog(db, user, `Updated member profile: ${memberProfileToEdit.name}`);
      setIsEditMemberProfileOpen(false);
      setIsMemberProfileDialogOpen(false);
      toast({ title: "Profile Updated", description: "Details saved successfully." });
    } catch (e: any) { toast({ variant: "destructive", title: "Error", description: e.message || "Failed to update profile." }); } finally { setIsActionPending(false); document.body.style.pointerEvents = 'auto'; }
  }

  if (isRoleLoading || isRoundsLoading) return (<div className="flex h-[60vh] items-center justify-center"><Loader2 className="size-8 animate-spin text-primary" /></div>)

  if (!selectedChitId) {
    return (
      <div className="space-y-8 animate-in fade-in duration-500 pb-10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5"><h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-primary font-headline">Seat Reservations</h2><p className="text-sm text-muted-foreground font-medium">Manage schemes and isolated audit periods.</p></div>
          <Button onClick={() => setIsAddChitDialogOpen(true)} className="font-bold gap-2 px-6 h-11 shadow-lg bg-primary hover:bg-primary/90 active:scale-95 transition-all"><Plus className="size-5" /> Add Scheme</Button>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {chitSchemes.map((group) => {
            const currentOccupancy = (members || []).filter(m => m.status !== 'inactive' && String(m.chitGroup).trim() === String(group.name).trim()).length;
            const groupPendingCount = membersWithCalculatedStats.filter(m => String(m.chitGroup).trim() === String(group.name).trim() && m.status !== 'inactive' && m.memberStatus === 'pending').length;
            const activeCycle = (allCycles || []).find(c => String(c.name).trim() === String(group.name).trim() && c.status === 'active');
            return (
              <Card key={group.id} className="group hover:shadow-xl transition-all border-border/60 overflow-hidden flex flex-col relative bg-card shadow-sm rounded-2xl">
                <div className="absolute top-3 right-3 flex items-center gap-1">
                  <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"><MoreVertical className="size-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onSelect={() => { setChitToEdit(group); setIsEditChitDialogOpen(true); }}><Pencil className="size-4 mr-2" /> Edit Scheme</DropdownMenuItem><DropdownMenuSeparator /><DropdownMenuItem className="text-destructive" onSelect={() => { setChitToDelete(group); setIsDeleteChitDialogOpen(true); }}><Trash2 className="size-4 mr-2" /> Delete Scheme</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-primary/10 text-primary/70 hover:text-primary transition-colors" onClick={() => { setActivePopupGroupName(group.name); setIsCollectionPopupOpen(true); }}><Wallet className="size-4" /></Button>
                  <GroupCycleControl group={group} latestCycle={activeCycle || (allCycles || []).find(c => String(c.name).trim() === String(group.name).trim())} />
                </div>
                <CardHeader className="p-5 pb-3 space-y-1.5 border-b border-border/40">
                  <Badge variant="outline" className="w-fit text-[10px] font-black uppercase tracking-widest px-2 py-0.5 bg-primary/5 border-primary/20 text-primary">{group.collectionType}</Badge>
                  <CardTitle className="text-xl font-bold tracking-tight text-foreground truncate pr-16">{getDisplayName(group.name)}</CardTitle>
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest"><Calendar className="size-3 text-primary/40" />{activeCycle ? `${format(parseISO(activeCycle.startDate), 'MMM dd')} → ${format(parseISO(activeCycle.endDate), 'MMM dd')}` : 'No Active Cycle'}</div>
                </CardHeader>
                <CardContent className="p-5 flex-1 space-y-4">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center text-xs"><span className="text-muted-foreground font-semibold">Base Goal</span><span className="font-bold text-primary">₹{(group.monthlyAmount || 0).toLocaleString()}</span></div>
                    <div className="flex justify-between items-center text-xs"><span className="text-amber-600 font-semibold">Pending</span><span className={cn("font-bold text-sm", groupPendingCount > 0 ? "text-amber-500" : "text-emerald-600")}>{groupPendingCount}</span></div>
                    <div className="flex justify-between items-center text-xs"><span className="text-muted-foreground font-semibold">Occupancy</span><span className="font-black tabular-nums">{currentOccupancy} / {group.totalMembers}</span></div>
                    <div className="pt-4 border-t border-dashed border-border/60 mt-4"><div className="flex justify-between items-center"><span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">Cycle Collection</span><span className="font-black text-emerald-600 text-base tabular-nums">₹{getGroupActiveCycleCollection(group.name).toLocaleString()}</span></div></div>
                  </div>
                </CardContent>
                <CardFooter className="p-1.5 bg-muted/5 border-t border-border/40"><Button variant="ghost" className="w-full h-7 font-black text-[10px] uppercase tracking-[0.2em] hover:bg-primary hover:text-primary-foreground rounded-lg" onClick={() => setSelectedChitId(group.id)}>View Board</Button></CardFooter>
              </Card>
            );
          })}
        </div>

        <Dialog open={isCollectionPopupOpen} onOpenChange={(o) => { if(!o) document.body.style.pointerEvents = 'auto'; setIsCollectionPopupOpen(o); }}>
          <DialogContent className="sm:max-w-[360px]">
            {activePopupGroupName && (
              <>
                <DialogHeader><DialogTitle className="flex items-center gap-2 text-base"><Wallet className="size-4 text-primary" />Board Reconciliation</DialogTitle><DialogDescription className="text-[11px]">Summary for {getDisplayName(activePopupGroupName)}.</DialogDescription></DialogHeader>
                <div className="space-y-4 py-2">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1"><Label className="text-[10px] font-black uppercase text-muted-foreground">Year</Label><Select value={viewYear} onValueChange={setViewYear}><SelectTrigger className="h-9 text-xs font-bold"><SelectValue /></SelectTrigger><SelectContent>{YEARS.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent></Select></div>
                    <div className="space-y-1"><Label className="text-[10px] font-black uppercase text-muted-foreground">Cycle</Label><Select value={selectedReconciliationCycleId || ""} onValueChange={setSelectedReconciliationCycleId}><SelectTrigger className="h-9 text-xs font-bold"><SelectValue placeholder="Select Cycle" /></SelectTrigger><SelectContent>{reconciliationCycles.length > 0 ? reconciliationCycles.map(c => <SelectItem key={c.id} value={c.id} className="text-xs">{c.startDate} → {c.endDate}</SelectItem>) : <div className="p-4 text-center text-[10px] font-bold uppercase text-muted-foreground italic">No cycles found</div>}</SelectContent></Select></div>
                  </div>
                  <div className="flex flex-col items-center justify-center p-6 bg-emerald-50 rounded-2xl border border-dashed border-emerald-200 text-center"><p className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-600/60 mb-2">Verified Total</p><div className="text-4xl font-black text-emerald-600 tabular-nums tracking-tighter">₹{reconciliationTotal.toLocaleString()}</div></div>
                </div>
                <DialogFooter><Button onClick={() => setIsCollectionPopupOpen(false)} className="w-full font-bold h-10 rounded-xl">Close Audit</Button></DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={isAddChitDialogOpen} onOpenChange={(o) => { if(!o) document.body.style.pointerEvents = 'auto'; setIsAddChitDialogOpen(o); }}>
          <DialogContent className="sm:max-w-[380px]">
            <form onSubmit={handleAddChit}>
              <DialogHeader><DialogTitle className="text-lg font-bold">New Scheme</DialogTitle></DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-1.5"><Label className="text-[10px] font-bold uppercase text-muted-foreground">Scheme Name</Label><Input value={newChit.name} onChange={e => setNewChit({...newChit, name: e.target.value})} required className="h-10 rounded-xl text-sm" placeholder="e.g. Group A" /></div>
                <div className="grid gap-1.5"><Label className="text-[10px] font-bold uppercase text-muted-foreground">Amount (₹)</Label><Input type="number" value={newChit.monthlyAmount || ""} onChange={e => setNewChit({...newChit, monthlyAmount: Number(e.target.value)})} required className="h-10 rounded-xl text-sm" /></div>
                <div className="grid gap-1.5"><Label className="text-[10px] font-bold uppercase text-muted-foreground">Max Members</Label><Input type="number" value={newChit.totalMembers || ""} onChange={e => setNewChit({...newChit, totalMembers: Number(e.target.value)})} required className="h-10 rounded-xl text-sm" /></div>
                <div className="grid gap-1.5"><Label className="text-[10px] font-bold uppercase text-muted-foreground">Collection Type</Label><Select value={newChit.collectionType} onValueChange={(v) => setNewChit({...newChit, collectionType: v})}><SelectTrigger className="h-10 rounded-xl"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Daily">Daily</SelectItem><SelectItem value="Monthly">Monthly</SelectItem></SelectContent></Select></div>
              </div>
              <DialogFooter><Button type="submit" disabled={isActionPending} className="w-full h-10 font-bold text-sm shadow-md active:scale-[0.98] transition-all">{isActionPending ? <Loader2 className="mr-2 size-3 animate-spin" /> : null}Create Scheme</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={isEditChitDialogOpen} onOpenChange={(o) => { if(!o) { setChitToEdit(null); document.body.style.pointerEvents = 'auto'; } setIsEditChitDialogOpen(o); }}>
          <DialogContent className="sm:max-w-[380px]">
            {chitToEdit && (
              <form onSubmit={handleUpdateChit}>
                <DialogHeader><DialogTitle className="text-lg">Edit Scheme</DialogTitle></DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-1.5"><Label className="text-[10px] font-bold uppercase text-muted-foreground">Scheme Name</Label><Input value={chitToEdit.name} onChange={e => setChitToEdit({...chitToEdit, name: e.target.value})} required className="h-10 rounded-xl text-sm" /></div>
                  <div className="grid gap-1.5"><Label className="text-[10px] font-bold uppercase text-muted-foreground">Amount (₹)</Label><Input type="number" value={chitToEdit.monthlyAmount || ""} onChange={e => setChitToEdit({...chitToEdit, monthlyAmount: Number(e.target.value)})} required className="h-10 rounded-xl text-sm" /></div>
                  <div className="grid gap-1.5"><Label className="text-[10px] font-bold uppercase text-muted-foreground">Max Members</Label><Input type="number" value={chitToEdit.totalMembers || ""} onChange={e => setChitToEdit({...chitToEdit, totalMembers: Number(e.target.value)})} required className="h-10 rounded-xl text-sm" /></div>
                  <div className="grid gap-1.5"><Label className="text-[10px] font-bold uppercase text-muted-foreground">Collection Type</Label><Select value={chitToEdit.collectionType} onValueChange={(v) => setChitToEdit({...chitToEdit, collectionType: v})}><SelectTrigger className="h-10 rounded-xl"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Daily">Daily</SelectItem><SelectItem value="Monthly">Monthly</SelectItem></SelectContent></Select></div>
                </div>
                <DialogFooter><Button type="submit" disabled={isActionPending} className="w-full h-10 font-bold text-sm">{isActionPending ? <Loader2 className="mr-2 size-3 animate-spin" /> : null}Save Changes</Button></DialogFooter>
              </form>
            )}
          </DialogContent>
        </Dialog>

        <AlertDialog open={isDeleteChitDialogOpen} onOpenChange={(o) => { if(!o) { setChitToDelete(null); document.body.style.pointerEvents = 'auto'; } setIsDeleteChitDialogOpen(o); }}>
          <AlertDialogContent className="sm:max-w-[380px]">
            <AlertDialogHeader><AlertDialogTitle className="text-destructive text-lg">Delete Scheme?</AlertDialogTitle><AlertDialogDescription className="text-xs">This will permanently remove <strong>{chitToDelete?.name}</strong> and all associated data.</AlertDialogDescription></AlertDialogHeader>
            <AlertDialogFooter><AlertDialogCancel onClick={() => setIsDeleteChitDialogOpen(false)} className="h-10 text-xs">Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDeleteChit} disabled={isActionPending} className="bg-destructive hover:bg-destructive/90 h-10 text-xs">{isActionPending ? <Loader2 className="mr-2 size-3 animate-spin" /> : null}Delete</AlertDialogAction></AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    )
  }

  const currentActiveCycle = (allCycles || []).find(c => String(c.name).trim() === String(currentRound?.name).trim() && c.status === 'active');

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => setSelectedChitId(null)} className="rounded-full h-10 w-10 shadow-sm active:scale-95 transition-all"><ChevronLeft className="size-5" /></Button>
          <div className="min-w-0"><div className="flex items-center gap-2 mb-1"><h2 className="text-xl sm:text-2xl font-black truncate tracking-tight text-primary font-headline uppercase">{currentRound?.name}</h2><Badge variant="secondary" className="text-[9px] font-black tracking-tighter bg-primary/10 text-primary border-none">{currentRound?.collectionType}</Badge></div></div>
        </div>
        <div className="flex items-center gap-3"><Button onClick={() => setIsAddMemberDialogOpen(true)} className="font-bold gap-2 h-11 px-6 shadow-lg active:scale-95 transition-all"><UserPlus className="size-5" /> Add Member</Button></div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="shadow-sm border-l-4 border-l-primary/40 bg-card rounded-xl"><CardHeader className="p-2.5 pb-1"><CardTitle className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Base Rate</CardTitle></CardHeader><CardContent className="p-2.5 pt-0"><div className="text-lg font-bold tabular-nums tracking-tight">₹{(currentRound?.monthlyAmount || 0).toLocaleString()}</div></CardContent></Card>
        <Card className="shadow-sm border-l-4 border-l-primary bg-card rounded-xl"><CardHeader className="p-2.5 pb-1"><CardTitle className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Occupancy</CardTitle></CardHeader><CardContent className="p-2.5 pt-0"><div className="text-lg font-bold tabular-nums tracking-tight">{assignedMembers.length} / {currentRound?.totalMembers}</div></CardContent></Card>
        <Card className="shadow-sm border-l-4 border-l-amber-500 bg-card rounded-xl"><CardHeader className="p-2.5 pb-1"><CardTitle className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Pending</CardTitle></CardHeader><CardContent className="p-2.5 pt-0"><div className="text-lg font-bold tabular-nums text-amber-600 tracking-tight">{assignedMembers.filter(m => m.memberStatus === 'pending').length}</div></CardContent></Card>
        <Card className="shadow-sm border-l-4 border-l-emerald-500 bg-card rounded-xl"><CardHeader className="p-2.5 pb-1 flex flex-row items-center justify-between"><CardTitle className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Today Collection</CardTitle><Button variant="ghost" size="icon" className="h-6 w-6 rounded-full hover:bg-emerald-50 text-emerald-600/70 hover:text-emerald-600" onClick={() => setIsDailyAuditOpen(true)}><Wallet className="size-3" /></Button></CardHeader><CardContent className="p-2.5 pt-0"><div className="text-lg font-bold tabular-nums text-emerald-600 tracking-tight">₹{getGroupTodayCollection(currentRound?.name).toLocaleString()}</div></CardContent></Card>
      </div>

      <div className="rounded-2xl border bg-card shadow-sm overflow-hidden border-border/60">
        <div className="p-5 border-b bg-muted/30 flex justify-between items-center"><h3 className="text-sm font-bold flex items-center gap-2 tracking-tight uppercase"><Users className="size-4 text-primary" /> Board Participants</h3></div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/10"><TableRow className="border-b"><TableHead className="text-[10px] uppercase font-black tracking-[0.2em] h-12 pl-6">Member Participant</TableHead><TableHead className="text-[10px] uppercase font-black tracking-[0.2em] h-12">Arrears Count</TableHead><TableHead className="text-[10px] uppercase font-black tracking-[0.2em] h-12">Status Indicator</TableHead><TableHead className="w-[120px] pr-6"></TableHead></TableRow></TableHeader>
            <TableBody>
              {assignedMembers.length > 0 ? assignedMembers.map((m) => (
                <TableRow key={m.id} className="hover:bg-muted/5 transition-colors group">
                  <TableCell className="pl-6 py-4"><div className="flex items-center gap-4 cursor-pointer" onClick={() => { setSelectedProfileMember(m); setIsMemberProfileDialogOpen(true); }}><div className="h-10 w-10 rounded-xl bg-secondary text-primary flex items-center justify-center font-black text-xs uppercase">{getInitials(m.name)}</div><div className="flex flex-col min-w-0"><span className="text-sm font-bold truncate tracking-tight">{m.name}</span><span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{m.paymentType || currentRound?.collectionType}</span></div></div></TableCell>
                  <TableCell><button onClick={() => { setSelectedPendingMember(m); setIsPendingDetailsOpen(true); }} className={cn("px-4 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest tabular-nums", m.calculatedPendingDays > 0 ? "text-destructive font-bold" : "text-muted-foreground/40")}>{m.calculatedPendingDays} Days</button></TableCell>
                  <TableCell><Badge variant={m.memberStatus === 'paid' ? 'default' : 'secondary'} className={cn("text-[9px] font-black uppercase tracking-widest px-3 py-1 border-none shadow-sm", m.memberStatus === 'paid' ? "bg-emerald-500" : (m.memberStatus === 'waiting' ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"))}>{m.memberStatus.toUpperCase()}</Badge></TableCell>
                  <TableCell className="text-right pr-6"><div className="flex items-center justify-end gap-1.5"><Button variant="ghost" size="icon" className={cn("h-9 w-9 rounded-xl transition-all", m.memberStatus === 'paid' ? "text-emerald-500 bg-emerald-50" : "text-emerald-600 hover:bg-emerald-50 active:scale-90")} disabled={m.memberStatus === 'paid' || isActionPending || !currentActiveCycle} onClick={() => { setSelectedMemberForPayment(m); setPaymentData({ ...INITIAL_PAYMENT_STATE, amount: m.monthlyAmount || currentRound?.monthlyAmount || 800, date: format(new Date(), 'yyyy-MM-dd') }); setIsQuickPaymentDialogOpen(true); }}><IndianRupee className="size-4.5" /></Button><Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:bg-muted/50 rounded-xl" onClick={() => { setHistoryMember(m); setIsHistoryDialogOpen(true); }}><History className="size-4.5" /></Button></div></TableCell>
                </TableRow>
              )) : <TableRow><TableCell colSpan={4} className="h-48 text-center text-[11px] uppercase tracking-[0.2em] text-muted-foreground/60 font-bold italic">No participant records located</TableCell></TableRow>}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Profile Dialog */}
      <Dialog open={isMemberProfileDialogOpen} onOpenChange={(o) => { if(!o) { setSelectedProfileMember(null); document.body.style.pointerEvents = 'auto'; } setIsMemberProfileDialogOpen(o); }}>
        <DialogContent className="sm:max-w-[340px]">
          {selectedProfileMember && (
            <div className="space-y-4">
              <DialogHeader>
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-black text-lg shadow-inner uppercase">{getInitials(selectedProfileMember.name)}</div>
                  <div className="space-y-0.5">
                    <DialogTitle className="text-lg font-black uppercase tracking-tight">{selectedProfileMember.name}</DialogTitle>
                    <Badge variant="outline" className="text-[8px] font-black uppercase tracking-widest border-primary/20 text-primary/70">{selectedProfileMember.paymentType || currentRound?.collectionType}</Badge>
                  </div>
                </div>
              </DialogHeader>
              <div className="grid gap-3 py-2">
                <div className="flex justify-between items-center p-2.5 bg-muted/30 rounded-xl"><span className="text-[10px] font-bold uppercase text-muted-foreground">Phone</span><span className="font-bold text-xs tabular-nums">{selectedProfileMember.phone}</span></div>
                <div className="flex justify-between items-center p-2.5 bg-muted/30 rounded-xl"><span className="text-[10px] font-bold uppercase text-muted-foreground">Joined</span><span className="font-bold text-xs">{selectedProfileMember.joinDate ? format(parseISO(selectedProfileMember.joinDate), 'dd MMM yyyy') : '-'}</span></div>
                <div className="flex justify-between items-center p-2.5 bg-emerald-50 rounded-xl border border-emerald-100"><span className="text-[10px] font-bold uppercase text-emerald-600">Cycle Paid</span><span className="font-black text-emerald-700 tabular-nums text-sm">₹{(totalPaidByMember.get(selectedProfileMember.id) || 0).toLocaleString()}</span></div>
              </div>
              <DialogFooter><Button onClick={() => setIsMemberProfileDialogOpen(false)} className="w-full font-bold h-10 rounded-xl uppercase tracking-widest text-[9px]">Close Profile</Button></DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Pending Details Dialog */}
      <Dialog open={isPendingDetailsOpen} onOpenChange={(o) => { if(!o) { setSelectedPendingMember(null); document.body.style.pointerEvents = 'auto'; } setIsPendingDetailsOpen(o); }}>
        <DialogContent className="sm:max-w-[340px]">
          {selectedPendingMember && (
            <div className="space-y-4">
              <DialogHeader><DialogTitle className="flex items-center gap-2 text-base"><Clock className="size-4 text-destructive" /> Arrears Breakdown</DialogTitle><DialogDescription className="text-[9px] font-bold uppercase tracking-widest">{selectedPendingMember.name}</DialogDescription></DialogHeader>
              
              <div className="p-6 bg-destructive/5 rounded-2xl border border-dashed border-destructive/20 text-center space-y-3">
                <div className="space-y-0.5"><p className="text-[9px] font-black uppercase tracking-[0.2em] text-destructive/60">Estimated Debt</p><div className="text-4xl font-black text-destructive tabular-nums tracking-tighter">₹{(selectedPendingMember.calculatedPendingAmount || 0).toLocaleString()}</div></div>
                <Badge className="bg-destructive text-destructive-foreground px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest shadow-md">⏳ {selectedPendingMember.calculatedPendingDays || 0} Missed Days</Badge>
              </div>

              <div className="space-y-2">
                <h4 className="text-[9px] font-black uppercase tracking-[0.1em] text-muted-foreground ml-1">Recorded Arrears Log</h4>
                <ScrollArea className="h-[150px] rounded-xl border border-border/50 bg-muted/5 p-2">
                  <div className="space-y-1.5">
                    {missedDatesForSelectedMember.length > 0 ? (
                      missedDatesForSelectedMember.map((dateStr, idx) => (
                        <div key={idx} className="flex items-center justify-between px-3 py-2 bg-white rounded-lg border shadow-sm group hover:border-destructive/30 transition-all">
                          <div className="flex items-center gap-2">
                            <CalendarDays className="size-3 text-muted-foreground/40 group-hover:text-destructive/40 transition-colors" />
                            <span className="text-[11px] font-bold tabular-nums text-foreground/80">{dateStr}</span>
                          </div>
                          <Badge variant="outline" className="text-[7px] font-black uppercase tracking-tighter border-destructive/20 text-destructive bg-destructive/5 h-4">Missed</Badge>
                        </div>
                      ))
                    ) : (
                      <div className="h-24 flex flex-col items-center justify-center space-y-1.5">
                        <AlertCircle className="size-5 text-muted-foreground/20" />
                        <p className="text-[9px] font-bold uppercase text-muted-foreground/40 tracking-widest italic">All contributions captured</p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </div>

              <DialogFooter><Button onClick={() => setIsPendingDetailsOpen(false)} className="w-full font-black uppercase tracking-[0.1em] h-10 rounded-xl active:scale-95 transition-all shadow-md">Close Audit</Button></DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* History Dialog */}
      <Dialog open={isHistoryDialogOpen} onOpenChange={(o) => { if(!o) { setHistoryMember(null); document.body.style.pointerEvents = 'auto'; } setIsHistoryDialogOpen(o); }}>
        <DialogContent className="sm:max-w-[450px]">
          {historyMember && (
            <div className="space-y-4">
              <DialogHeader><DialogTitle className="flex items-center gap-2 text-base"><History className="size-4 text-primary" /> Payment History</DialogTitle><DialogDescription className="text-[10px] font-medium uppercase tracking-widest">{historyMember.name}</DialogDescription></DialogHeader>
              <div className="max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                <Table>
                  <TableHeader className="bg-muted/30 sticky top-0"><TableRow><TableHead className="text-[9px] font-black uppercase tracking-widest h-8">Date</TableHead><TableHead className="text-[9px] font-black uppercase tracking-widest h-8">Amount</TableHead><TableHead className="text-[9px] font-black uppercase tracking-widest h-8 text-right">Method</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {allPayments.filter(p => p.memberId === historyMember.id && (p.status === 'success' || p.status === 'paid')).length > 0 ? (
                      allPayments.filter(p => p.memberId === historyMember.id && (p.status === 'success' || p.status === 'paid')).map((p, i) => (
                        <TableRow key={i} className="hover:bg-muted/5 transition-colors"><TableCell className="text-[11px] font-bold tabular-nums py-2.5">{getRecordDate(p)}</TableCell><TableCell className="text-[11px] font-black text-emerald-600 tabular-nums py-2.5">₹{getPaymentAmount(p).toLocaleString()}</TableCell><TableCell className="text-[9px] font-bold text-muted-foreground text-right uppercase tracking-widest">{p.method || 'Cash'}</TableCell></TableRow>
                      ))
                    ) : <TableRow><TableCell colSpan={3} className="h-24 text-center text-[9px] font-bold uppercase text-muted-foreground/40 italic">No contributions recorded</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </div>
              <DialogFooter><Button onClick={() => setIsHistoryDialogOpen(false)} className="w-full font-bold h-10 rounded-xl">Close Registry</Button></DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isAddMemberDialogOpen} onOpenChange={(o) => { if(!o) document.body.style.pointerEvents = 'auto'; setIsAddMemberDialogOpen(o); }}>
        <DialogContent className="sm:max-w-[380px]">
          <form onSubmit={handleAddMemberToScheme}>
            <DialogHeader><DialogTitle className="text-lg">Register Member</DialogTitle><DialogDescription className="text-[11px]">Adding to scheme: <span className="font-bold text-primary">{currentRound?.name}</span></DialogDescription></DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-1.5"><Label className="text-[10px] font-bold uppercase text-muted-foreground">Full Name</Label><Input value={newMember.name} onChange={e => setNewMember({...newMember, name: e.target.value})} required className="h-10 rounded-xl text-sm" placeholder="Member name" /></div>
              <div className="grid gap-1.5"><Label className="text-[10px] font-bold uppercase text-muted-foreground">Phone Number</Label><Input value={newMember.phone} onChange={e => setNewMember({...newMember, phone: e.target.value})} required className="h-10 rounded-xl text-sm" placeholder="Contact number" /></div>
              <div className="grid gap-1.5"><Label className="text-[10px] font-bold uppercase text-muted-foreground">Join Date</Label><Input type="date" value={newMember.joinDate} onChange={e => setNewMember({...newMember, joinDate: e.target.value})} required className="h-10 rounded-xl text-sm" /></div>
              <div className="grid gap-1.5"><Label className="text-[10px] font-bold uppercase text-muted-foreground">Payment Mode</Label><Select value={newMember.paymentType} onValueChange={v => setNewMember({...newMember, paymentType: v})}><SelectTrigger className="h-10 rounded-xl text-sm"><SelectValue placeholder="Inherit from scheme" /></SelectTrigger><SelectContent><SelectItem value="Daily">Daily</SelectItem><SelectItem value="Monthly">Monthly</SelectItem></SelectContent></Select></div>
            </div>
            <DialogFooter><Button type="submit" disabled={isActionPending} className="w-full h-10 font-bold text-sm">Complete Registration</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isDailyAuditOpen} onOpenChange={(o) => { if(!o) document.body.style.pointerEvents = 'auto'; setIsDailyAuditOpen(o); }}>
        <DialogContent className="sm:max-w-[340px]">
          {currentRound && (
            <>
              <DialogHeader><DialogTitle className="flex items-center gap-2 text-base"><Wallet className="size-4 text-primary" />Audit Ledger</DialogTitle></DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-1"><Label className="text-[10px] font-black uppercase text-muted-foreground">Select Audit Date</Label><div className="relative"><CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" /><Input type="date" value={auditDate} onChange={e => setAuditDate(e.target.value)} className="pl-9 h-10 font-bold text-xs" /></div></div>
                <div className="flex flex-col items-center justify-center p-6 bg-emerald-50 rounded-2xl border border-dashed border-emerald-200 text-center"><p className="text-[9px] font-black uppercase tracking-[0.2em] text-emerald-600/60 mb-2">Audit Total Intake</p><div className="text-4xl font-black text-emerald-600 tabular-nums tracking-tighter">₹{getGroupCollectionForDate(currentRound.name, auditDate).toLocaleString()}</div></div>
              </div>
              <DialogFooter><Button onClick={() => setIsDailyAuditOpen(false)} className="w-full font-bold h-10 rounded-xl">Close Audit</Button></DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isQuickPaymentDialogOpen} onOpenChange={(o) => { if(!o) { setSelectedMemberForPayment(null); document.body.style.pointerEvents = 'auto'; } setIsQuickPaymentDialogOpen(o); }}>
        <DialogContent className="sm:max-w-[380px]">
          {selectedMemberForPayment && (
            <form onSubmit={handleQuickPayment}>
              <DialogHeader><DialogTitle className="text-lg">Record Payment</DialogTitle><DialogDescription className="text-[11px]">Processing entry for <span className="font-bold text-primary">{selectedMemberForPayment.name}</span>.</DialogDescription></DialogHeader>
              <div className="grid gap-4 py-2">
                <div className="grid gap-1"><Label className="text-[10px] font-bold uppercase text-muted-foreground">Payment Amount (₹)</Label><Input type="number" value={paymentData.amount} onChange={e => setPaymentData({...paymentData, amount: Number(e.target.value)})} required className="h-11 text-base font-black text-primary rounded-xl" /></div>
                <div className="grid gap-1"><Label className="text-[10px] font-bold uppercase text-muted-foreground">Target Date</Label><Input type="date" value={paymentData.date} onChange={e => setPaymentData({...paymentData, date: e.target.value})} required className="h-10 rounded-xl text-sm" /></div>
                <div className="grid gap-1"><Label className="text-[10px] font-bold uppercase text-muted-foreground">Method</Label><Select value={paymentData.method} onValueChange={(v) => setPaymentData({...paymentData, method: v})}><SelectTrigger className="h-10 rounded-xl text-sm"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Cash">Cash</SelectItem><SelectItem value="UPI">UPI</SelectItem></SelectContent></Select></div>
              </div>
              <DialogFooter><Button type="submit" disabled={isActionPending} className="w-full h-11 font-black uppercase tracking-[0.1em] bg-emerald-600 hover:bg-emerald-700 shadow-sm active:scale-[0.98] transition-all text-xs">{isActionPending ? <Loader2 className="size-3 mr-2 animate-spin" /> : <CheckCircle2 className="size-3 mr-2" />}Confirm Entry</Button></DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
