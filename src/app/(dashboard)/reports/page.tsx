
"use client"

import { useState, useEffect, useMemo } from "react"
import { Download, Printer, Loader2, Database, Filter, CheckCircle2, Clock, Trophy, Users, IndianRupee, TrendingUp, Calendar, Pencil, Lock, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { useFirestore, useCollection, useMemoFirebase, useDoc, useUser } from "@/firebase"
import { collection, query, orderBy, doc, setDoc, deleteDoc, serverTimestamp } from "firebase/firestore"
import { format, parseISO, getMonth, getYear, subDays, isBefore, startOfDay } from "date-fns"
import * as XLSX from 'xlsx'
import { cn, withTimeout } from "@/lib/utils"
import { createAuditLog } from "@/firebase/logging"

const MONTHS_MASTER = [
  { value: "all", label: "All Months" },
  { value: "0", label: "January" },
  { value: "1", label: "February" },
  { value: "2", label: "March" },
  { value: "3", label: "April" },
  { value: "4", label: "May" },
  { value: "5", label: "June" },
  { value: "6", label: "July" },
  { value: "7", label: "August" },
  { value: "8", label: "September" },
  { value: "9", label: "October" },
  { value: "10", label: "November" },
  { value: "11", label: "December" },
]

const YEARS = ["2024", "2025", "2026", "2027", "2028"]

export default function ReportsPage() {
  const [mounted, setMounted] = useState(false)
  const [reportType, setReportType] = useState("all")
  const [selectedMonth, setSelectedMonth] = useState<string>("all")
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString())
  const [activeTab, setActiveTab] = useState("collections")
  
  const [targetInput, setTargetInput] = useState<string>("")
  const [isActionPending, setIsActionPending] = useState(false)
  const [isTargetDialogOpen, setIsTargetDialogOpen] = useState(false)
  
  const { toast } = useToast()
  const db = useFirestore()
  const { user } = useUser()

  const membersQuery = useMemoFirebase(() => collection(db, 'members'), [db])
  const { data: members, isLoading: membersLoading } = useCollection(membersQuery)

  const paymentsQuery = useMemoFirebase(() => query(collection(db, 'payments'), orderBy('paymentDate', 'desc')), [db])
  const { data: payments, isLoading: paymentsLoading } = useCollection(paymentsQuery)

  const roundsQuery = useMemoFirebase(() => query(collection(db, 'chitRounds'), orderBy('createdAt', 'desc')), [db])
  const { data: rounds, isLoading: roundsLoading } = useCollection(roundsQuery)

  const targetId = `${selectedYear}-${selectedMonth}`
  const targetDocRef = useMemoFirebase(() => 
    selectedMonth !== 'all' ? doc(db, 'monthlyTargets', targetId) : null, 
    [db, selectedYear, selectedMonth, targetId]
  )
  const { data: targetData } = useDoc(targetDocRef)

  const locksQuery = useMemoFirebase(() => collection(db, 'monthLocks'), [db]);
  const { data: monthLocks } = useCollection(locksQuery);

  const currentMonthName = useMemo(() => MONTHS_MASTER.find(m => m.value === selectedMonth)?.label, [selectedMonth]);
  const isMonthLocked = useMemo(() => {
    if (selectedMonth === 'all' || !monthLocks) return false;
    return monthLocks.some(l => l.year === selectedYear && l.monthName === currentMonthName);
  }, [monthLocks, selectedYear, currentMonthName, selectedMonth]);

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (isTargetDialogOpen) {
      setTargetInput(targetData?.targetAmount?.toString() || "")
    }
  }, [isTargetDialogOpen, targetData])

  const handleSaveTarget = async () => {
    if (!selectedMonth || selectedMonth === 'all' || !targetInput) {
      toast({ variant: "destructive", title: "Validation Error", description: "Select a specific month and amount." })
      return
    }

    if (isMonthLocked) {
      toast({ variant: "destructive", title: "Locked", description: "Cannot modify target for a locked month." });
      return;
    }

    setIsActionPending(true)
    try {
      const amount = parseFloat(targetInput)
      if (isNaN(amount)) throw new Error("Invalid amount")

      await withTimeout(setDoc(doc(db, 'monthlyTargets', targetId), {
        id: targetId,
        year: selectedYear,
        month: selectedMonth,
        targetAmount: amount
      }, { merge: true }));

      await createAuditLog(db, user, `Updated collection target for ${currentMonthName} ${selectedYear} to ₹${amount.toLocaleString()}`)
      
      setIsTargetDialogOpen(false)
      toast({ title: "Target Saved", description: `Collection goal updated.` })
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message || "Failed to save target." })
    } finally {
      setIsActionPending(false)
    }
  }

  const toggleMonthLock = async () => {
    if (selectedMonth === 'all') return;
    
    setIsActionPending(true);
    try {
      const lockId = `${selectedYear}-${currentMonthName}`;
      if (isMonthLocked) {
        const lockRef = doc(db, 'monthLocks', lockId);
        await withTimeout(deleteDoc(lockRef));
        await createAuditLog(db, user, `Unlocked month: ${currentMonthName} ${selectedYear}`);
        toast({ title: "Month Unlocked", description: "Records can now be modified." });
      } else {
        await withTimeout(setDoc(doc(db, 'monthLocks', lockId), {
          id: lockId,
          year: selectedYear,
          monthName: currentMonthName,
          lockedAt: serverTimestamp(),
          lockedBy: user?.email
        }));
        await createAuditLog(db, user, `Locked month: ${currentMonthName} ${selectedYear}`);
        toast({ title: "Month Locked", description: "Financial records are now read-only." });
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message || "Operation failed." });
    } finally {
      setIsActionPending(false);
    }
  }

  const availableMonths = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const selectedYearNum = parseInt(selectedYear);

    if (selectedYearNum < currentYear) {
      return MONTHS_MASTER;
    } else if (selectedYearNum === currentYear) {
      return MONTHS_MASTER.filter(m => m.value === "all" || parseInt(m.value) <= currentMonth);
    } else {
      return MONTHS_MASTER.filter(m => m.value === "all");
    }
  }, [selectedYear]);

  const filteredData = useMemo(() => {
    if (!mounted || !members || !payments || !rounds) return null;
    
    let targetMembers = members;
    if (reportType !== "all") {
      targetMembers = members.filter(m => {
        const round = rounds.find(r => r.name === m.chitGroup);
        return (round?.collectionType || "Monthly").toLowerCase() === reportType;
      });
    }
    const targetIds = new Set(targetMembers.map(m => m.id));

    const isMatchingDate = (dateStr: string) => {
      if (!dateStr) return false;
      const d = parseISO(dateStr);
      const matchYear = getYear(d).toString() === selectedYear;
      const matchMonth = selectedMonth === "all" || getMonth(d).toString() === selectedMonth;
      return matchYear && matchMonth;
    };

    const periodMembers = targetMembers.filter(m => m.joinDate && isMatchingDate(m.joinDate));
    const periodPayments = payments.filter(p => (p.status === 'paid' || p.status === 'success') && targetIds.has(p.memberId) && p.paymentDate && isMatchingDate(p.paymentDate));

    const totalCollected = periodPayments.reduce((acc, p) => acc + (p.amountPaid || 0), 0);
    const membersJoined = periodMembers.length;

    const collectionDataByMonth = Array.from({ length: 12 }).map((_, i) => {
      const monthPayments = payments.filter(p => {
        const d = parseISO(p.paymentDate);
        return (p.status === 'paid' || p.status === 'success') && targetIds.has(p.memberId) && getYear(d).toString() === selectedYear && getMonth(d) === i;
      });
      return {
        month: format(new Date(Number(selectedYear), i), 'MMMM yyyy'),
        amount: monthPayments.reduce((acc, p) => acc + (p.amountPaid || 0), 0)
      };
    }).filter(row => {
      const isMonthAll = selectedMonth === "all";
      const monthLabel = MONTHS_MASTER.find(m => m.value === selectedMonth)?.label || "";
      return isMonthAll ? row.amount > 0 : row.month.startsWith(monthLabel);
    });

    const winners = rounds.filter(r => r.winnerName && 
      (reportType === "all" || (r.collectionType || "Monthly").toLowerCase() === reportType) &&
      (r.date && isMatchingDate(r.date))
    );

    // DAILY STATUS AUDIT (Yesterday vs Today)
    const today = new Date();
    const yesterday = subDays(today, 1);
    const todayStr = format(today, 'yyyy-MM-dd');
    const yesterdayStr = format(yesterday, 'yyyy-MM-dd');

    const activeAt = (m: any, d: Date) => {
      if (!m.joinDate) return true;
      const joined = startOfDay(parseISO(m.joinDate));
      return joined <= startOfDay(d);
    };

    const getUnpaid = (dateStr: string, refDate: Date) => {
      return targetMembers.filter(m => {
        if (m.status === 'inactive') return false;
        if (!activeAt(m, refDate)) return false;
        
        const hasPaid = payments.some(p => 
          p.memberId === m.id && 
          (p.status === 'paid' || p.status === 'success') && 
          (p.targetDate === dateStr || (p.paymentDate && format(parseISO(p.paymentDate), 'yyyy-MM-dd') === dateStr))
        );
        return !hasPaid;
      });
    };

    const unpaidToday = getUnpaid(todayStr, today);
    const unpaidYesterday = getUnpaid(yesterdayStr, yesterday);

    return { 
      collectionData: collectionDataByMonth, 
      targetMembers,
      winners,
      unpaidToday,
      unpaidYesterday,
      metrics: {
        totalCollected,
        membersJoined,
        paymentsCount: periodPayments.length
      }
    };
  }, [mounted, reportType, selectedMonth, selectedYear, members, payments, rounds]);

  const handlePrint = () => window.print();

  const handleExportExcel = () => {
    if (!filteredData) return;
    let exportData: any[] = [];
    const fileName = `Report_${selectedYear}_${selectedMonth === 'all' ? 'Year' : currentMonthName}.xlsx`;

    switch (activeTab) {
      case "collections": exportData = filteredData.collectionData.map(d => ({ Period: d.month, Amount: d.amount })); break;
      case "members": exportData = filteredData.targetMembers.map(m => ({ Name: m.name, Scheme: m.chitGroup, Amount: m.monthlyAmount, Status: m.status })); break;
      case "winners": exportData = filteredData.winners.map(w => ({ Winner: w.winnerName, Scheme: w.name, Round: w.roundNumber, WinningAmount: w.winningAmount })); break;
      case "daily-audit": exportData = [
        ...filteredData.unpaidYesterday.map(m => ({ Day: "Yesterday", Member: m.name, Group: m.chitGroup, Status: "Unpaid" })),
        ...filteredData.unpaidToday.map(m => ({ Day: "Today", Member: m.name, Group: m.chitGroup, Status: "Unpaid" }))
      ]; break;
    }

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Report");
    XLSX.writeFile(wb, fileName);
    toast({ title: "Export Successful" });
  };

  if (!mounted || membersLoading || paymentsLoading || roundsLoading) {
    return (<div className="flex h-[60vh] items-center justify-center"><Loader2 className="size-8 animate-spin text-primary" /></div>)
  }

  const targetAmount = targetData?.targetAmount || 0
  const reachPercentage = targetAmount > 0 ? Math.round((filteredData!.metrics.totalCollected / targetAmount) * 100) : 0

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-500 pb-10 overflow-x-hidden print:p-0">
      <div className="flex flex-col gap-6 print:hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-2xl sm:text-3xl font-headline font-bold tracking-tight text-primary">Financial Reports</h2>
            <p className="text-sm text-muted-foreground">Comprehensive audit of fund collections and distributions.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
             {selectedMonth !== 'all' && (
               <Button 
                 variant={isMonthLocked ? "secondary" : "outline"} 
                 size="sm" 
                 className={cn("h-10 px-4 text-[10px] font-bold uppercase tracking-widest shadow-sm", isMonthLocked && "text-amber-700 bg-amber-50")}
                 onClick={toggleMonthLock}
                 disabled={isActionPending}
               >
                 {isMonthLocked ? <Lock className="mr-2 size-4" /> : <Clock className="mr-2 size-4" />}
                 {isMonthLocked ? "Unlock Month" : "Lock Month"}
               </Button>
             )}
             <Button variant="outline" size="sm" className="h-10 px-4 text-[10px] font-bold uppercase tracking-widest shadow-sm" onClick={handlePrint} disabled={isActionPending}>
               <Printer className="mr-2 size-4" /> Print
             </Button>
             <Button size="sm" className="h-10 px-4 text-[10px] font-bold uppercase tracking-widest shadow-md" onClick={handleExportExcel} disabled={isActionPending}>
               <Download className="mr-2 size-4" /> Export Excel
             </Button>
          </div>
        </div>

        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 bg-card p-4 rounded-xl border border-border/50 shadow-sm items-end">
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">Scheme Filter</label>
            <Select value={reportType} onValueChange={setReportType} disabled={isActionPending}>
              <SelectTrigger className="w-full h-10 text-[11px] font-bold"><Filter className="mr-2 size-3.5 text-primary" /><SelectValue placeholder="Scheme Type" /></SelectTrigger>
              <SelectContent><SelectItem value="all">All Schemes</SelectItem><SelectItem value="daily">Daily Only</SelectItem><SelectItem value="monthly">Monthly Only</SelectItem></SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">Report Month</label>
            <Select value={selectedMonth} onValueChange={setSelectedMonth} disabled={isActionPending}>
              <SelectTrigger className="w-full h-10 text-[11px] font-bold"><Calendar className="mr-2 size-3.5 text-primary" /><SelectValue placeholder="Month" /></SelectTrigger>
              <SelectContent>{availableMonths.map(m => (<SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>))}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">Report Year</label>
            <Select value={selectedYear} onValueChange={setSelectedYear} disabled={isActionPending}>
              <SelectTrigger className="w-full h-10 text-[11px] font-bold"><Calendar className="mr-2 size-3.5 text-primary" /><SelectValue placeholder="Year" /></SelectTrigger>
              <SelectContent>{YEARS.map(y => (<SelectItem key={y} value={y}>{y}</SelectItem>))}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">Month Status</label>
            <div className="flex items-center gap-1.5 h-10">
              <div className={cn("flex-1 flex items-center justify-between px-2.5 h-full rounded-md border", isMonthLocked ? "bg-amber-50 border-amber-200" : "bg-emerald-50 border-emerald-200")}>
                <span className={cn("text-[10px] font-bold uppercase tracking-tight", isMonthLocked ? "text-amber-700" : "text-emerald-700")}>
                  {selectedMonth === 'all' ? "Select Month" : (isMonthLocked ? "LOCKED 🔒" : "ACTIVE ✨")}
                </span>
                {selectedMonth !== 'all' && !isMonthLocked && (
                  <Button variant="ghost" size="icon" onClick={() => setIsTargetDialogOpen(true)} className="h-6 w-6 text-emerald-600 hover:bg-emerald-100" disabled={isActionPending}><Pencil className="size-3" /></Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={isTargetDialogOpen} onOpenChange={(open) => { if(!isActionPending) setIsTargetDialogOpen(open) }}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader><DialogTitle>Update Monthly Target</DialogTitle><DialogDescription>Set a goal for {currentMonthName} {selectedYear}.</DialogDescription></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2"><Label htmlFor="targetAmount">Target Amount (₹)</Label><Input id="targetAmount" type="number" value={targetInput} onChange={(e) => setTargetInput(e.target.value)} className="font-bold" autoFocus disabled={isActionPending} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setIsTargetDialogOpen(false)} disabled={isActionPending}>Cancel</Button><Button onClick={handleSaveTarget} disabled={isActionPending}>{isActionPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}Save Target</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0"><CardTitle className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Period Collections</CardTitle><IndianRupee className="size-4 text-emerald-600" /></CardHeader>
          <CardContent><div className="text-2xl font-bold text-emerald-600">₹{filteredData!.metrics.totalCollected.toLocaleString()}</div><p className="text-[10px] text-muted-foreground mt-1 font-medium">{filteredData!.metrics.paymentsCount} Transactions</p></CardContent>
        </Card>
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0"><CardTitle className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">New Members Joined</CardTitle><Users className="size-4 text-primary" /></CardHeader>
          <CardContent><div className="text-2xl font-bold">{filteredData!.metrics.membersJoined}</div><p className="text-[10px] text-muted-foreground mt-1 font-medium">During selected period</p></CardContent>
        </Card>
        <Card className="border-border/50 shadow-sm overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0"><CardTitle className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Target Reach</CardTitle><TrendingUp className={cn("size-4", reachPercentage >= 100 ? "text-emerald-500" : "text-blue-500")} /></CardHeader>
          <CardContent>
            <div className={cn("text-2xl font-bold", reachPercentage >= 100 ? "text-emerald-600" : "text-blue-600")}>{selectedMonth === 'all' ? <span className="text-xs uppercase text-muted-foreground">Select Month</span> : `${reachPercentage}%`}</div>
            <p className="text-[10px] text-muted-foreground mt-1 font-medium">{targetAmount > 0 ? `Goal: ₹${targetAmount.toLocaleString()}` : "No goal defined"}</p>
            {targetAmount > 0 && (<div className="w-full bg-muted h-1 rounded-full mt-2 overflow-hidden"><div className={cn("h-full transition-all duration-1000", reachPercentage >= 100 ? "bg-emerald-500" : "bg-blue-500")} style={{ width: `${Math.min(reachPercentage, 100)}%` }} /></div>)}
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 lg:grid-cols-4 h-auto p-1 bg-muted/50 border rounded-xl overflow-x-auto print:hidden">
          <TabsTrigger value="collections" className="py-3 text-[10px] font-bold uppercase tracking-widest">Collections</TabsTrigger>
          <TabsTrigger value="members" className="py-3 text-[10px] font-bold uppercase tracking-widest">Members</TabsTrigger>
          <TabsTrigger value="winners" className="py-3 text-[10px] font-bold uppercase tracking-widest">Winners</TabsTrigger>
          <TabsTrigger value="daily-audit" className="py-3 text-[10px] font-bold uppercase tracking-widest">Daily Status</TabsTrigger>
        </TabsList>
        
        <TabsContent value="collections" className="mt-8">
          <Card className="border-border/50 overflow-hidden shadow-sm">
            <div className="p-4 border-b bg-muted/20"><h3 className="text-xs font-bold uppercase tracking-widest flex items-center gap-2"><Database className="size-4 text-primary" /> Monthly Revenue Breakdown</h3></div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/30"><TableRow><TableHead className="text-[10px] uppercase font-bold tracking-widest h-12 pl-6">Period</TableHead><TableHead className="text-right text-[10px] uppercase font-bold tracking-widest h-12 pr-6">Total Collection</TableHead></TableRow></TableHeader>
                <TableBody>
                  {filteredData!.collectionData.length > 0 ? filteredData!.collectionData.map((row, i) => (<TableRow key={i} className="hover:bg-muted/5 transition-colors h-14"><TableCell className="font-bold text-sm pl-6">{row.month}</TableCell><TableCell className="text-right font-bold text-emerald-600 text-sm tabular-nums pr-6">₹{row.amount.toLocaleString()}</TableCell></TableRow>)) : (<TableRow><TableCell colSpan={2} className="h-40 text-center text-muted-foreground italic text-sm">No collections found.</TableCell></TableRow>)}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="members" className="mt-8">
          <Card className="border-border/50 overflow-hidden shadow-sm">
            <div className="p-4 border-b bg-muted/20"><h3 className="text-xs font-bold uppercase tracking-widest flex items-center gap-2"><Users className="size-4 text-primary" /> Member Directory View</h3></div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/30"><TableRow><TableHead className="text-[10px] uppercase font-bold tracking-widest h-12 pl-6">Member Name</TableHead><TableHead className="text-[10px] uppercase font-bold tracking-widest h-12">Scheme</TableHead><TableHead className="text-right text-[10px] uppercase font-bold tracking-widest h-12">Monthly Due</TableHead><TableHead className="text-center text-[10px] uppercase font-bold tracking-widest h-12 pr-6">Status</TableHead></TableRow></TableHeader>
                <TableBody>
                  {filteredData!.targetMembers.length > 0 ? filteredData!.targetMembers.map((m, i) => (<TableRow key={i} className="hover:bg-muted/5 transition-colors h-14"><TableCell className="font-bold text-sm pl-6">{m.name}</TableCell><TableCell className="text-[10px] font-bold text-primary uppercase">{m.chitGroup || "N/A"}</TableCell><TableCell className="text-right font-bold text-sm tabular-nums">₹{m.monthlyAmount?.toLocaleString()}</TableCell><TableCell className="text-center pr-6"><Badge variant={m.status === 'active' ? 'default' : 'secondary'} className="text-[8px] font-bold uppercase">{m.status}</Badge></TableCell></TableRow>)) : (<TableRow><TableCell colSpan={4} className="h-40 text-center text-muted-foreground italic text-sm">No member data found.</TableCell></TableRow>)}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="winners" className="mt-8">
          <Card className="border-border/50 overflow-hidden shadow-sm">
            <div className="p-4 border-b bg-muted/20"><h3 className="text-xs font-bold uppercase tracking-widest flex items-center gap-2"><Trophy className="size-4 text-amber-500" /> Auction History Breakdown</h3></div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/30"><TableRow><TableHead className="text-[10px] uppercase font-bold tracking-widest h-12 pl-6">Winner Name</TableHead><TableHead className="text-[10px] uppercase font-bold tracking-widest h-12">Scheme</TableHead><TableHead className="text-right text-[10px] uppercase font-bold tracking-widest h-12 pr-6">Winning Amount</TableHead></TableRow></TableHeader>
                <TableBody>
                  {filteredData!.winners.length > 0 ? filteredData!.winners.map((r, i) => (<TableRow key={i} className="hover:bg-muted/5 transition-colors h-14"><TableCell className="font-bold text-sm pl-6">{r.winnerName}</TableCell><TableCell className="text-[10px] font-bold text-primary uppercase">{r.name}</TableCell><TableCell className="text-right font-bold text-emerald-600 text-sm tabular-nums pr-6">₹{r.winningAmount?.toLocaleString()}</TableCell></TableRow>)) : (<TableRow><TableCell colSpan={3} className="h-40 text-center text-muted-foreground italic text-sm">No winners recorded.</TableCell></TableRow>)}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="daily-audit" className="mt-8">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="border-border/50 overflow-hidden shadow-sm">
              <div className="p-4 border-b bg-amber-50/50 flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-widest flex items-center gap-2 text-amber-700">
                  <AlertCircle className="size-4" /> Unpaid Yesterday
                </h3>
                <Badge variant="outline" className="text-[10px] font-bold border-amber-200 text-amber-700">
                  {filteredData!.unpaidYesterday.length} Members
                </Badge>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow>
                      <TableHead className="text-[10px] uppercase font-bold tracking-widest h-10 pl-6">Member</TableHead>
                      <TableHead className="text-[10px] uppercase font-bold tracking-widest h-10 pr-6 text-right">Group</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredData!.unpaidYesterday.length > 0 ? filteredData!.unpaidYesterday.map((m, i) => (
                      <TableRow key={i} className="hover:bg-muted/5 transition-colors h-12">
                        <TableCell className="font-semibold text-sm pl-6">{m.name}</TableCell>
                        <TableCell className="text-right text-[10px] font-bold text-primary uppercase pr-6">{m.chitGroup}</TableCell>
                      </TableRow>
                    )) : (
                      <TableRow>
                        <TableCell colSpan={2} className="h-32 text-center text-muted-foreground italic text-xs">
                          All payments cleared for yesterday.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </Card>

            <Card className="border-border/50 overflow-hidden shadow-sm">
              <div className="p-4 border-b bg-blue-50/50 flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-widest flex items-center gap-2 text-blue-700">
                  <Clock className="size-4" /> Unpaid Today
                </h3>
                <Badge variant="outline" className="text-[10px] font-bold border-blue-200 text-blue-700">
                  {filteredData!.unpaidToday.length} Members
                </Badge>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow>
                      <TableHead className="text-[10px] uppercase font-bold tracking-widest h-10 pl-6">Member</TableHead>
                      <TableHead className="text-[10px] uppercase font-bold tracking-widest h-10 pr-6 text-right">Group</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredData!.unpaidToday.length > 0 ? filteredData!.unpaidToday.map((m, i) => (
                      <TableRow key={i} className="hover:bg-muted/5 transition-colors h-12">
                        <TableCell className="font-semibold text-sm pl-6">{m.name}</TableCell>
                        <TableCell className="text-right text-[10px] font-bold text-primary uppercase pr-6">{m.chitGroup}</TableCell>
                      </TableRow>
                    )) : (
                      <TableRow>
                        <TableCell colSpan={2} className="h-32 text-center text-muted-foreground italic text-xs">
                          All payments cleared for today.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
