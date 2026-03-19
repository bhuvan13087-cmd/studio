
"use client"

import { useState, useEffect, useMemo } from "react"
import { Download, Printer, Loader2, Database, Filter, CheckCircle2, Clock, Users, IndianRupee, TrendingUp, Calendar as CalendarIcon, AlertCircle, LayoutList, FileText, LayoutDashboard, History, ChevronRight, Search } from "lucide-react"
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import { useFirestore, useCollection, useMemoFirebase, useUser } from "@/firebase"
import { collection, query, orderBy } from "firebase/firestore"
import { format, parseISO, getMonth, getYear, subDays, isValid } from "date-fns"
import * as XLSX from 'xlsx'
import { cn } from "@/lib/utils"

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
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'))
  const [activeTab, setActiveTab] = useState("collections")
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false)
  
  const [isPrintDialogOpen, setIsPrintDialogOpen] = useState(false)
  const [printReportType, setPrintReportType] = useState<'daily' | 'monthly'>('daily')
  const [printDate, setPrintDate] = useState<Date>(new Date())
  
  const { toast } = useToast()
  const db = useFirestore()

  const membersQuery = useMemoFirebase(() => collection(db, 'members'), [db])
  const { data: members, isLoading: membersLoading } = useCollection(membersQuery)

  const paymentsQuery = useMemoFirebase(() => query(collection(db, 'payments'), orderBy('paymentDate', 'desc')), [db])
  const { data: payments, isLoading: paymentsLoading } = useCollection(paymentsQuery)

  const roundsQuery = useMemoFirebase(() => query(collection(db, 'chitRounds'), orderBy('createdAt', 'desc')), [db])
  const { data: rounds, isLoading: roundsLoading } = useCollection(roundsQuery)

  useEffect(() => { setMounted(true) }, [])

  const filteredData = useMemo(() => {
    if (!mounted || !members || !payments || !rounds) return null;
    
    // PRIMARY FILTER: Identify all Daily members
    const dailyMembers = members.filter(m => {
        if (m.status === 'inactive') return false;
        return (m.paymentType || "").toLowerCase() === 'daily';
    });

    const targetMembers = members.filter(m => {
      if (m.status === 'inactive') return false;
      const schemeType = (m.paymentType || "").toLowerCase();
      return schemeType === reportType;
    });
    const targetIds = new Set(targetMembers.map(m => m.id));

    const focusDate = isValid(parseISO(selectedDate)) ? parseISO(selectedDate) : new Date();
    const focusDateStr = format(focusDate, 'yyyy-MM-dd');
    const yesterday = subDays(focusDate, 1);
    const yesterdayStr = format(yesterday, 'yyyy-MM-dd');

    // 1. COLLECTION TOTALS: Across all groups for the focus date
    const focusDatePayments = payments.filter(p => {
      if (p.status !== 'paid' && p.status !== 'success') return false;
      const pDate = p.targetDate || (p.paymentDate ? format(parseISO(p.paymentDate), 'yyyy-MM-dd') : null);
      return pDate === focusDateStr;
    });

    const totalCollection = focusDatePayments.reduce((acc, p) => acc + (p.amountPaid || 0), 0);
    const totalTransactions = focusDatePayments.length;

    // 2. TODAY PENDING (Daily Only): Exclude if payment exists for today
    const unpaidTodayDaily = dailyMembers.filter(m => {
      const hasPaidToday = payments.some(p => 
        p.memberId === m.id && 
        (p.status === 'success' || p.status === 'paid') && 
        (p.targetDate === focusDateStr || (p.paymentDate && format(parseISO(p.paymentDate), 'yyyy-MM-dd') === focusDateStr))
      );
      return !hasPaidToday;
    });

    // 3. YESTERDAY PENDING (Daily Only): Exclude if paid yesterday OR if total paid today >= dailyAmount
    const unpaidYesterdayDaily = dailyMembers.filter(m => {
      // Step 1: Check if payment exists for yesterday
      const hasPaidYesterday = payments.some(p => 
        p.memberId === m.id && 
        (p.status === 'success' || p.status === 'paid') && 
        (p.targetDate === yesterdayStr || (p.paymentDate && format(parseISO(p.paymentDate), 'yyyy-MM-dd') === yesterdayStr))
      );
      
      if (hasPaidYesterday) return false;

      // Step 2: Check total payment done today
      const dailyAmount = m.monthlyAmount || 0;
      const totalPaidToday = payments.filter(p => 
        p.memberId === m.id && 
        (p.status === 'success' || p.status === 'paid') && 
        (p.targetDate === focusDateStr || (p.paymentDate && format(parseISO(p.paymentDate), 'yyyy-MM-dd') === focusDateStr))
      ).reduce((acc, p) => acc + (p.amountPaid || 0), 0);

      // IF totalPaidToday >= dailyAmount: remove (covered yesterday's due)
      return totalPaidToday < dailyAmount;
    });

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
      focusStats: {
        collection: totalCollection,
        txCount: totalTransactions,
        pendingCount: unpaidTodayDaily.length, 
        dateLabel: format(focusDate, 'EEEE, dd MMMM yyyy'),
        dateShort: format(focusDate, 'dd-MM-yyyy')
      }
    };
  }, [mounted, reportType, selectedMonth, selectedYear, selectedDate, members, payments, rounds]);

  const thermalReceiptData = useMemo(() => {
    if (!mounted || !members || !payments) return null;

    const focusDate = isValid(parseISO(selectedDate)) ? parseISO(selectedDate) : new Date();
    const focusDateStr = format(focusDate, 'yyyy-MM-dd');
    const yesterday = subDays(focusDate, 1);
    const yesterdayStr = format(yesterday, 'yyyy-MM-dd');

    const todayPayments = payments.filter(p => 
      (p.status === 'paid' || p.status === 'success') && 
      (p.targetDate === focusDateStr || (p.paymentDate && format(parseISO(p.paymentDate), 'yyyy-MM-dd') === focusDateStr))
    );

    const rows = todayPayments.map(tp => {
      const member = members.find(m => m.id === tp.memberId);
      const schemeAmount = member?.monthlyAmount || 0;

      const yesterdayPayment = payments.find(p => 
        p.memberId === tp.memberId && 
        (p.status === 'success' || p.status === 'paid') && 
        (p.targetDate === yesterdayStr || (p.paymentDate && format(parseISO(p.paymentDate), 'yyyy-MM-dd') === yesterdayStr))
      );

      const yesterdayPendingInitial = yesterdayPayment ? 0 : schemeAmount;
      const todayPaid = tp.amountPaid || 0;
      const remainingYP = Math.max(0, yesterdayPendingInitial - todayPaid);

      return {
        name: tp.memberName || member?.name || "N/A",
        yesterdayPending: remainingYP,
        todayPaid: todayPaid,
        pendingDate: remainingYP > 0 ? yesterdayStr : null
      };
    });

    return {
      timestamp: format(new Date(), 'dd-MM-yyyy HH:mm:ss'),
      date: focusDateStr,
      rows,
      totalCollectedToday: rows.reduce((acc, r) => acc + r.todayPaid, 0),
      txCount: rows.length
    };
  }, [mounted, members, payments, selectedDate]);

  const handleOpenPrintDialog = () => {
    setPrintReportType('daily');
    setPrintDate(isValid(parseISO(selectedDate)) ? parseISO(selectedDate) : new Date());
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
    const currentMonthName = MONTHS_MASTER.find(m => m.value === selectedMonth)?.label;
    const fileName = `Report_${reportType.toUpperCase()}_${selectedYear}_${currentMonthName}.xlsx`;

    switch (activeTab) {
      case "collections": exportData = filteredData.collectionData.map(d => ({ Period: d.month, Amount: d.amount })); break;
      case "yesterday-pending": exportData = filteredData.unpaidYesterdayDaily.map(m => ({ Member: m.name, Group: m.chitGroup, Status: "Unpaid" })); break;
      case "today-pending": exportData = filteredData.unpaidTodayDaily.map(m => ({ Member: m.name, Group: m.chitGroup, Status: "Unpaid" })); break;
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
          <p className="text-sm text-muted-foreground">Historical audit and collection monitoring.</p>
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

      <div className="space-y-4 print:hidden">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-l-4 border-primary pl-4 py-1">
          <div className="space-y-0.5">
            <h3 className="text-lg font-bold tracking-tight text-primary font-headline">Daily Summary</h3>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
              {filteredData!.focusStats.dateLabel}
            </p>
          </div>
          <div className="hidden sm:block h-px flex-1 bg-gradient-to-r from-border to-transparent mb-2 ml-4"></div>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="border border-border/50 shadow-sm bg-white overflow-hidden transition-all hover:shadow-md h-20">
            <CardContent className="p-4 flex flex-col justify-center h-full">
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[9px] font-extrabold uppercase tracking-[0.2em] text-muted-foreground/80">Collection</span>
                <IndianRupee className="size-3 text-emerald-600" />
              </div>
              <div className="text-base font-bold text-emerald-600 tracking-tight">
                ₹{filteredData!.focusStats.collection.toLocaleString()}
              </div>
            </CardContent>
          </Card>

          <Card className="border border-border/50 shadow-sm bg-white overflow-hidden transition-all hover:shadow-md h-20">
            <CardContent className="p-4 flex flex-col justify-center h-full">
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[9px] font-extrabold uppercase tracking-[0.2em] text-muted-foreground/80">Transactions</span>
              </div>
              <div className="text-base font-bold tracking-tight text-foreground">
                {filteredData!.focusStats.txCount}
              </div>
            </CardContent>
          </Card>

          <Card className="border border-border/50 shadow-sm bg-white overflow-hidden transition-all hover:shadow-md border-l-4 border-l-destructive h-20">
            <CardContent className="p-4 flex flex-col justify-center h-full">
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[9px] font-extrabold uppercase tracking-[0.2em] text-destructive/80">Pending Members</span>
                <Clock className="size-3 text-destructive" />
              </div>
              <div className="text-base font-bold tracking-tight text-destructive">
                {filteredData!.focusStats.pendingCount}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-4 bg-card p-4 rounded-xl border border-border/50 shadow-sm print:hidden">
        <div className="space-y-2">
          <label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">Select Date</label>
          <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
            <PopoverTrigger asChild>
              <Button
                variant={"outline"}
                className={cn(
                  "w-full h-10 justify-start text-left font-bold text-[11px] border-muted bg-white",
                  !selectedDate && "text-muted-foreground"
                )}
              >
                <div className="flex items-center w-full">
                  <CalendarIcon className="mr-3 h-4 w-4 text-primary shrink-0" />
                  <span className="flex-1 truncate">
                    {selectedDate ? format(parseISO(selectedDate), "dd-MM-yyyy") : "Select Date"}
                  </span>
                </div>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start" side="bottom">
              <Calendar
                mode="single"
                selected={isValid(parseISO(selectedDate)) ? parseISO(selectedDate) : new Date()}
                onSelect={(date) => {
                  if (date) {
                    setSelectedDate(format(date, 'yyyy-MM-dd'))
                    setIsDatePickerOpen(false)
                  }
                }}
                disabled={(date) => date > new Date()}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">Scheme</label>
          <Select value={reportType} onValueChange={setReportType}>
            <SelectTrigger className="w-full h-10 text-[11px] font-bold bg-white"><Filter className="mr-2 size-3.5 text-primary" /><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">Month</label>
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-full h-10 text-[11px] font-bold bg-white"><CalendarIcon className="mr-2 size-3.5 text-primary" /><SelectValue /></SelectTrigger>
            <SelectContent>
              {MONTHS_MASTER.map(m => (<SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">Year</label>
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-full h-10 text-[11px] font-bold bg-white"><CalendarIcon className="mr-2 size-3.5 text-primary" /><SelectValue /></SelectTrigger>
            <SelectContent>
              {YEARS.map(y => (<SelectItem key={y} value={y}>{y}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>
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
                <History className="size-4" /> Unpaid Previous Day (Daily)
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
                    <TableHead className="text-[10px] uppercase font-bold tracking-widest h-10 pr-6 text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredData!.unpaidYesterdayDaily.length > 0 ? filteredData!.unpaidYesterdayDaily.map((m, i) => (
                    <TableRow key={i} className="hover:bg-muted/5 transition-colors">
                      <TableCell className="pl-6 py-4">
                        <span className="font-bold text-sm">{m.name}</span>
                      </TableCell>
                      <TableCell className="text-[10px] font-bold text-primary uppercase">{m.chitGroup}</TableCell>
                      <TableCell className="text-right pr-6 text-[10px] font-bold text-destructive uppercase">Unpaid</TableCell>
                    </TableRow>
                  )) : (
                    <TableRow><TableCell colSpan={3} className="h-40 text-center text-muted-foreground italic text-sm">Clear for previous day.</TableCell></TableRow>
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
                <Clock className="size-4" /> Unpaid Selected Date (Daily)
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
                    <TableHead className="text-[10px] uppercase font-bold tracking-widest h-10 pr-6 text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredData!.unpaidTodayDaily.length > 0 ? filteredData!.unpaidTodayDaily.map((m, i) => (
                    <TableRow key={i} className="hover:bg-muted/5 transition-colors">
                      <TableCell className="pl-6 py-4">
                        <span className="font-bold text-sm">{m.name}</span>
                      </TableCell>
                      <TableCell className="text-[10px] font-bold text-primary uppercase">{m.chitGroup}</TableCell>
                      <TableCell className="text-right pr-6 text-[10px] font-bold text-destructive uppercase">Unpaid</TableCell>
                    </TableRow>
                  )) : (
                    <TableRow><TableCell colSpan={3} className="h-40 text-center text-muted-foreground italic text-sm">Clear for selected date.</TableCell></TableRow>
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
          <div className="py-6 space-y-4">
            <RadioGroup 
              value={printReportType} 
              onValueChange={(v: any) => setPrintReportType(v)}
              className="grid gap-4"
            >
              <div className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-muted/30 transition-colors cursor-pointer">
                <RadioGroupItem value="daily" id="r-daily" />
                <div className="flex-1 cursor-pointer">
                  <Label htmlFor="r-daily" className="font-bold uppercase text-xs tracking-widest block mb-1">Daily Collection Report</Label>
                  <div className="flex flex-col gap-2 mt-2">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="h-8 justify-start text-[10px] font-bold w-full">
                          <CalendarIcon className="mr-2 h-3 w-3" />
                          {format(printDate, 'dd-MM-yyyy')}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={printDate}
                          onSelect={(date) => date && setPrintDate(date)}
                          disabled={(date) => date > new Date()}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-muted/30 transition-colors cursor-pointer">
                <RadioGroupItem value="monthly" id="r-monthly" />
                <div className="flex-1 cursor-pointer">
                  <Label htmlFor="r-monthly" className="font-bold uppercase text-xs tracking-widest block mb-1">Monthly Summary</Label>
                  <span className="text-[10px] text-muted-foreground font-medium">{MONTHS_MASTER.find(m => m.value === selectedMonth)?.label} {selectedYear}</span>
                </div>
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
        <div className="text-center font-bold mb-1">DAILY COLLECTION REPORT</div>
        <div className="text-center text-[8px] mb-2">{thermalReceiptData?.timestamp}</div>
        <div className="mb-2">----------------------------</div>
        
        {/* Table Headers */}
        <div className="flex text-[9px] font-bold border-b pb-1 mb-1">
          <div className="w-[35%]">Member</div>
          <div className="w-[20%] text-right">Y.P</div>
          <div className="w-[20%] text-right">T.P</div>
          <div className="w-[25%] text-right">Status</div>
        </div>

        {thermalReceiptData?.rows.map((row, i) => (
          <div key={i} className="flex flex-col border-b border-dashed py-1">
            <div className="flex text-[9px] items-center">
              <div className="w-[35%] truncate">{row.name}</div>
              <div className="w-[20%] text-right tabular-nums">{row.yesterdayPending > 0 ? `₹${row.yesterdayPending}` : "-"}</div>
              <div className="w-[20%] text-right tabular-nums">₹{row.todayPaid}</div>
              <div className="w-[25%] text-right text-[8px] uppercase font-bold">
                {row.yesterdayPending > 0 ? "Pending" : "Cleared"}
              </div>
            </div>
            {row.pendingDate && (
              <div className="text-[7px] italic text-muted-foreground text-right mt-0.5">
                Due Date: {row.pendingDate}
              </div>
            )}
          </div>
        ))}
        
        <div className="mt-4">----------------------------</div>
        <div className="space-y-1">
          <div className="flex justify-between font-bold text-[9px]">
            <span>TX COUNT:</span>
            <span>{thermalReceiptData?.txCount}</span>
          </div>
          <div className="flex justify-between font-bold text-[10px]">
            <span>TOTAL COLLECTED:</span>
            <span>₹{thermalReceiptData?.totalCollectedToday.toLocaleString()}</span>
          </div>
        </div>
        
        <div className="mt-4 text-center">----------------------------</div>
        <div className="text-center font-bold text-[9px] uppercase">Thank You</div>
      </div>
    </div>
  )
}
