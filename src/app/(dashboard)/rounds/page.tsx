
"use client"

import { useState, useEffect, useMemo } from "react"
import { History, Plus, Users, ChevronLeft, Loader2, IndianRupee, UserPlus, Info, Clock, AlertCircle, CheckCircle2, LayoutDashboard, Search, RefreshCcw, TrendingUp, MoreVertical, Pencil, Trash2, User, Calendar, Wallet, CalendarDays, Edit3, Printer, X, Save, Phone, Eye } from "lucide-react"
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
import { collection, query, doc, serverTimestamp, orderBy, writeBatch, updateDoc, deleteDoc, addDoc, getDocs, where, setDoc, runTransaction, increment, limit } from "firebase/firestore"
import { useRole } from "@/hooks/use-role"
import { format, parseISO, isSameMonth, eachDayOfInterval, isBefore, isAfter, startOfDay, endOfDay, differenceInDays, addDays, max, isValid, subDays } from "date-fns"
import { cn, withTimeout } from "@/lib/utils"
import { createAuditLog } from "@/firebase/logging"
import {
  getPaymentAmount,
  getPaymentDateStr,
  getCreatedAtDateStr,
  isPaymentSuccess,
  findActiveCycle,
  computeMemberStats,
  computeTotalPaidInActiveCycle,
  handlePopupBlur,
} from "@/lib/chit-engine"

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

  const nextCycleNumber = latestCycle ? (Number(latestCycle.cycleNumber) || 0) + 1 : 1;

  useEffect(() => {
    if (isOpen) {
      if (latestCycle) {
        const prevStart = parseISO(latestCycle.startDate);
        const prevEnd = latestCycle.endDate ? parseISO(latestCycle.endDate) : parseISO(latestCycle.startDate);
        const duration = differenceInDays(prevEnd, prevStart);

        // nextStartDate = latestEndDate + 1 day (Rule 1)
        const nextStart = latestCycle.endDate ? addDays(parseISO(latestCycle.endDate), 1) : new Date();
        // nextEndDate = nextStartDate + groupDuration (Rule 1)
        const nextEnd = addDays(nextStart, duration);

        setStartDate(format(nextStart, 'yyyy-MM-dd'));
        setEndDate(format(nextEnd, 'yyyy-MM-dd'));
      } else {
        const nextStart = new Date();
        const nextEnd = addDays(nextStart, 30);
        setStartDate(format(nextStart, 'yyyy-MM-dd'));
        setEndDate(format(nextEnd, 'yyyy-MM-dd'));
      }
    }
  }, [isOpen, latestCycle]);

  const handleLaunchNewCycle = async () => {
    if (isSaving) return;
    setIsSaving(true);
    document.body.style.pointerEvents = 'none';

    try {
      const cleanGroupName = String(group.name || "").trim().toUpperCase();
      const allowedGroups = ["A GROUP", "B GROUP", "C GROUP", "H GROUP", "D GROUP"];
      if (!allowedGroups.includes(cleanGroupName)) {
        throw new Error(`Group "${group.name}" is not supported for cycle launch.`);
      }

      // 1. Query latest cycle using indexed query (limit 1)
      const latestQuery = query(
        collection(db, 'cycles'),
        where('groupId', '==', group.id),
        orderBy('cycleNumber', 'desc'),
        limit(1)
      );
      const latestSnapshot = await getDocs(latestQuery);
      const preLatestCycle = latestSnapshot.empty ? null : { ...latestSnapshot.docs[0].data() as any, id: latestSnapshot.docs[0].id };

      // 2. Query active cycles using indexed query
      const activeQuery = query(
        collection(db, 'cycles'),
        where('groupId', '==', group.id),
        where('status', '==', 'active')
      );
      const activeSnapshot = await getDocs(activeQuery);
      const preActiveCycles = activeSnapshot.docs.map(doc => ({ ...doc.data() as any, id: doc.id }));

      // 3. Query all cycles of the group to get pre-commit count (used for verification only)
      const preQuery = await getDocs(
        query(collection(db, 'cycles'), where('groupId', '==', group.id))
      );
      const preCommitCount = preQuery.size;

      const highestExistingCycleNumber = preLatestCycle ? (Number(preLatestCycle.cycleNumber) || 0) : 0;
      const nextNumber = highestExistingCycleNumber + 1;

      const newCycleRef = doc(collection(db, 'cycles')); // Auto-generated new document ID

      await runTransaction(db, async (transaction) => {
        // Step A: Lock chitRounds/{groupId} document
        const groupRef = doc(db, 'chitRounds', group.id);
        const groupDoc = await transaction.get(groupRef);
        if (!groupDoc.exists()) {
          throw new Error("Group document does not exist.");
        }
        const groupData = groupDoc.data();

        // Step B: Read latest cycle inside transaction to verify current state
        let txnHighestCycleNumber = 0;
        let txnLatestCycleId = null;
        let txnLatestCycleData = null;

        if (preLatestCycle) {
          const latestCycleRef = doc(db, 'cycles', preLatestCycle.id);
          const latestCycleDoc = await transaction.get(latestCycleRef);
          if (latestCycleDoc.exists()) {
            txnLatestCycleData = latestCycleDoc.data();
            txnHighestCycleNumber = Number(txnLatestCycleData.cycleNumber) || 0;
            txnLatestCycleId = latestCycleDoc.id;
          }
        }

        // Cross-reference with currentCycleId from group doc (in case of concurrent update)
        if (groupData.currentCycleId && groupData.currentCycleId !== txnLatestCycleId) {
          const currentCycleRef = doc(db, 'cycles', groupData.currentCycleId);
          const currentCycleDoc = await transaction.get(currentCycleRef);
          if (currentCycleDoc.exists()) {
            const currentCycleData = currentCycleDoc.data();
            const currentCycleNum = Number(currentCycleData.cycleNumber) || 0;
            if (currentCycleNum > txnHighestCycleNumber) {
              txnHighestCycleNumber = currentCycleNum;
              txnLatestCycleData = currentCycleData;
              txnLatestCycleId = currentCycleDoc.id;
            }
          }
        }

        const txnNextNumber = txnHighestCycleNumber + 1;

        // Step C: Verify exactly one active cycle exists if there is history
        const activeDocs = [];
        for (const preActive of preActiveCycles) {
          const ref = doc(db, 'cycles', preActive.id);
          const docSnap = await transaction.get(ref);
          if (docSnap.exists()) {
            activeDocs.push({ id: docSnap.id, ...docSnap.data() as any });
          }
        }

        // Add latestCycle to activeDocs if it is active and not already included
        if (txnLatestCycleData && txnLatestCycleData.status === 'active' && !activeDocs.some(d => d.id === txnLatestCycleId)) {
          activeDocs.push({ id: txnLatestCycleId, ...txnLatestCycleData });
        }

        // Add group's currentCycleId if it's active and not already included
        if (groupData.currentCycleId && !activeDocs.some(d => d.id === groupData.currentCycleId)) {
          const currentRef = doc(db, 'cycles', groupData.currentCycleId);
          const currentSnap = await transaction.get(currentRef);
          if (currentSnap.exists() && currentSnap.data().status === 'active') {
            activeDocs.push({ id: currentSnap.id, ...currentSnap.data() as any });
          }
        }

        // Deduplicate and filter active cycles
        const uniqueActiveDocs = Array.from(new Map(activeDocs.map(item => [item.id, item])).values())
          .filter(d => d.status === 'active');

        const activeCount = uniqueActiveDocs.length;
        if (txnHighestCycleNumber > 0 && activeCount !== 1) {
          throw new Error(`Invalid active cycle state: expected exactly 1 active cycle, found ${activeCount}.`);
        }
        if (txnHighestCycleNumber === 0 && activeCount !== 0) {
          throw new Error(`Invalid active cycle state: expected 0 active cycles for a new group, found ${activeCount}.`);
        }

        // Step D: Verify duplicate cycle does not already exist
        if (txnHighestCycleNumber >= txnNextNumber) {
          throw new Error(`Duplicate cycle verification failed: Cycle number ${txnNextNumber} is not greater than highest existing cycle number ${txnHighestCycleNumber}.`);
        }
        if (groupData.lastLaunchedCycle && Number(groupData.lastLaunchedCycle) >= txnNextNumber) {
          throw new Error(`Duplicate cycle verification failed: Group metadata lastLaunchedCycle is ${groupData.lastLaunchedCycle}, which is >= next cycle number ${txnNextNumber}.`);
        }

        // Step E: Create new cycle using the auto-generated ID (immutable, never reuse or overwrite)
        transaction.set(newCycleRef, {
          id: newCycleRef.id,
          name: group.name,
          group: group.name,
          groupId: group.id,
          groupName: group.name,
          cycleNumber: txnNextNumber,
          cycle: `Cycle ${txnNextNumber}`,
          startDate,
          endDate,
          status: "active",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          completedAt: null,
          createdBy: user?.email || "admin"
        });

        // Step F: Mark previous cycle as completed
        uniqueActiveDocs.forEach(activeDoc => {
          transaction.update(doc(db, 'cycles', activeDoc.id), {
            status: 'completed',
            completedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
        });

        // Step G: Update metadata in same transaction (lastLaunchedCycle, currentCycleId, updatedAt)
        transaction.update(groupRef, {
          lastLaunchedCycle: txnNextNumber,
          currentCycleId: newCycleRef.id,
          updatedAt: new Date().toISOString()
        });
      });

      // Post-commit reload and verification checks
      const postQuery = await getDocs(
        query(collection(db, 'cycles'), where('groupId', '==', group.id))
      );
      const postCycles = postQuery.docs.map(doc => ({ ...doc.data() as any, id: doc.id }));
      postCycles.sort((a, b) => (Number(a.cycleNumber) || 0) - (Number(b.cycleNumber) || 0));

      const newLatestCycle = postCycles[postCycles.length - 1];
      const prevLatestCycle = postCycles[postCycles.length - 2];
      const postActiveCycles = postCycles.filter((c: any) => c.status === 'active');

      if (postCycles.length !== (preCommitCount + 1)) {
        throw new Error("Verification failed: Cycle count did not increase by exactly one.");
      }
      if (!newLatestCycle || Number(newLatestCycle.cycleNumber) !== nextNumber) {
        throw new Error("Verification failed: Highest cycle number did not increase by one.");
      }
      if (newLatestCycle.status !== 'active') {
        throw new Error("Verification failed: New cycle is not active.");
      }
      if (prevLatestCycle && prevLatestCycle.status !== 'completed') {
        throw new Error("Verification failed: Previous cycle is not completed.");
      }
      if (postActiveCycles.length !== 1) {
        throw new Error("Verification failed: Active cycle count is not exactly one.");
      }

      // Check duplicate cycleNumber
      const postNumbers = postCycles.map(c => Number(c.cycleNumber));
      const duplicates = postNumbers.filter((item, index) => postNumbers.indexOf(item) !== index);
      if (duplicates.length > 0) {
        throw new Error("Verification failed: Duplicate cycle numbers detected.");
      }

      // Verify metadata matches new cycle
      const groupDocSnap = await getDoc(doc(db, 'chitRounds', group.id));
      const groupDocData = groupDocSnap.data();
      if (!groupDocData) {
        throw new Error("Verification failed: Group document not found after commit.");
      }
      if (Number(groupDocData.lastLaunchedCycle) !== nextNumber) {
        throw new Error("Verification failed: Metadata lastLaunchedCycle does not match the new cycle.");
      }
      if (groupDocData.currentCycleId !== newCycleRef.id) {
        throw new Error("Verification failed: Metadata currentCycleId does not match the new cycle.");
      }

      await createAuditLog(db, user, `Launched New Operational Period: ${group.name} - Cycle ${nextNumber}`);
      toast({ title: "New Cycle Launched", description: `Group ${group.name} is now in Cycle ${nextNumber}.` });
      setIsOpen(false);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Launch Failed", description: error.message || "Failed to initialize cycle." });
    } finally {
      setIsSaving(false);
      document.body.style.pointerEvents = 'auto';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if(!open) document.body.style.pointerEvents = 'auto'; setIsOpen(open); }}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full transition-colors text-primary/70 hover:text-primary hover:bg-primary/10">
          <CalendarDays className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent 
        className="sm:max-w-[340px]" 
        onOpenAutoFocus={(e) => e.preventDefault()}
        onInteractOutside={handlePopupBlur}
        onEscapeKeyDown={handlePopupBlur}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-headline uppercase tracking-tight text-primary">
            <TrendingUp className="size-4" />
            Launch Next Cycle
          </DialogTitle>
          <DialogDescription className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
            Establish the next sequential audit period.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="p-4 bg-emerald-50 rounded-2xl border border-dashed border-emerald-200 text-center">
            <p className="text-[10px] font-black uppercase text-emerald-600/70 mb-1">New Cycle Number</p>
            <p className="text-2xl font-black text-emerald-700 uppercase tracking-tighter">
              Cycle {nextCycleNumber}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Start Date</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-10 text-xs rounded-xl font-bold" />
            </div>
            <div className="space-y-1">
              <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">End Date</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-10 text-xs rounded-xl font-bold" />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button 
            onClick={handleLaunchNewCycle} 
            disabled={isSaving} 
            className="w-full font-black uppercase tracking-[0.1em] h-12 rounded-xl active:scale-[0.98] transition-all shadow-md"
          >
            {isSaving ? <Loader2 className="size-3 mr-2 animate-spin" /> : <CheckCircle2 className="size-3 mr-2" />}
            Launch Period
          </Button>
        </DialogFooter>
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
  const [isExpiryPopupOpen, setIsExpiryPopupOpen] = useState(false)
  
  const [isCollectionPopupOpen, setIsCollectionPopupOpen] = useState(false)
  const [activePopupGroupName, setActivePopupGroupName] = useState<string | null>(null)
  const [selectedReconciliationCycleId, setSelectedReconciliationCycleId] = useState<string | null>(null)
  
  const [isDailyAuditOpen, setIsDailyAuditOpen] = useState(false)
  const [auditDate, setAuditDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [isAuditDatePickerOpen, setIsAuditDatePickerOpen] = useState(false)

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

  const cyclesQuery = useMemoFirebase(() => query(collection(db, 'cycles'), orderBy('createdAt', 'desc')), [db]);
  const { data: allCycles } = useCollection(cyclesQuery);

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    return () => {
      document.body.style.pointerEvents = 'auto';
      document.body.style.overflow = 'auto';
    };
  }, []);


  const membersWithCalculatedStats = useMemo(() => {
    if (!members || !allPayments || !chitSchemes) return [];
    
    // Group payments by memberId to optimize performance to O(M+P)
    const paymentsByMember = new Map<string, any[]>();
    allPayments.forEach(p => {
      if (p.memberId) {
        if (!paymentsByMember.has(p.memberId)) {
          paymentsByMember.set(p.memberId, []);
        }
        paymentsByMember.get(p.memberId)!.push(p);
      }
    });

    return members.map((m) => {
      const memberPayments = paymentsByMember.get(m.id) || [];
      const stats = computeMemberStats(m, memberPayments, allCycles || [], chitSchemes);
      return { ...m, ...stats };
    });
  }, [members, allPayments, chitSchemes, allCycles]);

  const currentRound = useMemo(() => chitSchemes.find(r => r.id === selectedChitId), [chitSchemes, selectedChitId])
  const assignedMembers = useMemo(() => membersWithCalculatedStats.filter(m => m.status !== 'inactive' && String(m.chitGroup).trim().toLowerCase() === String(currentRound?.name).trim().toLowerCase()), [membersWithCalculatedStats, currentRound])

  const totalPaidByMember = useMemo(() => {
    const map = new Map<string, number>();
    if (!allPayments || !members || !allCycles) return map;

    const paymentsByMember = new Map<string, any[]>();
    allPayments.forEach(p => {
      if (p.memberId) {
        if (!paymentsByMember.has(p.memberId)) {
          paymentsByMember.set(p.memberId, []);
        }
        paymentsByMember.get(p.memberId)!.push(p);
      }
    });

    members.forEach((m) => {
      const memberPayments = paymentsByMember.get(m.id) || [];
      const total = computeTotalPaidInActiveCycle(m.id, m.chitGroup, memberPayments, allCycles);
      if (total > 0) map.set(m.id, total);
    });
    return map;
  }, [allPayments, members, allCycles]);

  const groupActiveCycleCollections = useMemo(() => {
    const map = new Map<string, number>();
    if (!allCycles || !allPayments || !members || !chitSchemes) return map;

    const activeCycleByGroup = new Map<string, any>();
    chitSchemes.forEach(group => {
      const normalised = String(group.name || '').trim().toLowerCase();
      const activeCycle = findActiveCycle(group.name, allCycles);
      if (activeCycle) {
        activeCycleByGroup.set(normalised, activeCycle);
      }
    });

    const groupNameByMember = new Map<string, string>();
    members.forEach(m => {
      if (m.id && m.chitGroup) {
        groupNameByMember.set(m.id, String(m.chitGroup).trim().toLowerCase());
      }
    });

    chitSchemes.forEach(group => {
      map.set(String(group.name || '').trim().toLowerCase(), 0);
    });

    allPayments.forEach(p => {
      if (!isPaymentSuccess(p)) return;
      const memberGroup = groupNameByMember.get(p.memberId);
      if (!memberGroup) return;

      const activeCycle = activeCycleByGroup.get(memberGroup);
      if (!activeCycle) return;

      const pDate = getPaymentDateStr(p);
      if (pDate != null && pDate >= activeCycle.startDate && (activeCycle.endDate ? pDate <= activeCycle.endDate : true)) {
        const amt = getPaymentAmount(p);
        map.set(memberGroup, (map.get(memberGroup) || 0) + amt);
      }
    });

    return map;
  }, [allCycles, allPayments, members, chitSchemes]);

  const groupPendingCounts = useMemo(() => {
    const map = new Map<string, number>();
    membersWithCalculatedStats.forEach(m => {
      if (m.status !== 'inactive' && m.memberStatus === 'pending' && m.chitGroup) {
        const groupName = String(m.chitGroup).trim().toLowerCase();
        map.set(groupName, (map.get(groupName) || 0) + 1);
      }
    });
    return map;
  }, [membersWithCalculatedStats]);

  const groupOccupancy = useMemo(() => {
    const map = new Map<string, number>();
    if (!members) return map;
    members.forEach(m => {
      if (m.status !== 'inactive' && m.chitGroup) {
        const groupName = String(m.chitGroup).trim().toLowerCase();
        map.set(groupName, (map.get(groupName) || 0) + 1);
      }
    });
    return map;
  }, [members]);

  const missedDatesForSelectedMember = useMemo(() => {
    if (!selectedPendingMember || !allPayments || !allCycles || !chitSchemes) return [];
    const m = selectedPendingMember;
    const activeCycle = findActiveCycle(m.chitGroup, allCycles || []);
    if (!activeCycle) return [];
    const scheme = chitSchemes.find(r => String(r.name || '').trim().toLowerCase() === String(m.chitGroup || '').trim().toLowerCase());
    const resolvedType = (m.paymentType || scheme?.collectionType || "Daily");
    const mPayments = allPayments.filter((p) => p.memberId === m.id && isPaymentSuccess(p));
    const missed: string[] = [];
    const today = startOfDay(new Date());

    if (resolvedType === 'Daily') {
      if (m.joinDate) {
        try {
          const rawJoinDate = parseISO(m.joinDate);
          const cycleStart = parseISO(activeCycle.startDate);
          const cycleEnd = activeCycle.endDate ? parseISO(activeCycle.endDate) : today;
          const effectiveStart = startOfDay(max([rawJoinDate, cycleStart]));
          const effectiveEnd = isBefore(today, cycleEnd) ? today : cycleEnd;
          if (isBefore(effectiveStart, addDays(effectiveEnd, 1))) {
            const interval = eachDayOfInterval({ start: effectiveStart, end: effectiveEnd });
            interval.forEach(day => {
              const dStr = format(day, 'yyyy-MM-dd');
              const daySum = mPayments.filter((p) => getPaymentDateStr(p) === dStr).reduce((acc, p) => acc + getPaymentAmount(p), 0);
              if (daySum < (m.monthlyAmount || 800)) { missed.push(dStr); }
            });
          }
        } catch (e) {}
      }
    } else if (m.memberStatus === 'pending') { missed.push(activeCycle.startDate); }
    return missed;
  }, [selectedPendingMember, allPayments, allCycles, chitSchemes]);

  const getDisplayName = (name: string) => {
    if (!name) return "";
    return "Group " + name.replace(/Group/gi, '').trim();
  };

  const getGroupPaymentsForDate = (groupName: string, dateStr: string) => {
    if (!allPayments || !members) return [];
    const normalised = String(groupName || '').trim().toLowerCase();
    const groupMemberIds = new Set(members.filter(m => String(m.chitGroup || '').trim().toLowerCase() === normalised).map(m => m.id));
    return allPayments.filter(p => {
      if (!groupMemberIds.has(p.memberId)) return false;
      if (!isPaymentSuccess(p)) return false;
      return getPaymentDateStr(p) === dateStr;
    });
  };

  const getGroupCollectionForDate = (groupName: string, dateStr: string) => {
    return getGroupPaymentsForDate(groupName, dateStr).reduce((acc, p) => acc + getPaymentAmount(p), 0);
  };

  const getGroupTodayCollection = (groupName: string) => getGroupCollectionForDate(groupName, format(new Date(), 'yyyy-MM-dd'));

  const todayStr = format(new Date(), 'yyyy-MM-dd');

  const todayPaymentsForGroup = useMemo(() => {
    if (!currentRound) return [];
    return getGroupPaymentsForDate(currentRound.name, todayStr);
  }, [allPayments, members, currentRound, todayStr]);

  const auditDatePayments = useMemo(() => {
    if (!currentRound || !auditDate) return [];
    const paymentsForDate = getGroupPaymentsForDate(currentRound.name, auditDate);
    return [...paymentsForDate].sort((a, b) => {
      const nameA = String(a.memberName || '').trim().toLowerCase();
      const nameB = String(b.memberName || '').trim().toLowerCase();
      return nameA.localeCompare(nameB);
    });
  }, [allPayments, members, currentRound, auditDate]);

  const auditDatePendingMembers = useMemo(() => {
    if (!assignedMembers || !auditDate) return [];
    const paidMemberIds = new Set(auditDatePayments.map(p => p.memberId));
    return assignedMembers
      .filter(m => !paidMemberIds.has(m.id))
      .sort((a, b) => {
        const nameA = String(a.name || '').trim().toLowerCase();
        const nameB = String(b.name || '').trim().toLowerCase();
        return nameA.localeCompare(nameB);
      });
  }, [assignedMembers, auditDatePayments, auditDate]);

  const auditDateTotalCollection = useMemo(() => {
    return auditDatePayments.reduce((acc, p) => acc + getPaymentAmount(p), 0);
  }, [auditDatePayments]);

  const todayTotalCollectionAmount = useMemo(() => {
    return todayPaymentsForGroup.reduce((sum, p) => sum + getPaymentAmount(p), 0);
  }, [todayPaymentsForGroup]);

  const todayPaidMembersCount = useMemo(() => {
    return new Set(todayPaymentsForGroup.map(p => p.memberId)).size;
  }, [todayPaymentsForGroup]);

  const pendingMembersForGroup = useMemo(() => {
    if (!assignedMembers) return [];
    return assignedMembers.filter(m => m.calculatedPendingAmount > 0);
  }, [assignedMembers]);

  const totalPendingAmountForGroup = useMemo(() => {
    return pendingMembersForGroup.reduce((sum, m) => sum + m.calculatedPendingAmount, 0);
  }, [pendingMembersForGroup]);

  const getGroupCycleCollection = (groupName: string, cycle: any) => {
    if (!cycle || !allPayments || !members) return 0;
    const normalised = String(groupName || '').trim().toLowerCase();
    const groupMemberIds = new Set(members.filter(m => String(m.chitGroup || '').trim().toLowerCase() === normalised).map(m => m.id));
    return allPayments
      .filter(p => {
        if (!groupMemberIds.has(p.memberId)) return false;
        if (!isPaymentSuccess(p)) return false;
        const pDate = getPaymentDateStr(p);
        return pDate != null && pDate >= cycle.startDate && (cycle.endDate ? pDate <= cycle.endDate : true);
      })
      .reduce((acc, p) => acc + getPaymentAmount(p), 0);
  };

  const getGroupActiveCycleCollection = (groupName: string) => {
    const normalised = String(groupName || '').trim().toLowerCase();
    return groupActiveCycleCollections.get(normalised) || 0;
  };

  const reconciliationCycles = useMemo(() => {
    if (!activePopupGroupName || !allCycles) return [];
    const filtered = allCycles.filter((c) => {
      const cNameClean = String(c?.name || "").replace(/group/gi, '').trim().toLowerCase();
      const targetClean = String(activePopupGroupName).replace(/group/gi, '').trim().toLowerCase();
      return cNameClean === targetClean;
    });

    const uniqueMap = new Map<string, any>()
    filtered.forEach((c) => {
      const start = String(c?.startDate || "-")
      const existing = uniqueMap.get(start)
      if (!existing || (c.status === 'active' && existing.status !== 'active')) {
        uniqueMap.set(start, c)
      }
    })

    const sortedUnique = Array.from(uniqueMap.values()).sort((a, b) => 
      (String(a.startDate || "")).localeCompare(String(b.startDate || ""))
    );
    
    return sortedUnique.map((c, i) => ({
      ...c,
      displayLabel: `Cycle ${i + 1}`
    })).reverse();
  }, [activePopupGroupName, allCycles]);

  const groupCyclesForActive = (allCycles || []).filter(c => {
    const cNameClean = String(c?.name || "").replace(/group/gi, '').trim().toLowerCase();
    const targetClean = String(currentRound?.name || "").replace(/group/gi, '').trim().toLowerCase();
    return cNameClean === targetClean;
  });
  const uniqueStartsForActive = Array.from(new Set(groupCyclesForActive.map(c => c.startDate || ""))).filter(Boolean).sort((a, b) => a.localeCompare(b));
  
  const currentActiveCycle = groupCyclesForActive.find(c => c.status === 'active');
  const activeCycleNumber = currentActiveCycle ? (Number(currentActiveCycle.cycleNumber) || (uniqueStartsForActive.indexOf(currentActiveCycle.startDate) + 1)) : null;

  const isBoardExpired = useMemo(() => {
    if (!currentActiveCycle?.endDate) return false;
    return isAfter(startOfDay(new Date()), startOfDay(parseISO(currentActiveCycle.endDate)));
  }, [currentActiveCycle]);

  useEffect(() => {
    if (selectedChitId && isBoardExpired) {
      setIsExpiryPopupOpen(true);
    }
  }, [selectedChitId, isBoardExpired]);

  const handleQuickPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !selectedMemberForPayment || !currentRound || isActionPending) return;
    const pAmt = Number(paymentData.amount);
    const tDate = paymentData.date; 
    const alreadyPaid = (allPayments || []).some(p => p.memberId === selectedMemberForPayment.id && getPaymentDateStr(p) === tDate && isPaymentSuccess(p));
    if (alreadyPaid) { toast({ variant: "destructive", title: "Duplicate Entry", description: "Already paid for this date." }); return; }
    setIsActionPending(true);
    try {
      const activeCycle = (allCycles || []).find(c => String(c.name).trim().toLowerCase() === String(currentRound.name).trim().toLowerCase() && c.status === 'active');
      
      const batch = writeBatch(db);
      const paymentRef = doc(collection(db, 'payments'));
      
      batch.set(paymentRef, {
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

      const memberRef = doc(db, 'members', selectedMemberForPayment.id);
      batch.update(memberRef, {
        totalPaid: increment(pAmt)
      });

      await batch.commit();

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
      await updateDoc(doc(db, 'members', selectedProfileMember.id), { name: selectedProfileMember.name, phone: selectedProfileMember.phone, joinDate: selectedProfileMember.joinDate, paymentType: selectedProfileMember.paymentType });
      await createAuditLog(db, user, `Updated member profile: ${selectedProfileMember.name}`);
      setIsEditingMember(false);
      toast({ title: "Profile Updated", description: "Details saved successfully." });
    } catch (e: any) { toast({ variant: "destructive", title: "Error", description: e.message || "Failed to update profile." }); } finally { setIsActionPending(false); }
  }

  if (isRoleLoading || isRoundsLoading || !mounted) return (<div className="flex h-[60vh] items-center justify-center"><Loader2 className="size-8 animate-spin text-primary" /></div>)

  if (!selectedChitId) {
    return (
      <div className="space-y-8 animate-in fade-in duration-500 pb-10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5"><h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-primary font-headline uppercase">Seat Reservations</h2><p className="text-sm text-muted-foreground font-medium">Manage schemes and isolated audit periods.</p></div>
          <Button onClick={() => setIsAddChitDialogOpen(true)} className="font-bold gap-2 px-6 h-11 shadow-lg bg-primary hover:bg-primary/90 active:scale-[0.98] transition-all"><Plus className="size-5" /> Add Scheme</Button>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {chitSchemes.map((group) => {
            const groupCycles = (allCycles || []).filter(c => {
              const cNameClean = String(c?.name || "").replace(/group/gi, '').trim().toLowerCase();
              const gNameClean = String(group?.name || "").replace(/group/gi, '').trim().toLowerCase();
              return cNameClean === gNameClean;
            });
            const uniqueStarts = Array.from(new Set(groupCycles.map(c => c.startDate || ""))).filter(Boolean).sort((a, b) => a.localeCompare(b));
            
            const activeCycle = groupCycles.find(c => c.status === 'active');
            const cycleNumber = activeCycle ? (Number(activeCycle.cycleNumber) || (uniqueStarts.indexOf(activeCycle.startDate) + 1)) : null;
            
            const groupNameLower = String(group.name || '').trim().toLowerCase();
            const currentOccupancy = groupOccupancy.get(groupNameLower) || 0;
            const groupPendingCount = groupPendingCounts.get(groupNameLower) || 0;

            const isExpired = activeCycle && activeCycle.endDate && isAfter(startOfDay(new Date()), startOfDay(parseISO(activeCycle.endDate)));

            const sortedCycles = [...groupCycles].sort((a, b) => (Number(a.cycleNumber) || 0) - (Number(b.cycleNumber) || 0));
            const latestCycle = sortedCycles[sortedCycles.length - 1];

            return (
              <Card key={group.id} className="group hover:shadow-xl transition-all border-border/60 overflow-hidden flex flex-col relative bg-card shadow-sm rounded-2xl">
                <div className="absolute top-3 right-3 flex items-center gap-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full transition-colors">
                        <MoreVertical className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => { setChitToEdit(group); setIsEditChitDialogOpen(true); }}><Pencil className="size-4 mr-2" /> Edit Scheme</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-destructive" onSelect={() => { setChitToDelete(group); setIsDeleteChitDialogOpen(true); }}><Trash2 className="size-4 mr-2" /> Delete Scheme</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-primary/10 text-primary/70 hover:text-primary transition-colors" onClick={() => { setActivePopupGroupName(group.name); setSelectedReconciliationCycleId(activeCycle?.id || null); setIsCollectionPopupOpen(true); }}><Wallet className="size-4" /></Button>
                  <GroupCycleControl group={group} latestCycle={latestCycle} />
                </div>
                <CardHeader className="p-5 pb-3 space-y-1.5 border-b border-border/40">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="w-fit text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 bg-primary/5 border-primary/20 text-primary">{group.collectionType}</Badge>
                    {activeCycle && (
                      <Badge className={cn("text-[10px] font-black uppercase tracking-tighter h-5", isExpired ? "bg-destructive/10 text-destructive border-destructive/20" : "bg-emerald-50 text-emerald-700 border-emerald-100")}>
                        {isExpired ? 'Expired' : activeCycle.endDate ? `${differenceInDays(parseISO(activeCycle.endDate), parseISO(activeCycle.startDate)) + 1} Days` : 'In Progress'}
                      </Badge>
                    )}
                  </div>
                  <CardTitle className="text-xl font-bold tracking-tight text-foreground whitespace-nowrap overflow-visible pr-24">{getDisplayName(group.name)}</CardTitle>
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">
                    <Calendar className="size-3 text-primary/40" />
                    {activeCycle ? (
                      <>{cycleNumber ? `Cycle ${cycleNumber} | ` : ''}{format(parseISO(activeCycle.startDate), 'MMM dd')} → {activeCycle.endDate ? format(parseISO(activeCycle.endDate), 'MMM dd') : '...'}</>
                    ) : 'No Active Cycle'}
                  </div>
                  {isExpired && (
                    <div className="flex items-center gap-1.5 mt-1 bg-destructive/10 px-2 py-0.5 rounded-md w-fit border border-destructive/20 animate-pulse">
                      <AlertCircle className="size-3 text-destructive" />
                      <span className="text-[8px] font-black text-destructive uppercase tracking-tighter">Cycle Completed</span>
                    </div>
                  )}
                </CardHeader>
                <CardContent className="p-5 flex-1 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-xs"><span className="text-muted-foreground font-semibold">Scheme Amount</span><span className="font-bold text-primary">₹{(group.monthlyAmount || 0).toLocaleString()}</span></div>
                    <div className="flex justify-between items-center text-xs"><span className="text-amber-600 font-semibold">Pending Count</span><span className={cn("font-bold text-sm", groupPendingCount > 0 ? "text-amber-500" : "text-emerald-600")}>{groupPendingCount}</span></div>
                    <div className="flex justify-between items-center text-xs"><span className="text-muted-foreground font-semibold">Occupancy</span><span className="font-black tabular-nums">{currentOccupancy} / {group.totalMembers}</span></div>
                  </div>
                  <div className="pt-4 mt-2 border-t border-dashed border-border/60"><div className="flex justify-between items-center"><span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">Cycle Collection</span><span className="font-black text-emerald-600 text-base tabular-nums">₹{getGroupActiveCycleCollection(group.name).toLocaleString()}</span></div></div>
                </CardContent>
                <CardFooter className="p-1.5 bg-muted/5 border-t border-border/40"><Button variant="ghost" className="w-full h-7 font-black text-[10px] uppercase tracking-[0.2em] hover:bg-primary hover:text-primary-foreground rounded-lg" onClick={() => setSelectedChitId(group.id)}>View Board</Button></CardFooter>
              </Card>
            );
          })}
        </div>

        <Dialog open={isCollectionPopupOpen} onOpenChange={(o) => { if(!o) document.body.style.pointerEvents = 'auto'; setIsCollectionPopupOpen(o); }}>
          <DialogContent className="sm:max-w-[420px] rounded-[1.5rem] p-0 overflow-hidden border-none shadow-2xl bg-white" onOpenAutoFocus={(e) => e.preventDefault()} onInteractOutside={handlePopupBlur} onEscapeKeyDown={handlePopupBlur}>
            {activePopupGroupName && (
              <div className="flex flex-col max-h-[85vh]">
                <div className="bg-primary/5 p-4 text-center border-b border-border/40 shrink-0">
                  <DialogTitle className="flex items-center justify-center gap-2 text-base font-headline uppercase tracking-tight text-primary">
                    <Wallet className="size-4" /> Total Collections
                  </DialogTitle>
                  <DialogDescription className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mt-1">
                    {getDisplayName(activePopupGroupName)} Operational Audit
                  </DialogDescription>
                </div>

                <div className="p-4 overflow-y-auto custom-scrollbar flex-1 bg-white space-y-3">
                  {reconciliationCycles.length > 0 ? (
                    [...reconciliationCycles].reverse().map((c) => {
                      const totalAmount = getGroupCycleCollection(activePopupGroupName, c);
                      return (
                        <div key={c.id} className="p-4 rounded-2xl bg-muted/25 border border-border/40 hover:bg-muted/40 transition-all flex flex-col justify-between gap-3 relative overflow-hidden group shadow-sm">
                          <div className="absolute -right-3 -bottom-3 opacity-5 group-hover:scale-110 transition-transform duration-500">
                            <IndianRupee className="size-12 text-primary" />
                          </div>
                          <div className="flex items-center justify-between relative z-10">
                            <span className="text-xs font-black uppercase text-primary tracking-wider">{c.displayLabel}</span>
                            <span className={cn("text-[9px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full", c.status === 'active' ? "bg-emerald-50 text-emerald-700 border border-emerald-100" : "bg-muted text-muted-foreground/80 border border-muted-foreground/10")}>
                              {c.status === 'active' ? 'Active' : 'Completed'}
                            </span>
                          </div>
                          <div className="flex items-end justify-between relative z-10">
                            <div className="flex flex-col gap-0.5">
                              <span className="text-[8px] font-black uppercase text-muted-foreground tracking-widest">Cycle Period</span>
                              <span className="text-[10px] font-bold text-foreground/80 tabular-nums">
                                {format(parseISO(c.startDate), 'dd MMM yyyy')} - {c.endDate ? format(parseISO(c.endDate), 'dd MMM yyyy') : 'In Progress'}
                              </span>
                            </div>
                            <div className="flex flex-col items-end gap-0.5">
                              <span className="text-[8px] font-black uppercase text-emerald-600/70 tracking-widest">Collection</span>
                              <span className="text-base font-black text-emerald-600 tabular-nums">
                                ₹{totalAmount.toLocaleString()}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="p-8 text-center text-xs font-bold uppercase text-muted-foreground/50 italic">
                      No operational cycles registered.
                    </div>
                  )}
                </div>

                <div className="p-3 bg-muted/10 border-t border-border/40 shrink-0">
                  <Button onClick={() => setIsCollectionPopupOpen(false)} className="w-full font-black uppercase tracking-widest h-11 rounded-xl shadow-md bg-primary hover:bg-primary/90 text-white text-xs active:scale-[0.98] transition-all">
                    Close Audit
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={isAddChitDialogOpen} onOpenChange={(o) => { if(!o) document.body.style.pointerEvents = 'auto'; setIsAddChitDialogOpen(o); }}>
          <DialogContent className="sm:max-w-[340px]" onOpenAutoFocus={(e) => e.preventDefault()} onInteractOutside={handlePopupBlur} onEscapeKeyDown={handlePopupBlur}>
            <form onSubmit={handleAddChit}>
              <DialogHeader><DialogTitle className="text-lg font-headline uppercase tracking-tight text-primary">New Scheme</DialogTitle></DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-1.5"><Label className="text-[9px] font-black uppercase text-muted-foreground">Scheme Name</Label><Input value={newChit.name} onChange={e => setNewChit({...newChit, name: e.target.value})} required className="h-10 rounded-xl text-sm font-bold" placeholder="e.g. A" /></div>
                <div className="grid gap-1.5"><Label className="text-[9px] font-black uppercase text-muted-foreground">Amount (₹)</Label><Input type="number" value={newChit.monthlyAmount || ""} onChange={e => setNewChit({...newChit, monthlyAmount: Number(e.target.value)})} required className="h-10 rounded-xl text-sm font-bold" /></div>
                <div className="grid gap-1.5"><Label className="text-[9px] font-black uppercase text-muted-foreground">Max Members</Label><Input type="number" value={newChit.totalMembers || ""} onChange={e => setNewChit({...newChit, totalMembers: Number(e.target.value)})} required className="h-10 rounded-xl text-sm font-bold" /></div>
                <div className="grid gap-1.5"><Label className="text-[9px] font-black uppercase text-muted-foreground">Collection Type</Label><Select value={newChit.collectionType} onValueChange={(v) => setNewChit({...newChit, collectionType: v})}><SelectTrigger className="h-10 rounded-xl font-bold"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Daily">Daily</SelectItem><SelectItem value="Monthly">Monthly</SelectItem></SelectContent></Select></div>
              </div>
              <DialogFooter><Button type="submit" disabled={isActionPending} className="w-full h-11 font-black uppercase tracking-[0.1em] shadow-md active:scale-[0.98] transition-all">{isActionPending ? <Loader2 className="size-3 mr-2 animate-spin" /> : null}Create Scheme</Button></DialogFooter></form>
          </DialogContent>
        </Dialog>

        <Dialog open={isEditChitDialogOpen} onOpenChange={(o) => { if(!o) { setChitToEdit(null); document.body.style.pointerEvents = 'auto'; } setIsEditChitDialogOpen(o); }}>
          <DialogContent className="sm:max-w-[340px]" onOpenAutoFocus={(e) => e.preventDefault()} onInteractOutside={handlePopupBlur} onEscapeKeyDown={handlePopupBlur}>
            {chitToEdit && (
              <form onSubmit={handleUpdateChit}>
                <DialogHeader><DialogTitle className="text-lg font-headline uppercase tracking-tight text-primary">Edit Scheme</DialogTitle></DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-1.5"><Label className="text-[9px] font-black uppercase text-muted-foreground">Scheme Name</Label><Input value={chitToEdit.name} onChange={e => setChitToEdit({...chitToEdit, name: e.target.value})} required className="h-10 rounded-xl text-sm font-bold" /></div>
                  <div className="grid gap-1.5"><Label className="text-[9px] font-black uppercase text-muted-foreground">Amount (₹)</Label><Input type="number" value={chitToEdit.monthlyAmount || ""} onChange={e => setChitToEdit({...chitToEdit, monthlyAmount: Number(e.target.value)})} required className="h-10 rounded-xl text-sm font-bold" /></div>
                  <div className="grid gap-1.5"><Label className="text-[9px] font-black uppercase text-muted-foreground">Max Members</Label><Input type="number" value={chitToEdit.totalMembers || ""} onChange={e => setChitToEdit({...chitToEdit, totalMembers: Number(e.target.value)})} required className="h-10 rounded-xl text-sm font-bold" /></div>
                  <div className="grid gap-1.5"><Label className="text-[9px] font-black uppercase text-muted-foreground">Collection Type</Label><Select value={chitToEdit.collectionType} onValueChange={(v) => setChitToEdit({...chitToEdit, collectionType: v})}><SelectTrigger className="h-10 rounded-xl font-bold"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Daily">Daily</SelectItem><SelectItem value="Monthly">Monthly</SelectItem></SelectContent></Select></div>
                </div>
                <DialogFooter><Button type="submit" disabled={isActionPending} className="w-full h-11 font-black uppercase tracking-[0.1em] shadow-md">{isActionPending ? <Loader2 className="mr-2 size-3 animate-spin" /> : null}Save Changes</Button></DialogFooter></form>
            )}
          </DialogContent>
        </Dialog>

        <AlertDialog open={isDeleteChitDialogOpen} onOpenChange={(o) => { if(!o) { setChitToDelete(null); document.body.style.pointerEvents = 'auto'; } setIsDeleteChitDialogOpen(o); }}>
          <AlertDialogContent className="sm:max-w-[340px]">
            <AlertDialogHeader><AlertDialogTitle className="text-destructive text-lg font-headline uppercase">Delete Scheme?</AlertDialogTitle><AlertDialogDescription className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">This will remove <strong>{chitToDelete?.name}</strong> and all data.</AlertDialogDescription></AlertDialogHeader>
            <AlertDialogFooter className="flex-col gap-2"><AlertDialogAction onClick={handleDeleteChit} disabled={isActionPending} className="bg-destructive hover:bg-destructive/90 h-11 font-black uppercase tracking-widest w-full">{isActionPending ? <Loader2 className="mr-2 size-3 animate-spin" /> : null}Delete</AlertDialogAction><AlertDialogCancel onClick={() => setIsDeleteChitDialogOpen(false)} className="h-10 font-bold uppercase text-[10px] w-full border-muted/60">Cancel</AlertDialogCancel></AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    )
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => setSelectedChitId(null)} className="rounded-full h-10 w-10 shadow-sm active:scale-[0.98] transition-all"><ChevronLeft className="size-5" /></Button>
          <div className="min-w-0"><div className="flex items-center gap-2 mb-1"><h2 className="text-xl sm:text-2xl font-black tracking-tight text-primary font-headline uppercase whitespace-nowrap overflow-visible">{currentRound?.name}</h2><Badge variant="secondary" className="text-[9px] font-black tracking-tighter bg-primary/10 text-primary border-none">{currentRound?.collectionType}</Badge></div></div>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            onClick={() => setIsAddMemberDialogOpen(true)} 
            disabled={isActionPending || isBoardExpired}
            className="font-bold gap-2 h-11 px-6 shadow-lg active:scale-[0.98] transition-all"
          >
            <UserPlus className="size-5" /> Add Member
          </Button>
        </div>
      </div>

      {isBoardExpired && (
        <div className="bg-destructive/5 border border-destructive/20 p-4 rounded-2xl flex items-center justify-between gap-4 mb-6 animate-in slide-in-from-top-1">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-destructive/10 flex items-center justify-center text-destructive">
              <AlertCircle className="size-6" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase text-destructive tracking-widest mb-0.5">Payments & Registration Locked</p>
              <p className="text-xs font-bold text-foreground/70">The operational window for this group ended on <span className="text-destructive">{currentActiveCycle?.endDate ? format(parseISO(currentActiveCycle.endDate), 'dd-MM-yyyy') : '-'}</span>. Please update the registry.</p>
            </div>
          </div>
          <GroupCycleControl group={currentRound} latestCycle={currentActiveCycle} />
        </div>
      )}

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 items-stretch">
        <Card className="shadow-sm border-l-4 border-l-primary/40 bg-card rounded-xl h-full flex flex-col">
          <CardHeader className="p-2.5 pb-1 flex flex-row items-center justify-between min-h-[38px]"><CardTitle className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Scheme Amount</CardTitle></CardHeader>
          <CardContent className="p-2.5 pt-0 flex-1 flex flex-col justify-center"><div className="text-lg font-bold tabular-nums tracking-tight text-primary">₹{(currentRound?.monthlyAmount || 0).toLocaleString()}</div></CardContent>
        </Card>
        <Card className="shadow-sm border-l-4 border-l-primary bg-card rounded-xl h-full flex flex-col">
          <CardHeader className="p-2.5 pb-1 flex flex-row items-center justify-between min-h-[38px]"><CardTitle className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Occupancy</CardTitle></CardHeader>
          <CardContent className="p-2.5 pt-0 flex-1 flex flex-col justify-center"><div className="text-lg font-bold tabular-nums tracking-tight text-primary">{assignedMembers.length} / {currentRound?.totalMembers}</div></CardContent>
        </Card>
        <Card className="shadow-sm border-l-4 border-l-amber-500 bg-card rounded-xl h-full flex flex-col">
          <CardHeader className="p-2.5 pb-1 flex flex-row items-center justify-between min-h-[38px]"><CardTitle className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Pending Count</CardTitle></CardHeader>
          <CardContent className="p-2.5 pt-0 flex-1 flex flex-col justify-center"><div className="text-lg font-bold tabular-nums text-amber-600 tracking-tight">{assignedMembers.filter(m => m.memberStatus === 'pending').length}</div></CardContent>
        </Card>
        <Card 
          className="shadow-sm border-l-4 border-l-emerald-500 bg-card rounded-xl h-full flex flex-col cursor-pointer hover:shadow-md hover:border-emerald-500/30 transition-all active:scale-[0.99]"
          onClick={() => { setAuditDate(format(new Date(), 'yyyy-MM-dd')); setIsDailyAuditOpen(true); }}
        >
          <CardHeader className="p-2.5 pb-1 flex flex-row items-center justify-between min-h-[38px]">
            <CardTitle className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Today Collection</CardTitle>
          </CardHeader>
          <CardContent className="p-2.5 pt-0 flex-1 flex flex-col justify-center">
            <div className="flex items-center justify-between w-full">
              <span className="text-xl font-black tabular-nums text-emerald-600 tracking-tight">
                ₹{getGroupTodayCollection(currentRound?.name).toLocaleString()}
              </span>
              <span className="h-7 w-7 rounded-full bg-emerald-50 hover:bg-emerald-100 text-emerald-600 hover:text-emerald-700 flex items-center justify-center shrink-0 shadow-sm transition-colors">
                <Eye className="size-4" />
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="rounded-2xl border bg-card shadow-sm overflow-hidden border-border/60">
        <div className="p-5 border-b bg-muted/30 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <h3 className="text-sm font-bold flex items-center gap-2 tracking-tight uppercase text-primary"><Users className="size-4" /> Board Participants</h3>
            {activeCycleNumber && <Badge className="bg-primary/10 text-primary border-none text-[10px] font-black uppercase tracking-widest px-2.5">Active Cycle {activeCycleNumber}</Badge>}
          </div>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/10"><TableRow className="border-b"><TableHead className="text-[10px] uppercase font-black tracking-[0.2em] h-12 pl-6">Member Participant</TableHead><TableHead className="text-[10px] uppercase font-black tracking-[0.2em] h-12">Pending Count</TableHead><TableHead className="text-[10px] uppercase font-black tracking-[0.2em] h-12">Status Indicator</TableHead><TableHead className="w-[120px] pr-6"></TableHead></TableRow></TableHeader>
            <TableBody>
              {assignedMembers.length > 0 ? assignedMembers.map((m) => (
                <TableRow key={m.id} className="hover:bg-muted/5 transition-colors group">
                  <TableCell className="pl-6 py-4"><div className="flex items-center gap-4 cursor-pointer" onClick={() => { setSelectedProfileMember(m); setIsEditingMember(false); setIsMemberProfileDialogOpen(true); }}><div className="h-10 w-10 rounded-xl bg-secondary text-primary flex items-center justify-center font-black text-xs uppercase">{getInitials(m.name)}</div><div className="flex flex-col min-0-w"><span className="text-sm font-bold truncate tracking-tight">{m.name}</span><span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{m.paymentType || currentRound?.collectionType}</span></div></div></TableCell>
                  <TableCell><button onClick={() => { setSelectedPendingMember(m); setIsPendingDetailsOpen(true); }} className={cn("px-4 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest tabular-nums", m.calculatedPendingDays > 0 ? "text-destructive font-bold" : "text-muted-foreground/40")}>{m.calculatedPendingDays} Days</button></TableCell>
                  <TableCell><Badge variant={m.memberStatus === 'paid' ? 'default' : 'secondary'} className={cn("text-[9px] font-black uppercase tracking-widest px-3 py-1 border-none shadow-sm", m.memberStatus === 'paid' ? "bg-emerald-500" : (m.memberStatus === 'waiting' ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"))}>{m.memberStatus.toUpperCase()}</Badge></TableCell>
                  <TableCell className="text-right pr-6"><div className="flex items-center justify-end gap-1.5"><Button variant="ghost" size="icon" className={cn("h-9 w-9 rounded-xl transition-all", m.memberStatus === 'paid' ? "text-emerald-500 bg-emerald-50" : "text-emerald-600 hover:bg-emerald-50 active:scale-90")} disabled={m.memberStatus === 'paid' || isActionPending || !currentActiveCycle || isBoardExpired} onClick={() => { setSelectedMemberForPayment(m); setPaymentData({ ...INITIAL_PAYMENT_STATE, amount: m.monthlyAmount || currentRound?.monthlyAmount || 800, date: format(new Date(), 'yyyy-MM-dd') }); setIsQuickPaymentDialogOpen(true); }}><IndianRupee className="size-4.5" /></Button><Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:bg-muted/5 rounded-xl" onClick={() => { setHistoryMember(m); setIsHistoryDialogOpen(true); }}><History className="size-4.5" /></Button></div></TableCell>
                </TableRow>
              )) : <TableRow><TableCell colSpan={4} className="h-48 text-center text-[11px] uppercase tracking-[0.2em] text-muted-foreground/60 font-bold italic">No participant records located</TableCell></TableRow>}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={isMemberProfileDialogOpen} onOpenChange={(o) => { if(!o) { setSelectedProfileMember(null); setIsEditingMember(false); document.body.style.pointerEvents = 'auto'; } setIsMemberProfileDialogOpen(o); }}>
        <DialogContent className="sm:max-w-[310px] p-0 overflow-hidden border-none shadow-2xl rounded-3xl" onOpenAutoFocus={(e) => e.preventDefault()} onInteractOutside={handlePopupBlur} onEscapeKeyDown={handlePopupBlur}>
          {selectedProfileMember && (
            <div className="flex flex-col">
              <DialogTitle className="sr-only">Member Profile: {selectedProfileMember.name}</DialogTitle>
              {isEditingMember ? (
                <form onSubmit={handleUpdateMemberProfile} className="flex flex-col">
                  <div className="bg-primary p-4 text-white text-center border-b border-white/10"><DialogHeader><div className="mx-auto mb-2 h-10 w-10 rounded-2xl bg-white/10 text-white flex items-center justify-center shadow-inner"><Edit3 className="size-4" /></div><DialogTitle className="text-base font-black uppercase tracking-tight text-white">Edit Registry</DialogTitle><DialogDescription className="text-[8px] font-bold uppercase tracking-widest text-white/60">Member Details</DialogDescription></DialogHeader></div>
                  <div className="p-4 space-y-3 bg-white"><div className="grid gap-3 py-1"><div className="grid gap-1"><Label className="text-[8px] font-black uppercase text-muted-foreground/70 ml-1">Full Name</Label><Input value={selectedProfileMember.name} onChange={e => setSelectedProfileMember({...selectedProfileMember, name: e.target.value})} required className="h-9 rounded-xl text-xs font-bold border-muted/60" /></div><div className="grid gap-1"><Label className="text-[8px] font-black uppercase text-muted-foreground/70 ml-1">Phone Number</Label><Input value={selectedProfileMember.phone} onChange={e => setSelectedProfileMember({...selectedProfileMember, phone: e.target.value})} required className="h-9 rounded-xl text-xs font-bold tabular-nums border-muted/60" /></div><div className="grid gap-1"><Label className="text-[8px] font-black uppercase text-muted-foreground/70 ml-1">Join Date</Label><Input type="date" value={selectedProfileMember.joinDate} onChange={e => setSelectedProfileMember({...selectedProfileMember, joinDate: e.target.value})} required className="h-9 rounded-xl text-xs font-bold border-muted/60" /></div><div className="grid gap-1"><Label className="text-[8px] font-black uppercase text-muted-foreground/70 ml-1">Mode</Label><Select value={selectedProfileMember.paymentType || currentRound?.collectionType} onValueChange={v => setSelectedProfileMember({...selectedProfileMember, paymentType: v})}><SelectTrigger className="h-9 rounded-xl text-xs font-bold border-muted/60"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Daily">Daily</SelectItem><SelectItem value="Monthly">Monthly</SelectItem></SelectContent></Select></div></div></div>
                  <div className="p-3 bg-muted/5 border-t border-border/40 flex flex-col gap-1.5"><Button type="submit" disabled={isActionPending} className="w-full h-10 font-black uppercase tracking-[0.2em] shadow-lg text-[9px]">{isActionPending ? <Loader2 className="size-3 mr-2 animate-spin" /> : <Save className="size-3 mr-2" />}Save Profile</Button><Button type="button" variant="ghost" onClick={() => setIsEditingMember(false)} className="w-full h-8 font-bold uppercase tracking-widest text-[8px] text-muted-foreground">Cancel</Button></div>
                </form>
              ) : (
                <>
                  <div className="bg-primary/5 p-4 pb-5 text-center relative border-b border-border/40"><Button variant="ghost" size="icon" className="absolute left-3 top-3 h-7 w-7 rounded-full hover:bg-white/80 text-primary transition-all shadow-sm border border-border/20" onClick={() => setIsEditingMember(true)}><Edit3 className="size-3.5" /></Button><div className="mx-auto mb-2 h-14 w-14 rounded-2xl bg-white text-primary flex items-center justify-center font-black text-lg shadow-lg border-2 border-primary/10 uppercase ring-4 ring-primary/5">{getInitials(selectedProfileMember.name)}</div><div className="space-y-0.5"><DialogTitle className="text-base font-black uppercase tracking-tight text-primary truncate px-2 text-center">{selectedProfileMember.name}</DialogTitle><div className="flex items-center justify-center"><Badge className="text-[8px] font-black uppercase tracking-widest bg-primary text-white border-none px-2.5 h-4">{selectedProfileMember.paymentType || currentRound?.collectionType}</Badge></div></div></div>
                  <div className="p-4 space-y-3 bg-white"><div className="grid gap-2"><div className="flex items-center gap-3 group"><div className="h-7 w-7 rounded-lg bg-muted/50 flex items-center justify-center text-muted-foreground transition-colors"><Phone className="size-3" /></div><div className="flex flex-col"><span className="text-[8px] font-black uppercase tracking-widest text-muted-foreground/60 leading-none mb-0.5">Phone Contact</span><span className="font-bold text-[11px] tabular-nums text-foreground">{selectedProfileMember.phone}</span></div></div><div className="flex items-center gap-3 group"><div className="h-7 w-7 rounded-lg bg-muted/50 flex items-center justify-center text-muted-foreground transition-colors"><CalendarDays className="size-3" /></div><div className="flex flex-col"><span className="text-[8px] font-black uppercase tracking-widest text-muted-foreground/60 leading-none mb-0.5">Joining Date</span><span className="font-bold text-[11px] text-foreground">{selectedProfileMember.joinDate ? format(parseISO(selectedProfileMember.joinDate), 'dd MMM yyyy') : 'N/A'}</span></div></div></div><div className="pt-1"><div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-between shadow-inner relative overflow-hidden group"><div className="absolute -right-3 -bottom-3 opacity-5 transition-transform duration-500"><IndianRupee className="size-14 text-emerald-900" /></div><div className="relative z-10"><span className="text-[8px] font-black uppercase tracking-widest text-emerald-600/80">Cycle Paid</span><p className="text-lg font-black text-emerald-700 tabular-nums tracking-tighter">₹{(totalPaidByMember.get(selectedProfileMember.id) || 0).toLocaleString()}</p></div><div className="h-8 w-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-md relative z-10"><Wallet className="size-3.5" /></div></div></div></div>
                  <div className="p-3 bg-muted/5 border-t border-border/40"><Button onClick={() => setIsMemberProfileDialogOpen(false)} className="w-full font-black uppercase tracking-[0.2em] h-10 rounded-xl text-[9px] shadow-sm bg-primary hover:bg-primary/90 text-white">Close Profile</Button></div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isPendingDetailsOpen} onOpenChange={(o) => { if(!o) { setSelectedPendingMember(null); document.body.style.pointerEvents = 'auto'; } setIsPendingDetailsOpen(o); }}>
        <DialogContent className="sm:max-w-[310px] p-0 overflow-hidden border-none shadow-2xl rounded-3xl" onOpenAutoFocus={(e) => e.preventDefault()} onInteractOutside={handlePopupBlur} onEscapeKeyDown={handlePopupBlur}>
          {selectedPendingMember && (
            <div className="flex flex-col">
              <DialogTitle className="sr-only">Pending Details for {selectedPendingMember.name}</DialogTitle>
              <div className="bg-primary/5 p-4 text-center relative border-b border-border/40"><div className="mx-auto mb-2 h-12 w-12 rounded-2xl bg-white text-primary flex items-center justify-center shadow-lg border-2 border-primary/10 ring-4 ring-primary/5"><History className="size-6" /></div><div className="space-y-0.5"><h3 className="text-lg font-black uppercase tracking-tight text-primary leading-tight text-center">Pending Details</h3><DialogDescription className="text-sm font-black text-primary px-4 text-center">{selectedPendingMember.name}</DialogDescription></div></div>
              <div className="p-4 space-y-4 bg-white"><div className="p-3 rounded-2xl bg-primary/5 border border-primary/10 flex items-center justify-between shadow-inner relative overflow-hidden group"><div className="absolute -right-4 -bottom-4 opacity-5 transition-transform duration-500"><IndianRupee className="size-16 text-primary-foreground fill-primary" /></div><div className="relative z-10"><span className="text-[8px] font-black uppercase tracking-widest text-primary/70">Estimated Debt</span><p className="text-2xl font-black text-primary tabular-nums tracking-tighter">₹{(selectedPendingMember.calculatedPendingAmount || 0).toLocaleString()}</p></div><div className="h-9 w-9 rounded-xl bg-primary text-white flex items-center justify-center shadow-md relative z-10"><Wallet className="size-4" /></div></div><div className="space-y-1.5"><div className="flex items-center justify-between px-1"><h4 className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/80">Missed Dates Ledger</h4><Badge variant="outline" className="text-[8px] font-black uppercase tracking-tighter border-primary/20 text-primary bg-primary/5 px-1.5 h-4">{selectedPendingMember.calculatedPendingDays || 0} Missed</Badge></div><ScrollArea className="h-[120px] rounded-xl border border-border/50 bg-muted/5 p-1.5"><div className="grid gap-1">{missedDatesForSelectedMember.length > 0 ? missedDatesForSelectedMember.map((dateStr, idx) => (<div key={idx} className="flex items-center justify-between px-3 py-2 bg-white rounded-lg border border-border/40 shadow-sm"><div className="flex items-center gap-3"><CalendarDays className="size-3.5 text-primary/40" /><span className="text-[11px] font-bold tabular-nums text-foreground/80">{format(parseISO(dateStr), 'dd-MM-yyyy')}</span></div></div>)) : <div className="h-24 flex flex-col items-center justify-center space-y-1.5"><CheckCircle2 className="size-6 text-emerald-500" /><p className="text-[8px] font-bold uppercase text-muted-foreground tracking-[0.2em]">Registry Clear</p></div>}</div></ScrollArea></div></div>
              <div className="p-3 bg-muted/5 border-t border-border/40"><Button onClick={() => setIsPendingDetailsOpen(false)} className="w-full font-black uppercase tracking-[0.2em] h-11 rounded-xl text-[9px] shadow-sm bg-primary hover:bg-primary/90 text-white">Close Audit</Button></div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isHistoryDialogOpen} onOpenChange={(o) => { if(!o) { setHistoryMember(null); document.body.style.pointerEvents = 'auto'; } setIsHistoryDialogOpen(o); }}>
        <DialogContent className="sm:max-w-[340px]" onOpenAutoFocus={(e) => e.preventDefault()} onInteractOutside={handlePopupBlur} onEscapeKeyDown={handlePopupBlur}>
          {historyMember && (
            <div className="space-y-4">
              <DialogHeader><DialogTitle className="flex items-center gap-2 text-base font-headline uppercase tracking-tight text-primary"><History className="size-4" /> Payment History</DialogTitle><DialogDescription className="text-[9px] font-bold uppercase tracking-widest truncate">{historyMember.name}</DialogDescription></DialogHeader>
              <div className="max-h-[250px] overflow-y-auto pr-1.5 custom-scrollbar">
                <Table>
                  <TableHeader className="bg-muted/30 sticky top-0"><TableRow><TableHead className="text-[8px] font-black uppercase tracking-widest h-7">Date</TableHead><TableHead className="text-[8px] font-black uppercase tracking-widest h-7">Paid</TableHead><TableHead className="text-[8px] font-black uppercase tracking-widest h-7 text-right">Mode</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {(allPayments || []).filter(p => p.memberId === historyMember.id && (p.status === 'success' || p.status === 'paid')).length > 0 ? (
                      (allPayments || []).filter(p => p.memberId === historyMember.id && (p.status === 'success' || p.status === 'paid')).map((p, i) => (
                        <TableRow key={i} className="hover:bg-muted/5 transition-colors border-b last:border-none">
                          <TableCell className="text-[10px] font-bold tabular-nums py-2">{getPaymentDateStr(p) ? format(parseISO(getPaymentDateStr(p)!), 'dd-MM-yyyy') : '-'}</TableCell>
                          <TableCell className="text-[10px] font-black text-emerald-600 tabular-nums py-2">₹{getPaymentAmount(p).toLocaleString()}</TableCell>
                          <TableCell className="text-[8px] font-bold text-muted-foreground text-right uppercase tracking-widest">{p.method || 'Cash'}</TableCell>
                        </TableRow>
                      ))
                    ) : <TableRow><TableCell colSpan={3} className="h-20 text-center text-[8px] font-bold uppercase text-muted-foreground/40 italic">Empty</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </div>
              <DialogFooter className="flex-col sm:flex-row gap-2">
                <Button variant="outline" onClick={() => window.print()} className="w-full sm:flex-1 font-bold h-10 rounded-xl text-xs uppercase tracking-widest gap-2">
                  <Printer className="size-3.5" /> Print Ledger
                </Button>
                <Button onClick={() => setIsHistoryDialogOpen(false)} className="w-full sm:flex-1 font-bold h-10 rounded-xl text-xs uppercase tracking-widest bg-primary hover:bg-primary/90 text-white">Close</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isAddMemberDialogOpen} onOpenChange={(o) => { if(!o) document.body.style.pointerEvents = 'auto'; setIsAddMemberDialogOpen(o); }}>
        <DialogContent className="sm:max-w-[340px]" onOpenAutoFocus={(e) => e.preventDefault()} onInteractOutside={handlePopupBlur} onEscapeKeyDown={handlePopupBlur}>
          <form onSubmit={handleAddMemberToScheme}>
            <DialogHeader><DialogTitle className="text-lg font-headline uppercase tracking-tight text-primary">Register Member</DialogTitle><DialogDescription className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Adding to <span className="text-primary">{currentRound?.name}</span></DialogDescription></DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-1.5"><Label className="text-[9px] font-black uppercase text-muted-foreground">Full Name</Label><Input value={newMember.name} onChange={e => setNewMember({...newMember, name: e.target.value})} required className="h-10 rounded-xl text-sm font-bold border-muted/60" /></div>
              <div className="grid gap-1.5"><Label className="text-[9px] font-black uppercase text-muted-foreground">Phone Number</Label><Input value={newMember.phone} onChange={e => setNewMember({...newMember, phone: e.target.value})} required className="h-10 rounded-xl text-sm font-bold tabular-nums border-muted/60" /></div>
              <div className="grid gap-1.5"><Label className="text-[9px] font-black uppercase text-muted-foreground">Join Date</Label><Input type="date" value={newMember.joinDate} onChange={e => setNewMember({...newMember, joinDate: e.target.value})} required className="h-10 rounded-xl text-sm font-bold border-muted/60" /></div>
              <div className="grid gap-1.5"><Label className="text-[9px] font-black uppercase text-muted-foreground">Payment Mode</Label><Select value={newMember.paymentType} onValueChange={v => setNewMember({...newMember, paymentType: v})}><SelectTrigger className="h-10 rounded-xl text-sm font-bold border-muted/60"><SelectValue placeholder="Inherit" /></SelectTrigger><SelectContent><SelectItem value="Daily">Daily</SelectItem><SelectItem value="Monthly">Monthly</SelectItem></SelectContent></Select></div>
            </div>
            <DialogFooter><Button type="submit" disabled={isActionPending} className="w-full h-11 font-black uppercase tracking-[0.1em] shadow-md bg-primary hover:bg-primary/90 text-white">Complete Registration</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isDailyAuditOpen} onOpenChange={(o) => { if(!o) document.body.style.pointerEvents = 'auto'; setIsDailyAuditOpen(o); }}>
        <DialogContent className="sm:max-w-[620px] rounded-3xl p-0 overflow-hidden border-none shadow-2xl bg-white" onOpenAutoFocus={(e) => e.preventDefault()} onInteractOutside={handlePopupBlur} onEscapeKeyDown={handlePopupBlur}>
          {currentRound && (
            <div className="flex flex-col max-h-[90vh]">
              {/* Header */}
              <div className="bg-primary/5 p-4 text-center border-b border-border/40 shrink-0">
                <DialogTitle className="text-base font-headline uppercase tracking-tight text-primary text-center">Collection Details</DialogTitle>
                <DialogDescription className="sr-only">Detailed collection breakdown by member for the selected date.</DialogDescription>
                <div className="mt-3 flex flex-col items-center justify-center gap-1.5">
                  <Popover open={isAuditDatePickerOpen} onOpenChange={setIsAuditDatePickerOpen} modal={true}>
                    <PopoverTrigger asChild>
                      <div className="flex flex-col items-center justify-center gap-1.5 cursor-pointer">
                        <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-full border shadow-sm hover:bg-muted/5 transition-colors">
                          <CalendarDays className="size-4 text-primary" />
                          <span className="text-xs font-black text-primary uppercase tracking-wider">{isValid(parseISO(auditDate)) ? format(parseISO(auditDate), 'dd MMM yyyy') : auditDate}</span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-1 text-[10px] text-muted-foreground font-medium">
                          <span>Change Date:</span>
                          <div className="relative flex items-center">
                            <Input
                              type="text"
                              readOnly
                              value={isValid(parseISO(auditDate)) ? format(parseISO(auditDate), 'dd MMM yyyy') : auditDate}
                              className="h-6 w-28 pl-6 pr-1 font-bold text-[10px] rounded-md border-muted/40 cursor-pointer text-center bg-white"
                            />
                            <Calendar className="absolute left-1.5 size-3.5 text-primary pointer-events-none" />
                          </div>
                        </div>
                      </div>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-auto p-0"
                      align="center"
                      onPointerDown={(e) => e.stopPropagation()}
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <CalendarPicker
                        mode="single"
                        selected={isValid(parseISO(auditDate)) ? parseISO(auditDate) : undefined}
                        onSelect={(date) => {
                          if (date) {
                            setAuditDate(format(date, 'yyyy-MM-dd'))
                            setIsAuditDatePickerOpen(false)
                          }
                        }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {/* Scrollable Content: Split into two columns */}
              <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4 overflow-y-auto custom-scrollbar flex-1 bg-white">
                {/* Left Section: Paid Members */}
                <div className="flex flex-col h-full bg-emerald-50/20 rounded-2xl border border-emerald-100/50 p-3 min-h-[220px]">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-emerald-600 flex items-center gap-1.5 mb-2 ml-1 pb-1.5 border-b border-emerald-100/30">
                    <CheckCircle2 className="size-3.5" /> Paid Members ({auditDatePayments.length})
                  </h4>
                  <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 max-h-[220px] space-y-1.5">
                    {auditDatePayments.length > 0 ? (
                      auditDatePayments.map((p: any, i: number) => {
                        const pAmt = getPaymentAmount(p);
                        return (
                          <div key={p.id || i} className="flex justify-between items-center bg-white p-2.5 rounded-xl border border-emerald-100/20 shadow-sm">
                            <div className="flex flex-col">
                              <span className="text-xs font-bold text-foreground/80">{p.memberName || 'Unknown Member'}</span>
                              {p.method && <span className="text-[8px] font-bold text-muted-foreground/60 uppercase tracking-widest">{p.method}</span>}
                            </div>
                            <span className="text-xs font-black text-emerald-600 tabular-nums">₹{pAmt.toLocaleString()}</span>
                          </div>
                        );
                      })
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-center p-4">
                        <p className="text-[10px] font-bold uppercase text-muted-foreground/40 italic">No payments recorded</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Section: Pending Members */}
                <div className="flex flex-col h-full bg-amber-50/20 rounded-2xl border border-amber-100/50 p-3 min-h-[220px]">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-amber-600 flex items-center gap-1.5 mb-2 ml-1 pb-1.5 border-b border-amber-100/30">
                    <Clock className="size-3.5" /> Pending Members ({auditDatePendingMembers.length})
                  </h4>
                  <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 max-h-[220px] space-y-1.5">
                    {auditDatePendingMembers.length > 0 ? (
                      auditDatePendingMembers.map((m: any, i: number) => {
                        return (
                          <div key={m.id || i} className="flex justify-between items-center bg-white p-2.5 rounded-xl border border-amber-100/20 shadow-sm">
                            <span className="text-xs font-bold text-foreground/80">{m.name || 'Unknown Member'}</span>
                            <span className="px-2 py-0.5 rounded bg-amber-50 border border-amber-100 text-[8px] font-black text-amber-600 uppercase tracking-wider">Pending</span>
                          </div>
                        );
                      })
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-center p-4">
                        <p className="text-[10px] font-bold uppercase text-muted-foreground/40 italic">No pending members</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Bottom: Total Collection Banner */}
              <div className="p-4 bg-emerald-500 text-white flex items-center justify-between shadow-inner relative overflow-hidden shrink-0">
                <div className="absolute -right-3 -bottom-3 opacity-10">
                  <IndianRupee className="size-16 text-white" />
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-100 z-10">Total Collection</span>
                <p className="text-xl font-black text-white tabular-nums tracking-tight relative z-10">
                  ₹{auditDateTotalCollection.toLocaleString()}
                </p>
              </div>

              {/* Footer */}
              <div className="p-3 bg-muted/10 border-t border-border/40 shrink-0">
                <Button onClick={() => setIsDailyAuditOpen(false)} className="w-full font-black uppercase tracking-widest h-10 rounded-xl shadow-sm text-xs bg-primary hover:bg-primary/90 text-white active:scale-[0.98] transition-all">
                  Close Details
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isQuickPaymentDialogOpen} onOpenChange={(o) => { if(!o) { setSelectedMemberForPayment(null); document.body.style.pointerEvents = 'auto'; } setIsQuickPaymentDialogOpen(o); }}>
        <DialogContent className="sm:max-w-[340px]" onOpenAutoFocus={(e) => e.preventDefault()} onInteractOutside={handlePopupBlur} onEscapeKeyDown={handlePopupBlur}>
          {selectedMemberForPayment && (
            <form onSubmit={handleQuickPayment}>
              <DialogHeader><DialogTitle className="text-lg font-headline uppercase tracking-tight text-primary">Record Payment</DialogTitle><DialogDescription className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Entry for <span className="text-primary">{selectedMemberForPayment.name}</span></DialogDescription></DialogHeader>
              <div className="grid gap-4 py-2">
                <div className="grid gap-1"><Label className="text-[9px] font-black uppercase text-muted-foreground">Amount (₹)</Label><Input type="number" value={paymentData.amount} onChange={e => setPaymentData({...paymentData, amount: Number(e.target.value)})} required className="h-11 text-base font-black text-primary rounded-xl border-muted/60" /></div>
                <div className="grid gap-1"><Label className="text-[9px] font-black uppercase text-muted-foreground">Target Date</Label><Input type="date" value={paymentData.date} onChange={e => setPaymentData({...paymentData, date: e.target.value})} required className="h-10 rounded-xl text-sm font-bold border-muted/60" /></div>
                <div className="grid gap-1"><Label className="text-[9px] font-black uppercase text-muted-foreground">Method</Label><Select value={paymentData.method} onValueChange={(v) => setPaymentData({...paymentData, method: v})}><SelectTrigger className="h-10 rounded-xl text-sm font-bold border-muted/60"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Cash">Cash</SelectItem><SelectItem value="UPI">UPI</SelectItem></SelectContent></Select></div>
              </div>
              <DialogFooter><Button type="submit" disabled={isActionPending} className="w-full h-11 font-black uppercase tracking-[0.1em] bg-emerald-600 hover:bg-emerald-700 shadow-sm active:scale-[0.98] transition-all text-xs text-white">{isActionPending ? <Loader2 className="size-3 mr-2 animate-spin" /> : <CheckCircle2 className="size-3 mr-2" />}Confirm Entry</Button></DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isExpiryPopupOpen} onOpenChange={setIsExpiryPopupOpen}>
        <DialogContent className="sm:max-w-[420px] rounded-[2.5rem] p-0 overflow-hidden border-none shadow-2xl">
          <div className="flex flex-col bg-white">
            <div className="bg-destructive/5 p-10 text-center relative border-b border-border/40">
              <DialogTitle className="sr-only">Cycle Expired Notification</DialogTitle>
              <div className="mx-auto mb-6 w-20 h-20 rounded-[2.5rem] bg-white text-destructive flex items-center justify-center shadow-lg ring-8 ring-destructive/5">
                <AlertCircle className="size-10 animate-pulse" />
              </div>
              <h3 className="text-2xl font-black uppercase tracking-tight text-primary leading-tight">Registry Notice</h3>
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-destructive/60 mt-2">Operational Window Closed</p>
            </div>

            <div className="p-8 space-y-8">
              <div className="space-y-4">
                <div className="p-5 rounded-3xl bg-muted/30 border border-border/40 flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/70">Cycle End Date</p>
                    <p className="text-base font-black text-primary tabular-nums">
                      {currentActiveCycle?.endDate ? format(parseISO(currentActiveCycle.endDate), 'dd-MM-yyyy') : '-'}
                    </p>
                  </div>
                  <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                    <Clock className="size-5" />
                  </div>
                </div>

                <div className="p-6 rounded-3xl bg-emerald-50 border border-emerald-100/50 flex flex-col items-center gap-3 text-center">
                  <div className="h-12 w-12 rounded-2xl bg-white text-emerald-600 flex items-center justify-center shadow-md shadow-emerald-200/50 ring-4 ring-emerald-500/5">
                    <CalendarDays className="size-6" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-emerald-700/70">Visual Guidance</p>
                    <p className="text-[11px] font-bold text-emerald-800/80 leading-relaxed max-w-[220px]">
                      Use the <span className="text-emerald-600 font-black">Calendar Icon</span> on the dashboard card to manage or complete the cycle.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <Button 
                  onClick={() => { setSelectedChitId(null); setIsExpiryPopupOpen(false); }}
                  className="w-full h-14 rounded-2xl font-black uppercase tracking-[0.15em] shadow-xl shadow-primary/20 bg-primary hover:bg-primary/90 text-white text-xs active:scale-[0.98] transition-all"
                >
                  Return to Dashboard
                </Button>
                <Button 
                  variant="ghost" 
                  onClick={() => setIsExpiryPopupOpen(false)}
                  className="w-full h-10 font-bold uppercase tracking-widest text-[9px] text-muted-foreground hover:bg-muted rounded-xl"
                >
                  Dismiss & View Records
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {historyMember && (
        <div id="thermal-receipt" className="hidden">
          <div style={{ textAlign: 'center', marginBottom: '10px', borderBottom: '1px dashed black', paddingBottom: '10px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 'bold', margin: '0' }}>PAYMENT HISTORY</h2>
            <p style={{ fontSize: '10px', margin: '2px 0' }}>ChitFund Pro Management 2026</p>
          </div>
          <div style={{ marginBottom: '10px', fontSize: '12px' }}>
            <p style={{ margin: '2px 0' }}><strong>Member:</strong> {historyMember.name}</p>
            <p style={{ margin: '2px 0' }}><strong>Group:</strong> {historyMember.chitGroup}</p>
            <p style={{ margin: '2px 0' }}><strong>Generated:</strong> {format(new Date(), 'dd-MM-yyyy HH:mm')}</p>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid black' }}>
                <th style={{ textAlign: 'left', padding: '4px 0' }}>DATE</th>
                <th style={{ textAlign: 'right', padding: '4px 0' }}>AMOUNT</th>
              </tr>
            </thead>
            <tbody>
              {(allPayments || [])
                .filter(p => p.memberId === historyMember.id && (p.status === 'success' || p.status === 'paid'))
                .map((p, i) => (
                  <tr key={i} style={{ borderBottom: '1px dashed #eee' }}>
                    <td style={{ padding: '4px 0' }}>{getPaymentDateStr(p) ? format(parseISO(getPaymentDateStr(p)!), 'dd-MM-yyyy') : '-'}</td>
                    <td style={{ textAlign: 'right', padding: '4px 0' }}>₹{getPaymentAmount(p).toLocaleString()}</td>
                  </tr>
                ))}
            </tbody>
          </table>
          <div style={{ marginTop: '10px', borderTop: '1px solid black', paddingTop: '10px', textAlign: 'right' }}>
            <p style={{ fontSize: '14px', fontWeight: 'bold' }}>TOTAL: ₹{(totalPaidByMember.get(historyMember.id) || 0).toLocaleString()}</p>
          </div>
          <div style={{ marginTop: '20px', textAlign: 'center', fontSize: '10px' }}>
            <p>*** Thank You ***</p>
          </div>
        </div>
      )}
    </div>
  )
}
