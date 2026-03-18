
"use client"

import { useState, useEffect, useMemo } from "react"
import { Download, Printer, Loader2, Database, Filter, CheckCircle2, Clock, Users, IndianRupee, TrendingUp, Calendar, Lock, AlertCircle, LayoutList, FileText, LayoutDashboard, History, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { useToast } from "@/hooks/use-toast"
import { useFirestore, useCollection, useMemoFirebase, useUser } from "@/firebase"
import { collection, query, orderBy, doc, setDoc, deleteDoc, serverTimestamp } from "firebase/firestore"
import { format, parseISO, getMonth, getYear, subDays, startOfDay, isSameDay } from "date-fns"
import * as XLSX from 'xlsx'
import { cn, withTimeout } from "@/lib/utils"
import { createAuditLog } from "@/firebase/logging"

const MONTHS_MASTER = [
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
  const [reportType, setReportType] = useState("daily")
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().getMonth().toString())
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString())
  const [activeTab, setActiveTab] = useState("collections")
  const [isActionPending, setIsActionPending] = useState(false)
  
  const [isPrintDialogOpen, setIsPrintDialogOpen] = useState(false)
  const [printReportType, setPrintReportType] = useState<'daily' | 'monthly'>('daily')
  
  const { toast } = useToast()
  const db = useFirestore()
  const { user } = useUser()

  const membersQuery = useMemoFirebase(() => collection(db, 'members'), [db])
  const { data: members, isLoading: membersLoading } = useCollection(membersQuery)

  const paymentsQuery = useMemoFirebase(() => query(collection(db, 'payments'), orderBy('paymentDate', 'desc')), [db])
  const { data: payments, isLoading: paymentsLoading } = useCollection(paymentsQuery)

  const roundsQuery = useMemoFirebase(() => query(collection(db, 'chitRounds'), orderBy('createdAt', 'desc')), [db])
  const { data: rounds, isLoading: roundsLoading } = useCollection(roundsQuery)

  const locksQuery = useMemoFirebase(() => collection(db, 'monthLocks'), [db]);
  const { data: monthLocks } = useCollection(locksQuery);

  const currentMonthName = useMemo(() => MONTHS_MASTER.find(m => m.value === selectedMonth)?.label, [selectedMonth]);
  const isMonthLocked = useMemo(() => {
    if (!monthLocks) return false;
    return monthLocks.some(l => l.year === selectedYear && l.monthName === currentMonthName);
  }, [monthLocks, selectedYear, currentMonthName]);

  useEffect(() => { setMounted(true) }, [])

  const toggleMonthLock = async () => {
    setIsActionPending(true);
    try {
      const lockId = `${selectedYear}-${currentMonthName}`;
      if (isMonthLocked) {
        const lockRef = doc(db, 'monthLocks', lockId);
        await withTimeout(deleteDoc(lockRef));
        await createAuditLog(db, user, `Unlocked month: ${currentMonthName} ${selectedYear}`);
        toast({ title: "Month Unlocked" });
      } else {
        await withTimeout(setDoc(doc(db, 'monthLocks', lockId), {
          id: lockId,
          year: selectedYear,
          monthName: currentMonthName,
          lockedAt: serverTimestamp(),
          lockedBy: user?.email
        }));
        await createAuditLog(db, user, `Locked month: ${currentMonthName} ${selectedYear}`);
        toast({ title: "Month Locked" });
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message });
    } finally {
      setIsActionPending(false);
    }
  }

  const filteredData = useMemo(() => {
    if (!mounted || !members || !payments || !rounds) return null;
    
    const targetMembers = members.filter(m => {
      if (m.status === 'inactive') return false;
      const round = rounds.find(r => r.name === m.chitGroup);
      const schemeType = (m.paymentType || round?.collectionType || "Monthly").toLowerCase();
      return schemeType === reportType;
    });
    const targetIds = new Set(targetMembers.map(m => m.id));

    const dailyMembers = members.filter(m => {
        if (m.status === 'inactive') return false;
        const round = rounds.find(r => r.name === m.chitGroup);
        return (m.paymentType || round?.collectionType || "Monthly") === 'Daily';
    });

    const isMatchingPeriod = (dateStr: string) => {
      if (!dateStr) return false;
      const d = parseISO(dateStr);
      const matchYear = getYear(d).toString() === selectedYear;
      const matchMonth = getMonth(d).toString() === selectedMonth;
      return matchYear && matchMonth;
    };

    const periodPayments = payments.filter(p => 
      (p.status === 'paid' || p.status === 'success') && 
      targetIds.has(p.memberId) && 
      p.paymentDate && 
      isMatchingPeriod(p.paymentDate)
    );

    const today = new Date();
    const todayStr = format(today, 'yyyy-MM-dd');
    const yesterday = subDays(today, 1);
    const yesterdayStr = format(yesterday, 'yyyy-MM-dd');

    const todayPayments = payments.filter(p => 
      (p.status === 'paid' || p.status === 'success') && 
      targetIds.has(p.memberId) &&
      p.paymentDate && 
      isSameDay(parseISO(p.paymentDate), today)
    );

    const todayCollection = todayPayments.reduce((acc, p) => acc + (p.amountPaid || 0), 0);
    
    const getUnpaidDailyForDate = (dateStr: string) => {
      return dailyMembers.filter(m => {
        const hasPaid = payments.some(p => 
          p.memberId === m.id && 
          (p.status === 'paid' || p.status === 'success') && 
          (p.targetDate === dateStr || (p.paymentDate && format(parseISO(p.paymentDate), 'yyyy-MM-dd') === dateStr))
        );
        return !hasPaid;
      });
    };

    const unpaidTodayDaily = getUnpaidDailyForDate(todayStr);
    const unpaidYesterdayDaily = getUnpaidDailyForDate(yesterdayStr);

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
      const monthLabel = MONTHS_MASTER.find(m => m.value === selectedMonth)?.label || "";
      return row.month.startsWith(monthLabel);
    });

    return { 
      collectionData: collectionDataByMonth, 
      targetMembers,
      unpaidTodayDaily,
      unpaidYesterdayDaily,
      todayStats: {
        collection: todayCollection,
        txCount: todayPayments.length,
        pendingCount: unpaidTodayDaily.length
      },
      metrics: {
        totalCollected: periodPayments.reduce((acc, p) => acc + (p.amountPaid || 0), 0),
        txCount: periodPayments.length,
        membersCount: targetMembers.length
      }
    };
  }, [mounted, reportType, selectedMonth, selectedYear, members, payments, rounds]);

  const handleOpenPrintDialog = () => {
    setPrintReportType('daily');
    setIsPrintDialogOpen(true);
  };

  const handleExecutePrint = () => {
    setIsPrintDialogOpen(false);
    setTimeout(() => {
      window.print();
    }, 300);
  };

  const handleExportExcel = () => {
    if (!filteredData) return;
    let exportData: any[] = [];
    const fileName = `Report_${reportType.toUpperCase()}_${selectedYear}_${currentMonthName}.xlsx`;

    switch (activeTab) {
      case "collections": exportData = filteredData.collectionData.map(d => ({ Period: d.month, Amount: d.amount })); break;
      case "yesterday-pending": exportData = filteredData.unpaidYesterdayDaily.map(m => ({ Member: m.name, Group: m.chitGroup, PendingDays: m.pendingDays || 0, Status: "Unpaid" })); break;
      case "today-pending": exportData = filteredData.unpaidTodayDaily.map(m => ({ Member: m.name, Group: m.chitGroup, PendingDays: m.pendingDays || 0, Status: "Unpaid" })); break;
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

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10 overflow-x-hidden print:p-0">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <div className="space-y-1">
          <h2 className="text-2xl sm:text-3xl font-headline font-bold tracking-tight text-primary">Admin Reports</h2>
          <p className="text-sm text-muted-foreground">Daily audit and collection monitoring.</p>
        </div>
        <div className="flex items-center gap-2">
           <Button variant="outline" size="sm" className="h-9 px-3 text-[10px] font-bold uppercase tracking-widest" onClick={handleOpenPrintDialog}>
             <Printer className="mr-2 size-3.5" /> Print
           </Button>
           <Button size="sm" className="h-9 px-3 text-[10px] font-bold uppercase tracking-widest shadow-md" onClick={handleExportExcel}>
             <Download className="mr-2 size-3.5" /> Export
           </Button>
        </div>
      </div>

      <div className="space-y-6 print:hidden">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-l-4 border-primary pl-4 py-1">
          <div className="space-y-0.5">
            <h3 className="text-xl font-bold tracking-tight text-primary font-headline">Today's Summary</h3>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
              {format(new Date(), 'EEEE, dd MMMM yyyy')}
            </p>
          </div>
          <div className="hidden sm:block h-px flex-1 bg-gradient-to-r from-border to-transparent mb-2 ml-4"></div>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <Card className="border border-border/50 shadow-sm bg-white overflow-hidden transition-all hover:shadow-md">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-muted-foreground/80">Today Collection</span>
                <div className="p-2 rounded-full bg-emerald-50">
                  <IndianRupee className="size-4 text-emerald-600" />
                </div>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold text-emerald-600 tracking-tight">
                  ₹{filteredData!.todayStats.collection.toLocaleString()}
                </span>
              </div>
              <div className="mt-4 pt-4 border-t border-muted/30 flex items-center gap-2">
                <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
                   <div className="h-full bg-emerald-500 w-[65%]" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-border/50 shadow-sm bg-white overflow-hidden transition-all hover:shadow-md">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-muted-foreground/80">Transactions</span>
                <div className="p-2 rounded-full bg-primary/5">
                  <LayoutList className="size-4 text-primary" />
                </div>
              </div>
              <div className="text-3xl font-bold tracking-tight text-foreground">
                {filteredData!.todayStats.txCount}
              </div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">Processed Today</p>
            </CardContent>
          </Card>

          <Card className="border border-border/50 shadow-sm bg-white overflow-hidden transition-all hover:shadow-md border-l-4 border-l-destructive">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-destructive/80">Pending Members</span>
                <div className="p-2 rounded-full bg-destructive/5">
                  <Clock className="size-4 text-destructive" />
                </div>
              </div>
              <div className="text-3xl font-bold tracking-tight text-destructive">
                {filteredData!.todayStats.pendingCount}
              </div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1 italic">Action Required</p>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3 bg-card p-4 rounded-xl border border-border/50 shadow-sm print:hidden">
        <div className="space-y-2">
          <label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">Scheme</label>
          <Select value={reportType} onValueChange={setReportType}>
            <SelectTrigger className="w-full h-10 text-[11px] font-bold"><Filter className="mr-2 size-3.5 text-primary" /><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">Month</label>
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-full h-10 text-[11px] font-bold"><Calendar className="mr-2 size-3.5 text-primary" /><SelectValue /></SelectTrigger>
            <SelectContent>
              {MONTHS_MASTER.map(m => (<SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">Year</label>
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-full h-10 text-[11px] font-bold"><Calendar className="mr-2 size-3.5 text-primary" /><SelectValue /></SelectTrigger>
            <SelectContent>
              {YEARS.map(y => (<SelectItem key={y} value={y}>{y}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 grid-cols-1 md:grid-cols-3 print:hidden">
        <Card className="border-border/50 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Total Collection</CardTitle>
            <IndianRupee className="size-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">₹{filteredData!.metrics.totalCollected.toLocaleString()}</div>
            <p className="text-[10px] text-muted-foreground mt-1 font-medium italic">For selected filters</p>
          </CardContent>
        </Card>
        <Card className="border-border/50 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Transactions Count</CardTitle>
            <CheckCircle2 className="size-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filteredData!.metrics.txCount}</div>
            <p className="text-[10px] text-muted-foreground mt-1 font-medium italic">Confirmed payments</p>
          </CardContent>
        </Card>
        <Card className="border-border/50 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Total Members Count</CardTitle>
            <Users className="size-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filteredData!.metrics.membersCount}</div>
            <p className="text-[10px] text-muted-foreground mt-1 font-medium italic">Active in scheme</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full print:hidden">
        <TabsList className="grid w-full grid-cols-3 h-auto p-1 bg-muted/50 border rounded-xl overflow-x-auto">
          <TabsTrigger value="collections" className="py-2.5 text-[10px] font-bold uppercase tracking-widest gap-2">
            <Database className="size-3.5" /> Collections
          </TabsTrigger>
          <TabsTrigger value="yesterday-pending" className="py-2.5 text-[10px] font-bold uppercase tracking-widest gap-2">
            <History className="size-3.5" /> Yesterday Pending
          </TabsTrigger>
          <TabsTrigger value="today-pending" className="py-2.5 text-[10px] font-bold uppercase tracking-widest gap-2">
            <Clock className="size-3.5" /> Today Pending
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="collections" className="mt-6">
          <Card className="border-border/50 overflow-hidden shadow-sm">
            <div className="p-4 border-b bg-muted/20 flex justify-between items-center">
              <h3 className="text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                <Database className="size-4 text-primary" /> Monthly Revenue
              </h3>
              <Button 
                variant={isMonthLocked ? "secondary" : "outline"} 
                size="sm" 
                className={cn("h-7 px-3 text-[9px] font-bold uppercase tracking-widest", isMonthLocked && "text-amber-700 bg-amber-50")}
                onClick={toggleMonthLock}
                disabled={isActionPending}
              >
                {isMonthLocked ? <Lock className="mr-2 size-3" /> : <Clock className="mr-2 size-3" />}
                {isMonthLocked ? "Unlock" : "Lock"}
              </Button>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead className="text-[10px] uppercase font-bold tracking-widest h-10 pl-6">Month</TableHead>
                    <TableHead className="text-right text-[10px] uppercase font-bold tracking-widest h-10 pr-6">Total Collection</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredData!.collectionData.length > 0 ? filteredData!.collectionData.map((row, i) => (
                    <TableRow key={i} className="hover:bg-muted/5 transition-colors">
                      <TableCell className="font-bold text-sm pl-6">{row.month}</TableCell>
                      <TableCell className="text-right font-bold text-emerald-600 text-sm tabular-nums pr-6">₹{row.amount.toLocaleString()}</TableCell>
                    </TableRow>
                  )) : (
                    <TableRow><TableCell colSpan={2} className="h-40 text-center text-muted-foreground italic text-sm">No collections found.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="yesterday-pending" className="mt-6">
          <Card className="border-border/50 overflow-hidden shadow-sm">
            <div className="p-4 border-b bg-amber-50/50 flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-widest flex items-center gap-2 text-amber-700">
                <History className="size-4" /> Unpaid Yesterday (Daily)
              </h3>
              <Badge variant="outline" className="text-[10px] font-bold border-amber-200 text-amber-700">
                {filteredData!.unpaidYesterdayDaily.length} Members
              </Badge>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead className="text-[10px] uppercase font-bold tracking-widest h-10 pl-6">Member</TableHead>
                    <TableHead className="text-[10px] uppercase font-bold tracking-widest h-10">Group</TableHead>
                    <TableHead className="text-[10px] uppercase font-bold tracking-widest h-10 pr-6 text-right">Pending Days</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredData!.unpaidYesterdayDaily.length > 0 ? filteredData!.unpaidYesterdayDaily.map((m, i) => (
                    <TableRow key={i} className="hover:bg-muted/5 transition-colors">
                      <TableCell className="pl-6 py-4">
                        <span className="font-bold text-sm">{m.name}</span>
                      </TableCell>
                      <TableCell className="text-[10px] font-bold text-primary uppercase">{m.chitGroup}</TableCell>
                      <TableCell className="text-right pr-6 tabular-nums font-bold text-destructive text-sm">{m.pendingDays || 0}</TableCell>
                    </TableRow>
                  )) : (
                    <TableRow><TableCell colSpan={3} className="h-40 text-center text-muted-foreground italic text-sm">Clear for yesterday.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="today-pending" className="mt-6">
          <Card className="border-border/50 overflow-hidden shadow-sm">
            <div className="p-4 border-b bg-blue-50/50 flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-widest flex items-center gap-2 text-blue-700">
                <Clock className="size-4" /> Unpaid Today (Daily)
              </h3>
              <Badge variant="outline" className="text-[10px] font-bold border-blue-200 text-blue-700">
                {filteredData!.unpaidTodayDaily.length} Members
              </Badge>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead className="text-[10px] uppercase font-bold tracking-widest h-10 pl-6">Member</TableHead>
                    <TableHead className="text-[10px] uppercase font-bold tracking-widest h-10">Group</TableHead>
                    <TableHead className="text-[10px] uppercase font-bold tracking-widest h-10 pr-6 text-right">Pending Days</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredData!.unpaidTodayDaily.length > 0 ? filteredData!.unpaidTodayDaily.map((m, i) => (
                    <TableRow key={i} className="hover:bg-muted/5 transition-colors">
                      <TableCell className="pl-6 py-4">
                        <span className="font-bold text-sm">{m.name}</span>
                      </TableCell>
                      <TableCell className="text-[10px] font-bold text-primary uppercase">{m.chitGroup}</TableCell>
                      <TableCell className="text-right pr-6 tabular-nums font-bold text-destructive text-sm">{m.pendingDays || 0}</TableCell>
                    </TableRow>
                  )) : (
                    <TableRow><TableCell colSpan={3} className="h-40 text-center text-muted-foreground italic text-sm">Clear for today.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={isPrintDialogOpen} onOpenChange={setIsPrintDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Printer className="size-5 text-primary" />
              Print Report
            </DialogTitle>
            <DialogDescription>Select the report format for 3-inch thermal printer.</DialogDescription>
          </DialogHeader>
          <div className="py-6">
            <RadioGroup 
              value={printReportType} 
              onValueChange={(v: any) => setPrintReportType(v)}
              className="grid gap-4"
            >
              <div className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-muted/30 transition-colors cursor-pointer">
                <RadioGroupItem value="daily" id="r-daily" />
                <Label htmlFor="r-daily" className="flex-1 cursor-pointer font-bold uppercase text-xs tracking-widest">Daily Report (Today)</Label>
              </div>
              <div className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-muted/30 transition-colors cursor-pointer">
                <RadioGroupItem value="monthly" id="r-monthly" />
                <Label htmlFor="r-monthly" className="flex-1 cursor-pointer font-bold uppercase text-xs tracking-widest">Monthly Report ({currentMonthName} {selectedYear})</Label>
              </div>
            </RadioGroup>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPrintDialogOpen(false)} className="w-full sm:w-auto font-bold">Cancel</Button>
            <Button onClick={handleExecutePrint} className="w-full sm:w-auto font-bold gap-2">
              <Printer className="size-4" />
              Print Now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div id="thermal-receipt" className="hidden">
        <div className="text-center font-bold mb-2">CHIT FUND REPORT</div>
        <div className="text-center mb-4">----------------------------</div>
        
        {printReportType === 'daily' ? (
          <>
            <div className="text-center font-bold mb-2 uppercase">Daily Report</div>
            <div className="mb-2">Date: {format(new Date(), 'dd-MM-yyyy')}</div>
            <div className="mb-4">----------------------------</div>
            <div className="flex justify-between mb-1">
              <span>Collection:</span>
              <span className="font-bold">₹{filteredData!.todayStats.collection.toLocaleString()}</span>
            </div>
            <div className="flex justify-between mb-1">
              <span>Transactions:</span>
              <span className="font-bold">{filteredData!.todayStats.txCount}</span>
            </div>
            <div className="flex justify-between mb-1">
              <span>Members:</span>
              <span className="font-bold">{filteredData!.metrics.membersCount}</span>
            </div>
            <div className="flex justify-between mb-1">
              <span>Pending:</span>
              <span className="font-bold">{filteredData!.todayStats.pendingCount}</span>
            </div>
          </>
        ) : (
          <>
            <div className="text-center font-bold mb-2 uppercase">Monthly Report</div>
            <div className="mb-2">Month: {currentMonthName} {selectedYear}</div>
            <div className="mb-4">----------------------------</div>
            <div className="flex justify-between mb-1">
              <span>Collection:</span>
              <span className="font-bold">₹{filteredData!.metrics.totalCollected.toLocaleString()}</span>
            </div>
            <div className="flex justify-between mb-1">
              <span>Transactions:</span>
              <span className="font-bold">{filteredData!.metrics.txCount}</span>
            </div>
            <div className="flex justify-between mb-1">
              <span>Members Joined:</span>
              <span className="font-bold">{filteredData!.metrics.membersCount}</span>
            </div>
          </>
        )}
        
        <div className="mt-4 text-center">----------------------------</div>
        <div className="text-center font-bold mt-2 uppercase">Thank You</div>
        <div className="text-center mt-1 text-[8px]">{new Date().toLocaleString()}</div>
      </div>
    </div>
  )
}
