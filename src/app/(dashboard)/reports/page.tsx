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
import { format, parseISO, getMonth, getYear, subDays, isValid, startOfDay, isBefore, max, isSameMonth } from "date-fns"
import * as XLSX from 'xlsx'
import { cn } from "@/lib/utils"

// STRICT SYSTEM START DATE
const CALCULATION_START_DATE = parseISO('2026-04-01');

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

  const cyclesQuery = useMemoFirebase(() => query(collection(db, 'cycles'), orderBy('createdAt', 'desc')), [db])
  const { data: allCycles } = useCollection(cyclesQuery)

  useEffect(() => { setMounted(true) }, [])

  const getPAmount = (p: any) => Number(p.amountPaid || p.amount || 0);
  const getPDateStr = (p: any) => {
    if (p.targetDate && typeof p.targetDate === 'string') return p.targetDate;
    const raw = p.paymentDate || p.createdAt || p.date || p.paidDate;
    if (!raw) return null;
    try {
      const d = raw.toDate ? raw.toDate() : new Date(raw);
      if (isValid(d)) return format(d, 'yyyy-MM-dd');
    } catch (e) {}
    return null;
  }

  const filteredData = useMemo(() => {
    if (!mounted || !members || !payments || !rounds || !allCycles) return null;
    
    const focusDate = isValid(parseISO(selectedDate)) ? parseISO(selectedDate) : new Date();
    const focusDateStr = format(focusDate, 'yyyy-MM-dd');
    const yesterday = subDays(focusDate, 1);
    const yesterdayStr = format(yesterday, 'yyyy-MM-dd');

    const targetMembers = members.filter(m => {
      if (m.status === 'inactive') return false;
      const scheme = rounds.find(r => r.name === m.chitGroup);
      const resolvedType = (m.paymentType || scheme?.collectionType || "").toLowerCase();
      return resolvedType === reportType;
    });
    const targetIds = new Set(targetMembers.map(m => m.id));

    const checkPending = (m: any, date: Date, dateStr: string) => {
      const activeCycle = allCycles.find(c => c.name === m.chitGroup && c.status === 'active');
      if (!activeCycle) return false;

      const scheme = rounds.find(r => r.name === m.chitGroup);
      const resolvedType = (m.paymentType || scheme?.collectionType || "Daily");
      const mPayments = payments.filter(p => p.memberId === m.id && (p.status === 'success' || p.status === 'paid' || !p.status));

      if (resolvedType === 'Daily') {
        const dayPaymentSum = mPayments.filter(p => getPDateStr(p) === dateStr).reduce((acc, p) => acc + getPAmount(p), 0);
        return dayPaymentSum < (m.monthlyAmount || 800);
      } else {
        // Monthly logic separation (ULTRA SAFE PATCH)
        const dueDate = scheme?.dueDate || 5;
        const hasPaidThisCycle = mPayments.some(p => {
          const pDate = getPDateStr(p);
          return pDate && pDate >= activeCycle.startDate && pDate <= activeCycle.endDate;
        });
        
        const cycleStart = parseISO(activeCycle.startDate);
        const isPastDue = !isSameMonth(date, cycleStart) || date.getDate() > dueDate;
        
        return !hasPaidThisCycle && isPastDue;
      }
    };

    const unpaidToday = targetMembers.filter(m => checkPending(m, focusDate, focusDateStr));
    const unpaidYesterday = targetMembers.filter(m => checkPending(m, yesterday, yesterdayStr));

    const focusDatePayments = payments.filter(p => {
      if (p.status && p.status !== 'paid' && p.status !== 'success') return false;
      return getPDateStr(p) === focusDateStr;
    });

    const totalCollection = focusDatePayments.reduce((acc, p) => acc + getPAmount(p), 0);
    const totalTransactions = focusDatePayments.length;

    const collectionDataByMonth = Array.from({ length: 12 }).map((_, i) => {
      const monthLabel = MONTHS_MASTER.find(m => m.value === i.toString())?.label || "";
      const monthPayments = payments.filter(p => {
        const recordDateStr = getPDateStr(p);
        if (!recordDateStr) return false;
        const d = parseISO(recordDateStr);
        return (p.status === 'paid' || p.status === 'success' || !p.status) && targetIds.has(p.memberId) && getYear(d).toString() === selectedYear && getMonth(d) === i;
      });
      return {
        month: `${monthLabel} ${selectedYear}`,
        amount: monthPayments.reduce((acc, p) => acc + getPAmount(p), 0)
      };
    }).filter(row => row.month.startsWith(MONTHS_MASTER.find(m => m.value === selectedMonth)?.label || ""));

    return { collectionData: collectionDataByMonth, unpaidToday, unpaidYesterday, focusStats: { collection: totalCollection, txCount: totalTransactions, pendingCount: unpaidToday.length, dateLabel: format(focusDate, 'EEEE, dd MMMM yyyy') } };
  }, [mounted, reportType, selectedMonth, selectedYear, selectedDate, members, payments, rounds, allCycles]);

  if (!mounted || membersLoading || paymentsLoading || roundsLoading) return (<div className="flex h-[60vh] items-center justify-center"><Loader2 className="size-8 animate-spin text-primary" /></div>)

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10 overflow-x-hidden print:p-0">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <div className="space-y-1">
          <h2 className="text-2xl sm:text-3xl font-headline font-bold tracking-tight text-primary">Admin Reports</h2>
          <p className="text-sm text-muted-foreground">Historical audit and collection monitoring.</p>
        </div>
        <div className="flex items-center gap-2">
           <Button variant="outline" size="sm" className="h-9 px-3 text-[10px] font-bold uppercase tracking-widest" onClick={() => setIsPrintDialogOpen(true)}><Printer className="mr-2 size-3.5" /> Print</Button>
           <Button size="sm" className="h-9 px-3 text-[10px] font-bold uppercase tracking-widest shadow-md" onClick={() => {}}><Download className="mr-2 size-3.5" /> Export</Button>
        </div>
      </div>

      <div className="space-y-4 print:hidden">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-l-4 border-primary pl-4 py-1">
          <div className="space-y-0.5">
            <h3 className="text-lg font-bold tracking-tight text-primary font-headline">Audit Summary</h3>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">{filteredData!.focusStats.dateLabel}</p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="border border-border/50 shadow-sm bg-white overflow-hidden h-20">
            <CardContent className="p-4 flex flex-col justify-center h-full">
              <span className="text-[9px] font-extrabold uppercase tracking-[0.2em] text-muted-foreground/80 mb-0.5">Collection</span>
              <div className="text-base font-bold text-emerald-600 tracking-tight">₹{filteredData!.focusStats.collection.toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card className="border border-border/50 shadow-sm bg-white overflow-hidden h-20">
            <CardContent className="p-4 flex flex-col justify-center h-full">
              <span className="text-[9px] font-extrabold uppercase tracking-[0.2em] text-muted-foreground/80 mb-0.5">Transactions</span>
              <div className="text-base font-bold tracking-tight text-foreground">{filteredData!.focusStats.txCount}</div>
            </CardContent>
          </Card>
          <Card className="border border-border/50 shadow-sm bg-white overflow-hidden border-l-4 border-l-destructive h-20">
            <CardContent className="p-4 flex flex-col justify-center h-full">
              <span className="text-[9px] font-extrabold uppercase tracking-[0.2em] text-destructive/80 mb-0.5">Arrears/Overdue</span>
              <div className="text-base font-bold tracking-tight text-destructive">{filteredData!.focusStats.pendingCount}</div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-4 bg-card p-4 rounded-xl border border-border/50 shadow-sm print:hidden">
        <div className="space-y-2">
          <label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">Select Date</label>
          <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
            <PopoverTrigger asChild><Button variant="outline" className="w-full h-10 justify-start text-left font-bold text-[11px] border-muted bg-white"><CalendarIcon className="mr-3 h-4 w-4 text-primary shrink-0" /><span className="flex-1 truncate">{selectedDate ? format(parseISO(selectedDate), "dd-MM-yyyy") : "Select Date"}</span></Button></PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start" side="bottom"><Calendar mode="single" selected={isValid(parseISO(selectedDate)) ? parseISO(selectedDate) : new Date()} onSelect={(date) => { if (date) { setSelectedDate(format(date, 'yyyy-MM-dd')); setIsDatePickerOpen(false); } }} disabled={(date) => date > new Date()} initialFocus /></PopoverContent>
          </Popover>
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">Collection Mode</label>
          <Select value={reportType} onValueChange={setReportType}>
            <SelectTrigger className="w-full h-10 text-[11px] font-bold bg-white"><Filter className="mr-2 size-3.5 text-primary" /><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="daily">Daily</SelectItem><SelectItem value="monthly">Monthly</SelectItem></SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">Month</label>
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-full h-10 text-[11px] font-bold bg-white"><CalendarIcon className="mr-2 size-3.5 text-primary" /><SelectValue /></SelectTrigger>
            <SelectContent>{MONTHS_MASTER.map(m => (<SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>))}</SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">Year</label>
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-full h-10 text-[11px] font-bold bg-white"><CalendarIcon className="mr-2 size-3.5 text-primary" /><SelectValue /></SelectTrigger>
            <SelectContent>{YEARS.map(y => (<SelectItem key={y} value={y}>{y}</SelectItem>))}</SelectContent>
          </Select>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full print:hidden">
        <TabsList className="grid w-full grid-cols-3 h-auto p-1 bg-muted/50 border rounded-xl overflow-x-auto">
          <TabsTrigger value="collections" className="py-2.5 text-[10px] font-bold uppercase tracking-widest gap-2"><Database className="size-3.5" /> Collections</TabsTrigger>
          <TabsTrigger value="yesterday-pending" className="py-2.5 text-[10px] font-bold uppercase tracking-widest gap-2"><History className="size-3.5" /> Prev Span Audit</TabsTrigger>
          <TabsTrigger value="today-pending" className="py-2.5 text-[10px] font-bold uppercase tracking-widest gap-2"><Clock className="size-3.5" /> Mode Audit List</TabsTrigger>
        </TabsList>
        <TabsContent value="collections" className="mt-6">
          <Card className="border-border/50 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead className="text-[10px] uppercase font-bold tracking-widest h-10 pl-6">Month</TableHead>
                    <TableHead className="text-right text-[10px] uppercase font-bold tracking-widest h-10 pr-6">Total Collection</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>{filteredData!.collectionData.length > 0 ? filteredData!.collectionData.map((row, i) => (<TableRow key={i} className="hover:bg-muted/5 transition-colors"><TableCell className="font-bold text-sm pl-6">{row.month}</TableCell><TableCell className="text-right font-bold text-emerald-600 text-sm tabular-nums pr-6">₹{row.amount.toLocaleString()}</TableCell></TableRow>)) : (<TableRow><TableCell colSpan={2} className="h-40 text-center text-muted-foreground italic text-sm">No collections found.</TableCell></TableRow>)}</TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>
        <TabsContent value="yesterday-pending" className="mt-6">
          <Card className="border-border/50 overflow-hidden shadow-sm">
            <div className="p-4 border-b bg-amber-50/50 flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-widest flex items-center gap-2 text-amber-700"><History className="size-4" /> Unpaid {reportType === 'daily' ? 'Yesterday' : 'Prev Span'}</h3>
              <Badge variant="outline" className="text-[10px] font-bold border-amber-200 text-amber-700">{filteredData!.unpaidYesterday.length} Participants</Badge>
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
                <TableBody>{filteredData!.unpaidYesterday.length > 0 ? filteredData!.unpaidYesterday.map((m, i) => (<TableRow key={i} className="hover:bg-muted/5 transition-colors"><TableCell className="pl-6 py-4 font-bold text-sm">{m.name}</TableCell><TableCell className="text-[10px] font-bold text-primary uppercase">{m.chitGroup}</TableCell><TableCell className="text-right pr-6 text-[10px] font-bold text-destructive uppercase">Unpaid</TableCell></TableRow>)) : (<TableRow><TableCell colSpan={3} className="h-40 text-center text-muted-foreground italic text-sm">Clear for span.</TableCell></TableRow>)}</TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>
        <TabsContent value="today-pending" className="mt-6">
          <Card className="border-border/50 overflow-hidden shadow-sm">
            <div className="p-4 border-b bg-blue-50/50 flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-widest flex items-center gap-2 text-blue-700"><Clock className="size-4" /> {reportType === 'daily' ? 'Today Pending' : 'Current Overdue'}</h3>
              <Badge variant="outline" className="text-[10px] font-bold border-blue-200 text-blue-700">{filteredData!.unpaidToday.length} Participants</Badge>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead className="text-[10px] uppercase font-bold tracking-widest h-10 pl-6">Member</TableHead>
                    <TableHead className="text-[10px] uppercase font-bold tracking-widest h-10">Group</TableHead>
                    <TableHead className="text-[10px] uppercase font-bold tracking-widest h-10 pr-6 text-right">Indicator</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>{filteredData!.unpaidToday.length > 0 ? filteredData!.unpaidToday.map((m, i) => (<TableRow key={i} className="hover:bg-muted/5 transition-colors"><TableCell className="pl-6 py-4 font-bold text-sm">{m.name}</TableCell><TableCell className="text-[10px] font-bold text-primary uppercase">{m.chitGroup}</TableCell><TableCell className="text-right pr-6 text-[10px] font-bold text-destructive uppercase">{reportType === 'daily' ? 'PENDING' : 'OVERDUE'}</TableCell></TableRow>)) : (<TableRow><TableCell colSpan={3} className="h-40 text-center text-muted-foreground italic text-sm">Clear registry.</TableCell></TableRow>)}</TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
