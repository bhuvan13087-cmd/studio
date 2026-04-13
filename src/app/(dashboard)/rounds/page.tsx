"use client"

import { useState, useEffect, useMemo } from "react"
import { History, Plus, Users, ChevronLeft, Loader2, IndianRupee, UserPlus, Info, Clock, AlertCircle, CheckCircle2, LayoutDashboard, Search, RefreshCcw, TrendingUp, MoreVertical, Pencil, Trash2, User, Calendar, Wallet, CalendarDays, Edit3, Printer, X, Save, Phone } from "lucide-react"
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

const handlePopupBlur = (e: any) => {
  const ae = document.activeElement;
  if (ae instanceof HTMLInputElement || ae instanceof HTMLTextAreaElement || ae instanceof HTMLSelectElement) {
    ae.blur();
    e.preventDefault();
  }
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
      <DialogContent 
        className="sm:max-w-[320px]" 
        onOpenAutoFocus={(e) => e.preventDefault()}
        onInteractOutside={handlePopupBlur}
        onEscapeKeyDown={handlePopupBlur}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-headline uppercase tracking-tight"><CalendarDays className="size-4 text-primary" />{isLatestActive ? 'Update Period' : 'Start New Cycle'}</DialogTitle>
          <DialogDescription className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Timeline will auto-adjust boundaries.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Start</Label><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-10 text-xs rounded-xl font-bold border-muted/60" disabled={isSaving} /></div>
            <div className="space-y-1"><Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">End</Label><Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-10 text-xs rounded-xl font-bold border-muted/60" disabled={isSaving} /></div>
          </div>
        </div>
        <DialogFooter><Button onClick={handleSave} disabled={isSaving} className="w-full font-black uppercase tracking-[0.1em] h-11 rounded-xl active:scale-95 transition-all shadow-md">{isSaving ? <Loader2 className="size-3 mr-2 animate-spin" /> : <Save className="size-3 mr-2" />}{isLatestActive ? 'Apply' : 'Launch'}</Button></DialogFooter>
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
  const [isEditingMember, setIsEditingMember] = useState(false)
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
    if (!db || !selectedProfileMember || isActionPending) return;
    setIsActionPending(true);
    try {
      await updateDoc(doc(db, 'members', selectedProfileMember.id), { 
        name: selectedProfileMember.name, 
        phone: selectedProfileMember.phone, 
        joinDate: selectedProfileMember.joinDate, 
        paymentType: selectedProfileMember.paymentType 
      });
      await createAuditLog(db, user, `Updated member profile: ${selectedProfileMember.name}`);
      setIsEditingMember(false);
      toast({ title: "Profile Updated", description: "Details saved successfully." });
    } catch (e: any) { 
      toast({ variant: "destructive", title: "Error", description: e.message || "Failed to update profile." }); 
    } finally { 
      setIsActionPending(false); 
    }
  }

  if (isRoleLoading || isRoundsLoading) return (<div className="flex h-[60vh] items-center justify-center"><Loader2 className="size-8 animate-spin text-primary" /></div>)

  if (!selectedChitId) {
    return (
      <div className="space-y-8 animate-in fade-in duration-500 pb-10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5"><h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-primary font-headline uppercase">Seat Reservations</h2><p className="text-sm text-muted-foreground font-medium">Manage schemes and isolated audit periods.</p></div>
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
          <DialogContent 
            className="sm:max-w-[320px]"
            onOpenAutoFocus={(e) => e.preventDefault()}
            onInteractOutside={handlePopupBlur}
            onEscapeKeyDown={handlePopupBlur}
          >
            {activePopupGroupName && (
              <>
                <DialogHeader><DialogTitle className="flex items-center gap-2 text-base font-headline uppercase tracking-tight"><Wallet className="size-4 text-primary" />Reconciliation</DialogTitle><DialogDescription className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">{getDisplayName(activePopupGroupName)} Summary</DialogDescription></DialogHeader>
                <div className="space-y-4 py-2">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1"><Label className="text-[9px] font-black uppercase text-muted-foreground">Year</Label><Select value={viewYear} onValueChange={setViewYear}><SelectTrigger className="h-9 text-xs font-bold rounded-xl"><SelectValue /></SelectTrigger><SelectContent>{YEARS.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent></Select></div>
                    <div className="space-y-1"><Label className="text-[9px] font-black uppercase text-muted-foreground">Cycle</Label><Select value={selectedReconciliationCycleId || ""} onValueChange={setSelectedReconciliationCycleId}><SelectTrigger className="h-9 text-xs font-bold rounded-xl"><SelectValue placeholder="Select" /></SelectTrigger><SelectContent>{reconciliationCycles.length > 0 ? reconciliationCycles.map(c => <SelectItem key={c.id} value={c.id} className="text-xs">{c.startDate}</SelectItem>) : <div className="p-4 text-center text-[9px] font-bold uppercase text-muted-foreground italic">Empty</div>}</SelectContent></Select></div>
                  </div>
                  <div className="flex flex-col items-center justify-center p-5 bg-emerald-50 rounded-2xl border border-dashed border-emerald-200 text-center"><p className="text-[9px] font-black uppercase tracking-[0.2em] text-emerald-600/60 mb-1.5">Verified Total</p><div className="text-3xl font-black text-emerald-600 tabular-nums tracking-tighter">₹{reconciliationTotal.toLocaleString()}</div></div>
                </div>
                <DialogFooter><Button onClick={() => setIsCollectionPopupOpen(false)} className="w-full font-bold h-10 rounded-xl text-xs uppercase tracking-widest">Close Audit</Button></DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={isAddChitDialogOpen} onOpenChange={(o) => { if(!o) document.body.style.pointerEvents = 'auto'; setIsAddChitDialogOpen(o); }}>
          <DialogContent 
            className="sm:max-w-[340px]"
            onOpenAutoFocus={(e) => e.preventDefault()}
            onInteractOutside={handlePopupBlur}
            onEscapeKeyDown={handlePopupBlur}
          >
            <form onSubmit={handleAddChit}>
              <DialogHeader><DialogTitle className="text-lg font-headline uppercase tracking-tight">New Scheme</DialogTitle></DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-1.5"><Label className="text-[9px] font-black uppercase text-muted-foreground">Scheme Name</Label><Input value={newChit.name} onChange={e => setNewChit({...newChit, name: e.target.value})} required className="h-10 rounded-xl text-sm font-bold" placeholder="e.g. Group A" /></div>
                <div className="grid gap-1.5"><Label className="text-[9px] font-black uppercase text-muted-foreground">Amount (₹)</Label><Input type="number" value={newChit.monthlyAmount || ""} onChange={e => setNewChit({...newChit, monthlyAmount: Number(e.target.value)})} required className="h-10 rounded-xl text-sm font-bold" /></div>
                <div className="grid gap-1.5"><Label className="text-[9px] font-black uppercase text-muted-foreground">Max Members</Label><Input type="number" value={newChit.totalMembers || ""} onChange={e => setNewChit({...newChit, totalMembers: Number(e.target.value)})} required className="h-10 rounded-xl text-sm font-bold" /></div>
                <div className="grid gap-1.5"><Label className="text-[9px] font-black uppercase text-muted-foreground">Collection Type</Label><Select value={newChit.collectionType} onValueChange={(v) => setNewChit({...newChit, collectionType: v})}><SelectTrigger className="h-10 rounded-xl font-bold"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Daily">Daily</SelectItem><SelectItem value="Monthly">Monthly</SelectItem></SelectContent></Select></div>
              </div>
              <DialogFooter><Button type="submit" disabled={isActionPending} className="w-full h-11 font-black uppercase tracking-[0.1em] shadow-md active:scale-[0.98] transition-all">{isActionPending ? <Loader2 className="mr-2 size-3 animate-spin" /> : null}Create Scheme</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={isEditChitDialogOpen} onOpenChange={(o) => { if(!o) { setChitToEdit(null); document.body.style.pointerEvents = 'auto'; } setIsEditChitDialogOpen(o); }}>
          <DialogContent 
            className="sm:max-w-[340px]"
            onOpenAutoFocus={(e) => e.preventDefault()}
            onInteractOutside={handlePopupBlur}
            onEscapeKeyDown={handlePopupBlur}
          >
            {chitToEdit && (
              <form onSubmit={handleUpdateChit}>
                <DialogHeader><DialogTitle className="text-lg font-headline uppercase tracking-tight">Edit Scheme</DialogTitle></DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-1.5"><Label className="text-[9px] font-black uppercase text-muted-foreground">Scheme Name</Label><Input value={chitToEdit.name} onChange={e => setChitToEdit({...chitToEdit, name: e.target.value})} required className="h-10 rounded-xl text-sm font-bold" /></div>
                  <div className="grid gap-1.5"><Label className="text-[9px] font-black uppercase text-muted-foreground">Amount (₹)</Label><Input type="number" value={chitToEdit.monthlyAmount || ""} onChange={e => setChitToEdit({...chitToEdit, monthlyAmount: Number(e.target.value)})} required className="h-10 rounded-xl text-sm font-bold" /></div>
                  <div className="grid gap-1.5"><Label className="text-[9px] font-black uppercase text-muted-foreground">Max Members</Label><Input type="number" value={chitToEdit.totalMembers || ""} onChange={e => setChitToEdit({...chitToEdit, totalMembers: Number(e.target.value)})} required className="h-10 rounded-xl text-sm font-bold" /></div>
                  <div className="grid gap-1.5"><Label className="text-[9px] font-black uppercase text-muted-foreground">Collection Type</Label><Select value={chitToEdit.collectionType} onValueChange={(v) => setChitToEdit({...chitToEdit, collectionType: v})}><SelectTrigger className="h-10 rounded-xl font-bold"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Daily">Daily</SelectItem><SelectItem value="Monthly">Monthly</SelectItem></SelectContent></Select></div>
                </div>
                <DialogFooter><Button type="submit" disabled={isActionPending} className="w-full h-11 font-black uppercase tracking-[0.1em] shadow-md">{isActionPending ? <Loader2 className="mr-2 size-3 animate-spin" /> : null}Save Changes</Button></DialogFooter>
              </form>
            )}
          </DialogContent>
        </Dialog>

        <AlertDialog open={isDeleteChitDialogOpen} onOpenChange={(o) => { if(!o) { setChitToDelete(null); document.body.style.pointerEvents = 'auto'; } setIsDeleteChitDialogOpen(o); }}>
          <AlertDialogContent className="sm:max-w-[340px]">
            <AlertDialogHeader><AlertDialogTitle className="text-destructive text-lg font-headline uppercase">Delete Scheme?</AlertDialogTitle><AlertDialogDescription className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">This will remove <strong>{chitToDelete?.name}</strong> and all associated data.</AlertDialogDescription></AlertDialogHeader>
            <AlertDialogFooter className="flex-col gap-2"><AlertDialogAction onClick={handleDeleteChit} disabled={isActionPending} className="bg-destructive hover:bg-destructive/90 h-11 font-black uppercase tracking-widest w-full">{isActionPending ? <Loader2 className="mr-2 size-3 animate-spin" /> : null}Delete</AlertDialogAction><AlertDialogCancel onClick={() => setIsDeleteChitDialogOpen(false)} className="h-10 font-bold uppercase text-[10px] w-full border-muted/60">Cancel</AlertDialogCancel></AlertDialogFooter>
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
            <TableHeader className="bg-muted/10"><TableRow className="border-b"><TableHead className="text-[10px] uppercase font-black tracking-[0.2em] h-12 pl-6">Member Participant</TableHead><TableHead className="text-[10px] uppercase font-black tracking-[0.2em] h-12">Pending Count</TableHead><TableHead className="text-[10px] uppercase font-black tracking-[0.2em] h-12">Status Indicator</TableHead><TableHead className="w-[120px] pr-6"></TableHead></TableRow></TableHeader>
            <TableBody>
              {assignedMembers.length > 0 ? assignedMembers.map((m) => (
                <TableRow key={m.id} className="hover:bg-muted/5 transition-colors group">
                  <TableCell className="pl-6 py-4"><div className="flex items-center gap-4 cursor-pointer" onClick={() => { setSelectedProfileMember(m); setIsEditingMember(false); setIsMemberProfileDialogOpen(true); }}><div className="h-10 w-10 rounded-xl bg-secondary text-primary flex items-center justify-center font-black text-xs uppercase">{getInitials(m.name)}</div><div className="flex flex-col min-w-0"><span className="text-sm font-bold truncate tracking-tight">{m.name}</span><span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{m.paymentType || currentRound?.collectionType}</span></div></div></TableCell>
                  <TableCell><button onClick={() => { setSelectedPendingMember(m); setIsPendingDetailsOpen(true); }} className={cn("px-4 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest tabular-nums", m.calculatedPendingDays > 0 ? "text-destructive font-bold" : "text-muted-foreground/40")}>{m.calculatedPendingDays} Days</button></TableCell>
                  <TableCell><Badge variant={m.memberStatus === 'paid' ? 'default' : 'secondary'} className={cn("text-[9px] font-black uppercase tracking-widest px-3 py-1 border-none shadow-sm", m.memberStatus === 'paid' ? "bg-emerald-500" : (m.memberStatus === 'waiting' ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"))}>{m.memberStatus.toUpperCase()}</Badge></TableCell>
                  <TableCell className="text-right pr-6"><div className="flex items-center justify-end gap-1.5"><Button variant="ghost" size="icon" className={cn("h-9 w-9 rounded-xl transition-all", m.memberStatus === 'paid' ? "text-emerald-500 bg-emerald-50" : "text-emerald-600 hover:bg-emerald-50 active:scale-90")} disabled={m.memberStatus === 'paid' || isActionPending || !currentActiveCycle} onClick={() => { setSelectedMemberForPayment(m); setPaymentData({ ...INITIAL_PAYMENT_STATE, amount: m.monthlyAmount || currentRound?.monthlyAmount || 800, date: format(new Date(), 'yyyy-MM-dd') }); setIsQuickPaymentDialogOpen(true); }}><IndianRupee className="size-4.5" /></Button><Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:bg-muted/50 rounded-xl" onClick={() => { setHistoryMember(m); setIsHistoryDialogOpen(true); }}><History className="size-4.5" /></Button></div></TableCell>
                </TableRow>
              )) : <TableRow><TableCell colSpan={4} className="h-48 text-center text-[11px] uppercase tracking-[0.2em] text-muted-foreground/60 font-bold italic">No participant records located</TableCell></TableRow>}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Member Profile Dialog (Merged View/Edit) */}
      <Dialog open={isMemberProfileDialogOpen} onOpenChange={(o) => { if(!o) { setSelectedProfileMember(null); setIsEditingMember(false); document.body.style.pointerEvents = 'auto'; } setIsMemberProfileDialogOpen(o); }}>
        <DialogContent 
          className="sm:max-w-[310px] p-0 overflow-hidden border-none shadow-2xl rounded-3xl"
          onOpenAutoFocus={(e) => e.preventDefault()}
          onInteractOutside={handlePopupBlur}
          onEscapeKeyDown={handlePopupBlur}
        >
          {selectedProfileMember && (
            <div className="flex flex-col">
              {isEditingMember ? (
                /* EDIT VIEW */
                <form onSubmit={handleUpdateMemberProfile} className="flex flex-col">
                  <div className="bg-primary p-4 text-white text-center border-b border-white/10">
                    <DialogHeader>
                      <div className="mx-auto mb-2 h-10 w-10 rounded-2xl bg-white/10 text-white flex items-center justify-center shadow-inner">
                        <Edit3 className="size-4" />
                      </div>
                      <DialogTitle className="text-base font-black uppercase tracking-tight text-white">Edit Registry</DialogTitle>
                      <DialogDescription className="text-[8px] font-bold uppercase tracking-widest text-white/60">Member Details</DialogDescription>
                    </DialogHeader>
                  </div>
                  
                  <div className="p-4 space-y-3 bg-white">
                    <div className="grid gap-3 py-1">
                      <div className="grid gap-1">
                        <Label className="text-[8px] font-black uppercase text-muted-foreground/70 ml-1">Full Name</Label>
                        <Input 
                          value={selectedProfileMember.name} 
                          onChange={e => setSelectedProfileMember({...selectedProfileMember, name: e.target.value})} 
                          required 
                          className="h-9 rounded-xl text-xs font-bold border-muted/60 focus:ring-primary/20"
                        />
                      </div>
                      <div className="grid gap-1">
                        <Label className="text-[8px] font-black uppercase text-muted-foreground/70 ml-1">Phone Number</Label>
                        <Input 
                          value={selectedProfileMember.phone} 
                          onChange={e => setSelectedProfileMember({...selectedProfileMember, phone: e.target.value})} 
                          required 
                          className="h-9 rounded-xl text-xs font-bold tabular-nums border-muted/60 focus:ring-primary/20"
                        />
                      </div>
                      <div className="grid gap-1">
                        <Label className="text-[8px] font-black uppercase text-muted-foreground/70 ml-1">Join Date</Label>
                        <Input 
                          type="date" 
                          value={selectedProfileMember.joinDate} 
                          onChange={e => setSelectedProfileMember({...selectedProfileMember, joinDate: e.target.value})} 
                          required 
                          className="h-9 rounded-xl text-xs font-bold border-muted/60 focus:ring-primary/20"
                        />
                      </div>
                      <div className="grid gap-1">
                        <Label className="text-[8px] font-black uppercase text-muted-foreground/70 ml-1">Mode</Label>
                        <Select 
                          value={selectedProfileMember.paymentType || currentRound?.collectionType} 
                          onValueChange={v => setSelectedProfileMember({...selectedProfileMember, paymentType: v})}
                        >
                          <SelectTrigger className="h-9 rounded-xl text-xs font-bold border-muted/60 focus:ring-primary/20">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Daily">Daily</SelectItem>
                            <SelectItem value="Monthly">Monthly</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  <div className="p-3 bg-muted/5 border-t border-border/40 flex flex-col gap-1.5">
                    <Button 
                      type="submit" 
                      disabled={isActionPending} 
                      className="w-full h-10 font-black uppercase tracking-[0.2em] shadow-lg active:scale-95 transition-all text-[9px]"
                    >
                      {isActionPending ? <Loader2 className="size-3 mr-2 animate-spin" /> : <Save className="size-3 mr-2" />}
                      Save Profile
                    </Button>
                    <Button 
                      type="button" 
                      variant="ghost" 
                      onClick={() => setIsEditingMember(false)} 
                      className="w-full h-8 font-bold uppercase tracking-widest text-[8px] text-muted-foreground"
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              ) : (
                /* VIEW MODE */
                <>
                  <div className="bg-primary/5 p-4 pb-5 text-center relative border-b border-border/40">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="absolute left-3 top-3 h-7 w-7 rounded-full hover:bg-white/80 text-primary transition-all shadow-sm border border-border/20"
                      onClick={() => setIsEditingMember(true)}
                    >
                      <Edit3 className="size-3.5" />
                    </Button>
                    
                    <div className="mx-auto mb-2 h-14 w-14 rounded-2xl bg-white text-primary flex items-center justify-center font-black text-lg shadow-lg border-2 border-primary/10 uppercase ring-4 ring-primary/5">
                      {getInitials(selectedProfileMember.name)}
                    </div>
                    
                    <div className="space-y-0.5">
                      <DialogTitle className="text-base font-black uppercase tracking-tight text-primary truncate px-2 text-center">
                        {selectedProfileMember.name}
                      </DialogTitle>
                      <div className="flex items-center justify-center">
                        <Badge className="text-[8px] font-black uppercase tracking-widest bg-primary text-white border-none px-2.5 h-4">
                          {selectedProfileMember.paymentType || currentRound?.collectionType}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 space-y-3 bg-white">
                    <div className="grid gap-2">
                      <div className="flex items-center gap-3 group">
                        <div className="h-7 w-7 rounded-lg bg-muted/50 flex items-center justify-center text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                          <Phone className="size-3" />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[8px] font-black uppercase tracking-widest text-muted-foreground/60 leading-none mb-0.5">Phone Contact</span>
                          <span className="font-bold text-[11px] tabular-nums text-foreground">{selectedProfileMember.phone}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 group">
                        <div className="h-7 w-7 rounded-lg bg-muted/50 flex items-center justify-center text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                          <CalendarDays className="size-3" />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[8px] font-black uppercase tracking-widest text-muted-foreground/60 leading-none mb-0.5">Joining Date</span>
                          <span className="font-bold text-[11px] text-foreground">
                            {selectedProfileMember.joinDate ? format(parseISO(selectedProfileMember.joinDate), 'dd MMM yyyy') : 'N/A'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-1">
                      <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-between shadow-inner relative overflow-hidden group">
                        <div className="absolute -right-3 -bottom-3 opacity-5 group-hover:scale-110 transition-transform duration-500">
                          <IndianRupee className="size-14 text-emerald-900" />
                        </div>
                        <div className="relative z-10 space-y-0">
                          <span className="text-[8px] font-black uppercase tracking-widest text-emerald-600/80">Cycle Paid</span>
                          <p className="text-lg font-black text-emerald-700 tabular-nums tracking-tighter">
                            ₹{(totalPaidByMember.get(selectedProfileMember.id) || 0).toLocaleString()}
                          </p>
                        </div>
                        <div className="h-8 w-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-md relative z-10">
                          <Wallet className="size-3.5" />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-3 bg-muted/5 border-t border-border/40">
                    <Button 
                      onClick={() => setIsMemberProfileDialogOpen(false)} 
                      className="w-full font-black uppercase tracking-[0.2em] h-10 rounded-xl text-[9px] shadow-sm active:scale-[0.98]"
                    >
                      Close Profile
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Arrears Detail popup */}
      <Dialog open={isPendingDetailsOpen} onOpenChange={(o) => { if(!o) { setSelectedPendingMember(null); document.body.style.pointerEvents = 'auto'; } setIsPendingDetailsOpen(o); }}>
        <DialogContent 
          className="sm:max-w-[310px] p-0 overflow-hidden border-none shadow-2xl rounded-3xl"
          onOpenAutoFocus={(e) => e.preventDefault()}
          onInteractOutside={handlePopupBlur}
          onEscapeKeyDown={handlePopupBlur}
        >
          {selectedPendingMember && (
            <div className="flex flex-col">
              <div className="bg-destructive/5 p-4 text-center relative border-b border-destructive/10">
                <div className="mx-auto mb-2 h-12 w-12 rounded-2xl bg-white text-destructive flex items-center justify-center shadow-lg border-2 border-destructive/10 ring-4 ring-destructive/5">
                  <AlertCircle className="size-6" />
                </div>
                
                <div className="space-y-0.5">
                  <DialogTitle className="text-lg font-black uppercase tracking-tight text-destructive leading-tight">
                    Pending Details
                  </DialogTitle>
                  <DialogDescription className="text-[8px] font-bold uppercase tracking-widest text-destructive/60 truncate px-4">
                    {selectedPendingMember.name} • Joined {selectedPendingMember.joinDate ? format(parseISO(selectedPendingMember.joinDate), 'dd MMM yyyy') : 'N/A'}
                  </DialogDescription>
                </div>
              </div>

              <div className="p-4 space-y-4 bg-white">
                <div className="p-3 rounded-2xl bg-destructive/5 border border-destructive/10 flex items-center justify-between shadow-inner relative overflow-hidden group">
                  <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:scale-110 transition-transform duration-500">
                    <IndianRupee className="size-16 text-destructive-foreground fill-destructive" />
                  </div>
                  <div className="relative z-10">
                    <span className="text-[8px] font-black uppercase tracking-widest text-destructive/70">Estimated Debt</span>
                    <p className="text-2xl font-black text-destructive tabular-nums tracking-tighter">
                      ₹{(selectedPendingMember.calculatedPendingAmount || 0).toLocaleString()}
                    </p>
                  </div>
                  <div className="h-9 w-9 rounded-xl bg-destructive text-white flex items-center justify-center shadow-md relative z-10">
                    <Wallet className="size-4" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between px-1">
                    <h4 className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/80">Missed Dates Ledger</h4>
                    <Badge variant="outline" className="text-[8px] font-black uppercase tracking-tighter border-destructive/20 text-destructive bg-destructive/5 px-1.5 h-4">
                      {selectedPendingMember.calculatedPendingDays || 0} Missed
                    </Badge>
                  </div>
                  
                  <ScrollArea className="h-[120px] rounded-xl border border-border/50 bg-muted/5 p-1.5">
                    <div className="grid gap-1">
                      {missedDatesForSelectedMember.length > 0 ? (
                        missedDatesForSelectedMember.map((dateStr, idx) => (
                          <div key={idx} className="flex items-center gap-3 px-3 py-2 bg-white rounded-lg border border-border/40 shadow-sm">
                            <CalendarDays className="size-3.5 text-destructive/40" />
                            <span className="text-[11px] font-bold tabular-nums text-foreground/80">{dateStr}</span>
                          </div>
                        ))
                      ) : (
                        <div className="h-24 flex flex-col items-center justify-center space-y-1.5">
                          <CheckCircle2 className="size-6 text-emerald-500" />
                          <p className="text-[8px] font-bold uppercase text-muted-foreground tracking-[0.2em]">Registry Clear</p>
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </div>
              </div>

              <div className="p-3 bg-muted/5 border-t border-border/40">
                <Button 
                  onClick={() => setIsPendingDetailsOpen(false)} 
                  className="w-full font-black uppercase tracking-[0.2em] h-11 rounded-xl text-[9px] shadow-sm active:scale-[0.98] bg-destructive hover:bg-destructive/90 text-white"
                >
                  Close Audit
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* History Dialog */}
      <Dialog open={isHistoryDialogOpen} onOpenChange={(o) => { if(!o) { setHistoryMember(null); document.body.style.pointerEvents = 'auto'; } setIsHistoryDialogOpen(o); }}>
        <DialogContent 
          className="sm:max-w-[340px]"
          onOpenAutoFocus={(e) => e.preventDefault()}
          onInteractOutside={handlePopupBlur}
          onEscapeKeyDown={handlePopupBlur}
        >
          {historyMember && (
            <div className="space-y-4">
              <DialogHeader><DialogTitle className="flex items-center gap-2 text-base font-headline uppercase tracking-tight"><History className="size-4 text-primary" /> Ledger</DialogTitle><DialogDescription className="text-[9px] font-bold uppercase tracking-widest truncate">{historyMember.name}</DialogDescription></DialogHeader>
              <div className="max-h-[250px] overflow-y-auto pr-1.5 custom-scrollbar">
                <Table>
                  <TableHeader className="bg-muted/30 sticky top-0"><TableRow><TableHead className="text-[8px] font-black uppercase tracking-widest h-7">Date</TableHead><TableHead className="text-[8px] font-black uppercase tracking-widest h-7">Paid</TableHead><TableHead className="text-[8px] font-black uppercase tracking-widest h-7 text-right">Mode</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {allPayments.filter(p => p.memberId === historyMember.id && (p.status === 'success' || p.status === 'paid')).length > 0 ? (
                      allPayments.filter(p => p.memberId === historyMember.id && (p.status === 'success' || p.status === 'paid')).map((p, i) => (
                        <TableRow key={i} className="hover:bg-muted/5 transition-colors border-b last:border-none"><TableCell className="text-[10px] font-bold tabular-nums py-2">{getRecordDate(p)}</TableCell><TableCell className="text-[10px] font-black text-emerald-600 tabular-nums py-2">₹{getPaymentAmount(p).toLocaleString()}</TableCell><TableCell className="text-[8px] font-bold text-muted-foreground text-right uppercase tracking-widest">{p.method || 'Cash'}</TableCell></TableRow>
                      ))
                    ) : <TableRow><TableCell colSpan={3} className="h-20 text-center text-[8px] font-bold uppercase text-muted-foreground/40 italic">Empty</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </div>
              <DialogFooter><Button onClick={() => setIsHistoryDialogOpen(false)} className="w-full font-bold h-10 rounded-xl text-xs uppercase tracking-widest">Close</Button></DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Member Dialog */}
      <Dialog open={isAddMemberDialogOpen} onOpenChange={(o) => { if(!o) document.body.style.pointerEvents = 'auto'; setIsAddMemberDialogOpen(o); }}>
        <DialogContent 
          className="sm:max-w-[340px]"
          onOpenAutoFocus={(e) => e.preventDefault()}
          onInteractOutside={handlePopupBlur}
          onEscapeKeyDown={handlePopupBlur}
        >
          <form onSubmit={handleAddMemberToScheme}>
            <DialogHeader><DialogTitle className="text-lg font-headline uppercase tracking-tight">Register Member</DialogTitle><DialogDescription className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Adding to <span className="text-primary">{currentRound?.name}</span></DialogDescription></DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-1.5"><Label className="text-[9px] font-black uppercase text-muted-foreground">Full Name</Label><Input value={newMember.name} onChange={e => setNewMember({...newMember, name: e.target.value})} required className="h-10 rounded-xl text-sm font-bold border-muted/60" placeholder="Member name" /></div>
              <div className="grid gap-1.5"><Label className="text-[9px] font-black uppercase text-muted-foreground">Phone Number</Label><Input value={newMember.phone} onChange={e => setNewMember({...newMember, phone: e.target.value})} required className="h-10 rounded-xl text-sm font-bold tabular-nums border-muted/60" placeholder="Contact number" /></div>
              <div className="grid gap-1.5"><Label className="text-[9px] font-black uppercase text-muted-foreground">Join Date</Label><Input type="date" value={newMember.joinDate} onChange={e => setNewMember({...newMember, joinDate: e.target.value})} required className="h-10 rounded-xl text-sm font-bold border-muted/60" /></div>
              <div className="grid gap-1.5"><Label className="text-[9px] font-black uppercase text-muted-foreground">Payment Mode</Label><Select value={newMember.paymentType} onValueChange={v => setNewMember({...newMember, paymentType: v})}><SelectTrigger className="h-10 rounded-xl text-sm font-bold border-muted/60"><SelectValue placeholder="Inherit" /></SelectTrigger><SelectContent><SelectItem value="Daily">Daily</SelectItem><SelectItem value="Monthly">Monthly</SelectItem></SelectContent></Select></div>
            </div>
            <DialogFooter><Button type="submit" disabled={isActionPending} className="w-full h-11 font-black uppercase tracking-[0.1em] shadow-md">Complete Registration</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Audit Ledger Dialog */}
      <Dialog open={isDailyAuditOpen} onOpenChange={(o) => { if(!o) document.body.style.pointerEvents = 'auto'; setIsDailyAuditOpen(o); }}>
        <DialogContent 
          className="sm:max-w-[320px]"
          onOpenAutoFocus={(e) => e.preventDefault()}
          onInteractOutside={handlePopupBlur}
          onEscapeKeyDown={handlePopupBlur}
        >
          {currentRound && (
            <>
              <DialogHeader><DialogTitle className="flex items-center gap-2 text-base font-headline uppercase tracking-tight"><Wallet className="size-4 text-primary" />Audit Ledger</DialogTitle></DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-1"><Label className="text-[9px] font-black uppercase text-muted-foreground">Select Date</Label><div className="relative"><CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" /><Input type="date" value={auditDate} onChange={e => setAuditDate(e.target.value)} className="pl-9 h-10 font-bold text-xs rounded-xl border-muted/60" /></div></div>
                <div className="flex flex-col items-center justify-center p-5 bg-emerald-50 rounded-2xl border border-dashed border-emerald-200 text-center"><p className="text-[9px] font-black uppercase tracking-[0.2em] text-emerald-600/60 mb-1.5">Daily Intake</p><div className="text-3xl font-black text-emerald-600 tabular-nums tracking-tighter">₹{getGroupCollectionForDate(currentRound.name, auditDate).toLocaleString()}</div></div>
              </div>
              <DialogFooter><Button onClick={() => setIsDailyAuditOpen(false)} className="w-full font-bold h-10 rounded-xl text-xs uppercase tracking-widest">Close Audit</Button></DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Record Payment Dialog */}
      <Dialog open={isQuickPaymentDialogOpen} onOpenChange={(o) => { if(!o) { setSelectedMemberForPayment(null); document.body.style.pointerEvents = 'auto'; } setIsQuickPaymentDialogOpen(o); }}>
        <DialogContent 
          className="sm:max-w-[340px]"
          onOpenAutoFocus={(e) => e.preventDefault()}
          onInteractOutside={handlePopupBlur}
          onEscapeKeyDown={handlePopupBlur}
        >
          {selectedMemberForPayment && (
            <form onSubmit={handleQuickPayment}>
              <DialogHeader><DialogTitle className="text-lg font-headline uppercase tracking-tight">Record Payment</DialogTitle><DialogDescription className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Entry for <span className="text-primary">{selectedMemberForPayment.name}</span></DialogDescription></DialogHeader>
              <div className="grid gap-4 py-2">
                <div className="grid gap-1"><Label className="text-[9px] font-black uppercase text-muted-foreground">Amount (₹)</Label><Input type="number" value={paymentData.amount} onChange={e => setPaymentData({...paymentData, amount: Number(e.target.value)})} required className="h-11 text-base font-black text-primary rounded-xl border-muted/60" /></div>
                <div className="grid gap-1"><Label className="text-[9px] font-black uppercase text-muted-foreground">Target Date</Label><Input type="date" value={paymentData.date} onChange={e => setPaymentData({...paymentData, date: e.target.value})} required className="h-10 rounded-xl text-sm font-bold border-muted/60" /></div>
                <div className="grid gap-1"><Label className="text-[9px] font-black uppercase text-muted-foreground">Method</Label><Select value={paymentData.method} onValueChange={(v) => setPaymentData({...paymentData, method: v})}><SelectTrigger className="h-10 rounded-xl text-sm font-bold border-muted/60"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Cash">Cash</SelectItem><SelectItem value="UPI">UPI</SelectItem></SelectContent></Select></div>
              </div>
              <DialogFooter><Button type="submit" disabled={isActionPending} className="w-full h-11 font-black uppercase tracking-[0.1em] bg-emerald-600 hover:bg-emerald-700 shadow-sm active:scale-[0.98] transition-all text-xs">{isActionPending ? <Loader2 className="size-3 mr-2 animate-spin" /> : <CheckCircle2 className="size-3 mr-2" />}Confirm Entry</Button></DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
