
"use client"

import { useState, useEffect, useMemo } from "react"
import { Download, Printer, Loader2, Database, Filter, CheckCircle2, Clock, Trophy, Users, IndianRupee, TrendingUp, Calendar } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
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
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, query, orderBy } from "firebase/firestore"
import { format, parseISO, isSameMonth, subMonths, isSameYear, getMonth, getYear } from "date-fns"
import * as XLSX from 'xlsx'
import { cn } from "@/lib/utils"

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
  
  const { toast } = useToast()
  const db = useFirestore()

  const membersQuery = useMemoFirebase(() => collection(db, 'members'), [db])
  const { data: members, isLoading: membersLoading } = useCollection(membersQuery)

  const paymentsQuery = useMemoFirebase(() => query(collection(db, 'payments'), orderBy('paymentDate', 'desc')), [db])
  const { data: payments, isLoading: paymentsLoading } = useCollection(paymentsQuery)

  const roundsQuery = useMemoFirebase(() => query(collection(db, 'chitRounds'), orderBy('date', 'desc')), [db])
  const { data: rounds, isLoading: roundsLoading } = useCollection(roundsQuery)

  useEffect(() => { setMounted(true) }, [])

  // Calculate which months actually have data for the selected year
  const availableMonths = useMemo(() => {
    if (!members || !payments || !rounds) return MONTHS_MASTER;

    const monthsWithData = new Set<number>();
    const currentYear = new Date().getFullYear().toString();
    const currentMonth = new Date().getMonth();

    // Scan members for join dates in the selected year
    members.forEach(m => {
      if (m.joinDate) {
        const d = parseISO(m.joinDate);
        if (getYear(d).toString() === selectedYear) {
          monthsWithData.add(getMonth(d));
        }
      }
    });

    // Scan payments for collection dates in the selected year
    payments.forEach(p => {
      if (p.paymentDate) {
        const d = parseISO(p.paymentDate);
        if (getYear(d).toString() === selectedYear) {
          monthsWithData.add(getMonth(d));
        }
      }
    });

    // Scan rounds for activity dates in the selected year
    rounds.forEach(r => {
      if (r.date) {
        const d = parseISO(r.date);
        if (getYear(d).toString() === selectedYear) {
          monthsWithData.add(getMonth(d));
        }
      }
    });

    // Always allow current month if viewing the current year
    if (selectedYear === currentYear) {
      monthsWithData.add(currentMonth);
    }

    const filtered = MONTHS_MASTER.filter(m => 
      m.value === "all" || monthsWithData.has(parseInt(m.value))
    );

    return filtered;
  }, [members, payments, rounds, selectedYear]);

  // Reset selected month if it's no longer available for the chosen year
  useEffect(() => {
    if (selectedMonth !== "all") {
      const isAvailable = availableMonths.some(m => m.value === selectedMonth);
      if (!isAvailable) {
        setSelectedMonth("all");
      }
    }
  }, [selectedYear, availableMonths, selectedMonth]);

  const filteredData = useMemo(() => {
    if (!mounted || !members || !payments || !rounds) return null;
    
    // 1. Filter by Scheme Type
    let targetMembers = members;
    if (reportType !== "all") {
      targetMembers = members.filter(m => {
        const round = rounds.find(r => r.name === m.chitGroup);
        return (round?.collectionType || "Monthly").toLowerCase() === reportType;
      });
    }
    const targetIds = new Set(targetMembers.map(m => m.id));

    // 2. Filter by Date (Month/Year)
    const isMatchingDate = (dateStr: string) => {
      if (!dateStr) return false;
      const d = parseISO(dateStr);
      const matchYear = getYear(d).toString() === selectedYear;
      const matchMonth = selectedMonth === "all" || getMonth(d).toString() === selectedMonth;
      return matchYear && matchMonth;
    };

    const periodMembers = targetMembers.filter(m => m.joinDate && isMatchingDate(m.joinDate));
    const successPayments = payments.filter(p => (p.status === 'paid' || p.status === 'success') && targetIds.has(p.memberId));
    const periodPayments = successPayments.filter(p => p.paymentDate && isMatchingDate(p.paymentDate));

    // Summary Metrics
    const totalCollected = periodPayments.reduce((acc, p) => acc + (p.amountPaid || 0), 0);
    const membersJoined = periodMembers.length;
    const paymentsCount = periodPayments.length;

    // Table Data
    const collectionDataByMonth = Array.from({ length: 12 }).map((_, i) => {
      const monthPayments = successPayments.filter(p => {
        const d = parseISO(p.paymentDate);
        return getYear(d).toString() === selectedYear && getMonth(d) === i;
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

    const pendingMembers = targetMembers.filter(m => {
      const paidInPeriod = successPayments.some(p => p.memberId === m.id && p.paymentDate && isMatchingDate(p.paymentDate));
      return !paidInPeriod;
    });

    return { 
      successPayments: periodPayments, 
      targetMembers, 
      periodMembers,
      collectionData: collectionDataByMonth, 
      pendingMembers,
      winners,
      metrics: {
        totalCollected,
        membersJoined,
        paymentsCount
      }
    };
  }, [mounted, reportType, selectedMonth, selectedYear, members, payments, rounds]);

  const handlePrint = () => {
    window.print();
  };

  const handleExportExcel = () => {
    if (!filteredData) return;

    let exportData: any[] = [];
    const fileName = `Report_${selectedYear}_${selectedMonth === 'all' ? 'FullYear' : MONTHS_MASTER.find(m => m.value === selectedMonth)?.label}.xlsx`;

    switch (activeTab) {
      case "collections":
        exportData = filteredData.collectionData.map(d => ({ Period: d.month, Amount: d.amount }));
        break;
      case "members":
        exportData = filteredData.targetMembers.map(m => ({ Name: m.name, Scheme: m.chitGroup, Amount: m.monthlyAmount, Status: m.status }));
        break;
      case "pending":
        exportData = filteredData.pendingMembers.map(m => ({ Name: m.name, Phone: m.phone, Due: m.monthlyAmount }));
        break;
      case "winners":
        exportData = filteredData.winners.map(w => ({ Winner: w.winnerName, Scheme: w.name, Round: w.roundNumber, WinningAmount: w.winningAmount }));
        break;
    }

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Report");
    XLSX.writeFile(wb, fileName);
    
    toast({ title: "Export Successful", description: `File saved as ${fileName}` });
  };

  if (!mounted || membersLoading || paymentsLoading || roundsLoading) {
    return (<div className="flex h-[60vh] items-center justify-center"><Loader2 className="size-8 animate-spin text-primary" /></div>)
  }

  if (!filteredData) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] space-y-4 p-4 text-center">
        <Database className="size-16 text-muted-foreground/20" />
        <h2 className="text-xl font-semibold">No report data available.</h2>
      </div>
    )
  }

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-500 pb-10 overflow-x-hidden print:p-0">
      {/* Filters Section */}
      <div className="flex flex-col gap-6 print:hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-2xl sm:text-3xl font-headline font-bold tracking-tight text-primary">Financial Reports</h2>
            <p className="text-sm text-muted-foreground">Comprehensive audit of fund collections and distributions.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
             <Button variant="outline" size="sm" className="h-10 px-4 text-[10px] font-bold uppercase tracking-widest shadow-sm hover:bg-muted" onClick={handlePrint}>
               <Printer className="mr-2 size-4" /> Print
             </Button>
             <Button size="sm" className="h-10 px-4 text-[10px] font-bold uppercase tracking-widest shadow-md" onClick={handleExportExcel}>
               <Download className="mr-2 size-4" /> Export Excel
             </Button>
          </div>
        </div>

        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 bg-card p-4 rounded-xl border border-border/50 shadow-sm">
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">Scheme Filter</label>
            <Select value={reportType} onValueChange={setReportType}>
              <SelectTrigger className="w-full h-10 text-[11px] font-bold">
                <Filter className="mr-2 size-3.5 text-primary" />
                <SelectValue placeholder="Scheme Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Schemes</SelectItem>
                <SelectItem value="daily">Daily Only</SelectItem>
                <SelectItem value="monthly">Monthly Only</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">Report Month</label>
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-full h-10 text-[11px] font-bold">
                <Calendar className="mr-2 size-3.5 text-primary" />
                <SelectValue placeholder="Month" />
              </SelectTrigger>
              <SelectContent>
                {availableMonths.map(m => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">Report Year</label>
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="w-full h-10 text-[11px] font-bold">
                <Calendar className="mr-2 size-3.5 text-primary" />
                <SelectValue placeholder="Year" />
              </SelectTrigger>
              <SelectContent>
                {YEARS.map(y => (
                  <SelectItem key={y} value={y}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Summary Metrics Grid */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Period Collections</CardTitle>
            <IndianRupee className="size-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">₹{filteredData.metrics.totalCollected.toLocaleString()}</div>
            <p className="text-[10px] text-muted-foreground mt-1 font-medium">{filteredData.metrics.paymentsCount} Transactions</p>
          </CardContent>
        </Card>

        <Card className="border-border/50 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">New Members Joined</CardTitle>
            <Users className="size-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filteredData.metrics.membersJoined}</div>
            <p className="text-[10px] text-muted-foreground mt-1 font-medium">During selected period</p>
          </CardContent>
        </Card>

        <Card className="border-border/50 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Target Reach</CardTitle>
            <TrendingUp className="size-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {filteredData.targetMembers.length > 0 ? Math.round((filteredData.metrics.membersJoined / filteredData.targetMembers.length) * 100) : 0}%
            </div>
            <p className="text-[10px] text-muted-foreground mt-1 font-medium">Growth vs Total Pool</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs & Detailed Reports */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 lg:grid-cols-4 h-auto p-1 bg-muted/50 border rounded-xl overflow-x-auto print:hidden">
          <TabsTrigger value="collections" className="py-3 text-[10px] font-bold uppercase tracking-widest data-[state=active]:bg-card data-[state=active]:shadow-sm">Collections</TabsTrigger>
          <TabsTrigger value="members" className="py-3 text-[10px] font-bold uppercase tracking-widest data-[state=active]:bg-card data-[state=active]:shadow-sm">Members</TabsTrigger>
          <TabsTrigger value="pending" className="py-3 text-[10px] font-bold uppercase tracking-widest data-[state=active]:bg-card data-[state=active]:shadow-sm">Pending Dues</TabsTrigger>
          <TabsTrigger value="winners" className="py-3 text-[10px] font-bold uppercase tracking-widest data-[state=active]:bg-card data-[state=active]:shadow-sm">Winners</TabsTrigger>
        </TabsList>

        <TabsContent value="collections" className="mt-8">
          <Card className="border-border/50 overflow-hidden shadow-sm">
            <div className="p-4 border-b bg-muted/20">
              <h3 className="text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                <Database className="size-4 text-primary" /> Monthly Revenue Breakdown
              </h3>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead className="text-[10px] uppercase font-bold tracking-widest h-12 pl-6">Period</TableHead>
                    <TableHead className="text-right text-[10px] uppercase font-bold tracking-widest h-12 pr-6">Total Collection</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredData.collectionData.length > 0 ? filteredData.collectionData.map((row, i) => (
                    <TableRow key={i} className="hover:bg-muted/5 transition-colors h-14">
                      <TableCell className="font-bold text-sm pl-6">{row.month}</TableCell>
                      <TableCell className="text-right font-bold text-emerald-600 text-sm tabular-nums pr-6">₹{row.amount.toLocaleString()}</TableCell>
                    </TableRow>
                  )) : (
                    <TableRow><TableCell colSpan={2} className="h-40 text-center text-muted-foreground italic text-sm">No collections in this period.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="members" className="mt-8">
          <Card className="border-border/50 overflow-hidden shadow-sm">
            <div className="p-4 border-b bg-muted/20">
              <h3 className="text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                <Users className="size-4 text-primary" /> Member Directory View
              </h3>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead className="text-[10px] uppercase font-bold tracking-widest h-12 pl-6">Member Name</TableHead>
                    <TableHead className="text-[10px] uppercase font-bold tracking-widest h-12">Scheme / Group</TableHead>
                    <TableHead className="text-right text-[10px] uppercase font-bold tracking-widest h-12">Monthly Due</TableHead>
                    <TableHead className="text-center text-[10px] uppercase font-bold tracking-widest h-12 pr-6">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredData.targetMembers.length > 0 ? filteredData.targetMembers.map((m, i) => (
                    <TableRow key={i} className="hover:bg-muted/5 transition-colors h-14">
                      <TableCell className="font-bold text-sm pl-6">{m.name}</TableCell>
                      <TableCell className="text-[10px] font-bold text-primary uppercase tracking-tight">{m.chitGroup || "N/A"}</TableCell>
                      <TableCell className="text-right font-bold text-sm tabular-nums">₹{m.monthlyAmount?.toLocaleString()}</TableCell>
                      <TableCell className="text-center pr-6">
                        <Badge variant={m.status === 'active' ? 'default' : 'secondary'} className="text-[8px] font-bold uppercase px-2 shadow-none border-none">
                          {m.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  )) : (
                    <TableRow>
                      <TableCell colSpan={4} className="h-40 text-center text-muted-foreground italic text-sm">No member data found.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="pending" className="mt-8">
          <Card className="border-border/50 overflow-hidden shadow-sm">
            <div className="p-4 border-b bg-muted/20">
              <h3 className="text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                <Clock className="size-4 text-amber-500" /> Outstanding Collections (Selected Period)
              </h3>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead className="text-[10px] uppercase font-bold tracking-widest h-12 pl-6">Member</TableHead>
                    <TableHead className="text-[10px] uppercase font-bold tracking-widest h-12">Contact</TableHead>
                    <TableHead className="text-right text-[10px] uppercase font-bold tracking-widest h-12 pr-6">Amount Due</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredData.pendingMembers.length > 0 ? filteredData.pendingMembers.map((m, i) => (
                    <TableRow key={i} className="hover:bg-muted/5 transition-colors h-14">
                      <TableCell className="font-bold text-sm pl-6">{m.name}</TableCell>
                      <TableCell className="text-xs font-medium text-muted-foreground tabular-nums">{m.phone}</TableCell>
                      <TableCell className="text-right font-bold text-amber-600 text-sm tabular-nums pr-6">₹{m.monthlyAmount?.toLocaleString()}</TableCell>
                    </TableRow>
                  )) : (
                    <TableRow>
                      <TableCell colSpan={3} className="h-40 text-center text-emerald-600 font-bold text-sm">
                        <CheckCircle2 className="size-8 mx-auto mb-2 opacity-30" />
                        Zero outstanding dues for this period!
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="winners" className="mt-8">
          <Card className="border-border/50 overflow-hidden shadow-sm">
            <div className="p-4 border-b bg-muted/20">
              <h3 className="text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                <Trophy className="size-4 text-amber-500" /> Auction History Breakdown
              </h3>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead className="text-[10px] uppercase font-bold tracking-widest h-12 pl-6">Winner Name</TableHead>
                    <TableHead className="text-[10px] uppercase font-bold tracking-widest h-12">Scheme</TableHead>
                    <TableHead className="text-[10px] uppercase font-bold tracking-widest h-12">Round #</TableHead>
                    <TableHead className="text-right text-[10px] uppercase font-bold tracking-widest h-12 pr-6">Winning Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredData.winners.length > 0 ? filteredData.winners.map((r, i) => (
                    <TableRow key={i} className="hover:bg-muted/5 transition-colors h-14">
                      <TableCell className="font-bold text-sm pl-6">{r.winnerName}</TableCell>
                      <TableCell className="text-[10px] font-bold text-primary uppercase">{r.name}</TableCell>
                      <TableCell className="text-xs font-bold text-muted-foreground">{r.roundNumber}</TableCell>
                      <TableCell className="text-right font-bold text-emerald-600 text-sm tabular-nums pr-6">₹{r.winningAmount?.toLocaleString()}</TableCell>
                    </TableRow>
                  )) : (
                    <TableRow>
                      <TableCell colSpan={4} className="h-40 text-center text-muted-foreground italic text-sm">No winners recorded in this period.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
