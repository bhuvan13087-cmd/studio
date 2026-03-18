
"use client"

import { useState, useEffect, useMemo } from "react"
import { Download, Printer, Loader2, Database, Filter, CheckCircle2, Clock, Users, IndianRupee, TrendingUp, Calendar, Lock, AlertCircle, LayoutList, FileText, LayoutDashboard } from "lucide-react"
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
import { useToast } from "@/hooks/use-toast"
import { useFirestore, useCollection, useMemoFirebase, useUser } from "@/firebase"
import { collection, query, orderBy, doc, setDoc, deleteDoc, serverTimestamp } from "firebase/firestore"
import { format, parseISO, getMonth, getYear, subDays, startOfDay, isSameDay } from "date-fns"
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
  const [reportType, setReportType] = useState("daily")
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().getMonth().toString())
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString())
  const [activeTab, setActiveTab] = useState("collections")
  const [isActionPending, setIsActionPending] = useState(false)
  
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
    if (selectedMonth === 'all' || !monthLocks) return false;
    return monthLocks.some(l => l.year === selectedYear && l.monthName === currentMonthName);
  }, [monthLocks, selectedYear, currentMonthName, selectedMonth]);

  useEffect(() => { setMounted(true) }, [])

  const toggleMonthLock = async () => {
    if (selectedMonth === 'all') return;
    
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
    
    // 1. Filter Target Members based on Scheme
    const targetMembers = members.filter(m => {
      if (m.status === 'inactive') return false;
      const round = rounds.find(r => r.name === m.chitGroup);
      const schemeType = (m.paymentType || round?.collectionType || "Monthly").toLowerCase();
      return schemeType === reportType;
    });
    const targetIds = new Set(targetMembers.map(m => m.id));

    const isMatchingPeriod = (dateStr: string) => {
      if (!dateStr) return false;
      const d = parseISO(dateStr);
      const matchYear = getYear(d).toString() === selectedYear;
      const matchMonth = selectedMonth === "all" || getMonth(d).toString() === selectedMonth;
      return matchYear && matchMonth;
    };

    // 2. Filter Period Payments
    const periodPayments = payments.filter(p => 
      (p.status === 'paid' || p.status === 'success') && 
      targetIds.has(p.memberId) && 
      p.paymentDate && 
      isMatchingPeriod(p.paymentDate)
    );

    // 3. Today's Statistics
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
    
    const getUnpaidForDate = (dateStr: string, refDate: Date) => {
      return targetMembers.filter(m => {
        const hasPaid = payments.some(p => 
          p.memberId === m.id && 
          (p.status === 'paid' || p.status === 'success') && 
          (p.targetDate === dateStr || (p.paymentDate && format(parseISO(p.paymentDate), 'yyyy-MM-dd') === dateStr))
        );
        return !hasPaid;
      });
    };

    const unpaidToday = getUnpaidForDate(todayStr, today);
    const unpaidYesterday = getUnpaidForDate(yesterdayStr, yesterday);

    // 4. Monthly Breakdown
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

    return { 
      collectionData: collectionDataByMonth, 
      targetMembers,
      unpaidToday,
      unpaidYesterday,
      todayStats: {
        collection: todayCollection,
        txCount: todayPayments.length,
        pendingCount: unpaidToday.length
      },
      metrics: {
        totalCollected: periodPayments.reduce((acc, p) => acc + (p.amountPaid || 0), 0),
        txCount: periodPayments.length,
        membersCount: targetMembers.length
      }
    };
  }, [mounted, reportType, selectedMonth, selectedYear, members, payments, rounds]);

  const handlePrint = () => window.print();

  const handleExportExcel = () => {
    if (!filteredData) return;
    let exportData: any[] = [];
    const fileName = `Report_${reportType.toUpperCase()}_${selectedYear}_${selectedMonth === 'all' ? 'Year' : currentMonthName}.xlsx`;

    switch (activeTab) {
      case "collections": exportData = filteredData.collectionData.map(d => ({ Period: d.month, Amount: d.amount })); break;
      case "members": exportData = filteredData.targetMembers.map(m => ({ Name: m.name, Scheme: m.chitGroup, Amount: m.monthlyAmount, Status: m.status })); break;
      case "daily-status": exportData = [
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

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10 overflow-x-hidden print:p-0">
      {/* 1. Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <div className="space-y-1">
          <h2 className="text-2xl sm:text-3xl font-headline font-bold tracking-tight text-primary">Admin Reports</h2>
          <p className="text-sm text-muted-foreground">Daily audit and collection monitoring.</p>
        </div>
        <div className="flex items-center gap-2">
           <Button variant="outline" size="sm" className="h-9 px-3 text-[10px] font-bold uppercase tracking-widest" onClick={handlePrint}>
             <Printer className="mr-2 size-3.5" /> Print
           </Button>
           <Button size="sm" className="h-9 px-3 text-[10px] font-bold uppercase tracking-widest shadow-md" onClick={handleExportExcel}>
             <Download className="mr-2 size-3.5" /> Export
           </Button>
        </div>
      </div>

      {/* 2. ⭐ Daily Report Card (Top Priority) */}
      <Card className="border-primary/20 bg-primary/5 shadow-sm overflow-hidden border-2">
        <div className="p-4 bg-primary text-primary-foreground flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="flex items-center gap-2">
            <LayoutDashboard className="size-5" />
            <h3 className="font-bold text-sm uppercase tracking-widest">Today at a Glance</h3>
          </div>
          <Badge variant="secondary" className="bg-white/20 text-white border-white/30 font-bold">
            {format(new Date(), 'EEEE, dd MMMM yyyy')}
          </Badge>
        </div>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4 p-6">
          <div className="space-y-1 border-r pr-4">
            <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Today Collection</span>
            <div className="text-xl font-bold text-emerald-600">₹{filteredData!.todayStats.collection.toLocaleString()}</div>
          </div>
          <div className="space-y-1 md:border-r md:pr-4">
            <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Transactions</span>
            <div className="text-xl font-bold">{filteredData!.todayStats.txCount}</div>
          </div>
          <div className="space-y-1 border-r pr-4">
            <span className="text-[10px] font-bold uppercase text-destructive tracking-widest">Pending Members</span>
            <div className="text-xl font-bold text-destructive">{filteredData!.todayStats.pendingCount}</div>
          </div>
          <div className="space-y-1">
            <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Month Status</span>
            <div className={cn("text-sm font-bold uppercase flex items-center gap-1", isMonthLocked ? "text-amber-600" : "text-emerald-600")}>
              {isMonthLocked ? <Lock className="size-3.5" /> : <Clock className="size-3.5" />}
              {isMonthLocked ? "Locked" : "Active"}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 3. Filter Section */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3 bg-card p-4 rounded-xl border border-border/50 shadow-sm print:hidden">
        <div className="space-y-2">
          <label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">Scheme</label>
          <Select value={reportType} onValueChange={setReportType}>
            <SelectTrigger className="w-full h-10 text-[11px] font-bold"><Filter className="mr-2 size-3.5 text-primary" /><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Daily Only</SelectItem>
              <SelectItem value="monthly">Monthly Only</SelectItem>
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

      {/* 4. Top Summary Cards (3 Cards) */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
        <Card className="border-border/50 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Period Collection</CardTitle>
            <IndianRupee className="size-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">₹{filteredData!.metrics.totalCollected.toLocaleString()}</div>
            <p className="text-[10px] text-muted-foreground mt-1 font-medium italic">For selected filters</p>
          </CardContent>
        </Card>
        <Card className="border-border/50 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Transactions</CardTitle>
            <CheckCircle2 className="size-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filteredData!.metrics.txCount}</div>
            <p className="text-[10px] text-muted-foreground mt-1 font-medium italic">Confirmed payments</p>
          </CardContent>
        </Card>
        <Card className="border-border/50 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Members</CardTitle>
            <Users className="size-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filteredData!.metrics.membersCount}</div>
            <p className="text-[10px] text-muted-foreground mt-1 font-medium italic">Active in scheme</p>
          </CardContent>
        </Card>
      </div>

      {/* 5. Tabs Section */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 h-auto p-1 bg-muted/50 border rounded-xl overflow-x-auto print:hidden">
          <TabsTrigger value="collections" className="py-2.5 text-[10px] font-bold uppercase tracking-widest gap-2">
            <Database className="size-3.5" /> Collections
          </TabsTrigger>
          <TabsTrigger value="members" className="py-2.5 text-[10px] font-bold uppercase tracking-widest gap-2">
            <Users className="size-3.5" /> Members
          </TabsTrigger>
          <TabsTrigger value="daily-status" className="py-2.5 text-[10px] font-bold uppercase tracking-widest gap-2">
            <Clock className="size-3.5" /> Daily Status
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="collections" className="mt-6">
          <Card className="border-border/50 overflow-hidden shadow-sm">
            <div className="p-4 border-b bg-muted/20 flex justify-between items-center">
              <h3 className="text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                <Database className="size-4 text-primary" /> Monthly Revenue
              </h3>
              {selectedMonth !== 'all' && (
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
              )}
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead className="text-[10px] uppercase font-bold tracking-widest h-10 pl-6">Period</TableHead>
                    <TableHead className="text-right text-[10px] uppercase font-bold tracking-widest h-10 pr-6">Collection</TableHead>
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

        <TabsContent value="members" className="mt-6">
          <Card className="border-border/50 overflow-hidden shadow-sm">
            <div className="p-4 border-b bg-muted/20">
              <h3 className="text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                <Users className="size-4 text-primary" /> Member Directory
              </h3>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead className="text-[10px] uppercase font-bold tracking-widest h-10 pl-6">Name</TableHead>
                    <TableHead className="text-[10px] uppercase font-bold tracking-widest h-10">Group</TableHead>
                    <TableHead className="text-right text-[10px] uppercase font-bold tracking-widest h-10 pr-6">Due</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredData!.targetMembers.length > 0 ? filteredData!.targetMembers.map((m, i) => (
                    <TableRow key={i} className="hover:bg-muted/5 transition-colors">
                      <TableCell className="font-bold text-sm pl-6">{m.name}</TableCell>
                      <TableCell className="text-[10px] font-bold text-primary uppercase">{m.chitGroup || "N/A"}</TableCell>
                      <TableCell className="text-right font-bold text-sm tabular-nums pr-6">₹{m.monthlyAmount?.toLocaleString()}</TableCell>
                    </TableRow>
                  )) : (
                    <TableRow><TableCell colSpan={3} className="h-40 text-center text-muted-foreground italic text-sm">No members found.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="daily-status" className="mt-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="border-border/50 overflow-hidden shadow-sm">
              <div className="p-4 border-b bg-amber-50/50 flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-widest flex items-center gap-2 text-amber-700">
                  <AlertCircle className="size-4" /> Unpaid Yesterday
                </h3>
                <Badge variant="outline" className="text-[10px] font-bold border-amber-200 text-amber-700">
                  {filteredData!.unpaidYesterday.length}
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
                      <TableRow key={i} className="hover:bg-muted/5 transition-colors">
                        <TableCell className="pl-6 py-3">
                          <span className="font-semibold text-sm">{m.name}</span>
                        </TableCell>
                        <TableCell className="text-right text-[10px] font-bold text-primary uppercase pr-6">{m.chitGroup}</TableCell>
                      </TableRow>
                    )) : (
                      <TableRow><TableCell colSpan={2} className="h-32 text-center text-muted-foreground italic text-xs">Clear for yesterday.</TableCell></TableRow>
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
                  {filteredData!.unpaidToday.length}
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
                      <TableRow key={i} className="hover:bg-muted/5 transition-colors">
                        <TableCell className="pl-6 py-3">
                          <span className="font-semibold text-sm">{m.name}</span>
                        </TableCell>
                        <TableCell className="text-right text-[10px] font-bold text-primary uppercase pr-6">{m.chitGroup}</TableCell>
                      </TableRow>
                    )) : (
                      <TableRow><TableCell colSpan={2} className="h-32 text-center text-muted-foreground italic text-xs">Clear for today.</TableCell></TableRow>
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
