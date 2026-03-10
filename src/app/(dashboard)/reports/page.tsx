
"use client"

import { useState, useEffect, useMemo } from "react"
import { Download, Printer, TrendingUp, DollarSign, User, Clock, Trophy, Loader2, Database, Calendar, BarChart3, Filter } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Cell, Pie, PieChart } from "recharts"
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
import { format, parseISO, isSameMonth, subMonths, isSameYear } from "date-fns"

const chartConfig = { amount: { label: "Revenue", color: "hsl(var(--primary))" } } satisfies ChartConfig
const pieChartConfig = { value: { label: "Percentage" } } satisfies ChartConfig

export default function ReportsPage() {
  const [mounted, setMounted] = useState(false)
  const [reportType, setReportType] = useState("all")
  const { toast } = useToast()
  const db = useFirestore()

  const membersQuery = useMemoFirebase(() => collection(db, 'members'), [db])
  const { data: members, isLoading: membersLoading } = useCollection(membersQuery)

  const paymentsQuery = useMemoFirebase(() => query(collection(db, 'payments'), orderBy('paymentDate', 'desc')), [db])
  const { data: payments, isLoading: paymentsLoading } = useCollection(paymentsQuery)

  const roundsQuery = useMemoFirebase(() => query(collection(db, 'chitRounds'), orderBy('date', 'desc')), [db])
  const { data: rounds, isLoading: roundsLoading } = useCollection(roundsQuery)

  useEffect(() => { setMounted(true) }, [])

  const filteredData = useMemo(() => {
    if (!mounted || !members || !payments || !rounds) return null;
    const now = new Date();
    let targetMembers = members;
    if (reportType !== "all") {
      targetMembers = members.filter(m => {
        const round = rounds.find(r => r.name === m.chitGroup);
        return (round?.collectionType || "Monthly").toLowerCase() === reportType;
      });
    }
    const targetIds = new Set(targetMembers.map(m => m.id));
    const successPayments = payments.filter(p => (p.status === 'paid' || p.status === 'success') && targetIds.has(p.memberId));
    const totalRevenue = successPayments.filter(p => p.paymentDate && isSameYear(parseISO(p.paymentDate), now)).reduce((acc, p) => acc + (p.amountPaid || 0), 0)
    const last6Months = Array.from({ length: 6 }).map((_, i) => subMonths(now, i)).reverse()
    const collectionData = last6Months.map(month => ({ month: format(month, 'MMM'), amount: successPayments.filter(p => p.paymentDate && isSameMonth(parseISO(p.paymentDate), month)).reduce((acc, p) => acc + (p.amountPaid || 0), 0) }))
    const paidCount = targetMembers.filter(m => successPayments.some(p => p.memberId === m.id && p.paymentDate && isSameMonth(parseISO(p.paymentDate), now))).length
    const totalM = targetMembers.length || 1
    const statusData = [
      { name: "Success", value: Math.round((paidCount / totalM) * 100), color: "hsl(var(--primary))" },
      { name: "Pending", value: Math.round(((totalM - paidCount) / totalM) * 100), color: "hsl(var(--accent))" },
    ]
    return { successPayments, targetMembers, totalRevenue, collectionData, statusData, paidCount, totalM, roundsList: rounds.filter(r => reportType === "all" || (r.collectionType || "Monthly").toLowerCase() === reportType) };
  }, [mounted, reportType, members, payments, rounds]);

  if (!mounted || membersLoading || paymentsLoading || roundsLoading) {
    return (<div className="flex h-[60vh] items-center justify-center"><Loader2 className="size-8 animate-spin text-primary" /></div>)
  }

  if (!filteredData) {
    return (<div className="flex flex-col items-center justify-center h-[60vh] space-y-4 p-4 text-center"><Database className="size-16 text-muted-foreground/20" /><h2 className="text-xl font-semibold">No analytics available.</h2></div>)
  }

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-500 pb-10 overflow-x-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-2xl sm:text-3xl font-headline font-bold tracking-tight">Financial Reports</h2>
          <p className="text-sm sm:text-base text-muted-foreground">Comprehensive performance audit and trends.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
           <Select value={reportType} onValueChange={setReportType}>
             <SelectTrigger className="w-[120px] sm:w-[140px] h-9 text-xs font-bold uppercase"><Filter className="mr-2 size-3 text-primary" /><SelectValue placeholder="Scheme" /></SelectTrigger>
             <SelectContent><SelectItem value="all">All Schemes</SelectItem><SelectItem value="daily">Daily</SelectItem><SelectItem value="monthly">Monthly</SelectItem></SelectContent>
           </Select>
           <Button size="sm" className="h-9 px-4 text-xs font-bold shadow-md" onClick={() => toast({ title: "Exporting PDF..." })}><Download className="mr-2 size-4" /> Export</Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="shadow-sm border-l-4 border-l-emerald-500"><CardHeader className="p-4 pb-2"><CardTitle className="text-xs uppercase font-bold text-muted-foreground flex items-center gap-2"><DollarSign className="size-3.5 text-emerald-500" /> YTD Revenue</CardTitle></CardHeader><CardContent className="p-4 pt-0"><div className="text-2xl font-bold tabular-nums">₹{filteredData.totalRevenue.toLocaleString()}</div></CardContent></Card>
        <Card className="shadow-sm border-l-4 border-l-primary"><CardHeader className="p-4 pb-2"><CardTitle className="text-xs uppercase font-bold text-muted-foreground flex items-center gap-2"><Calendar className="size-3.5 text-primary" /> Monthly Avg</CardTitle></CardHeader><CardContent className="p-4 pt-0"><div className="text-2xl font-bold tabular-nums">₹{Math.round(filteredData.totalRevenue / (new Date().getMonth() + 1)).toLocaleString()}</div></CardContent></Card>
        <Card className="shadow-sm border-l-4 border-l-accent"><CardHeader className="p-4 pb-2"><CardTitle className="text-xs uppercase font-bold text-muted-foreground flex items-center gap-2"><BarChart3 className="size-3.5 text-accent" /> Efficiency</CardTitle></CardHeader><CardContent className="p-4 pt-0"><div className="text-2xl font-bold tabular-nums">{Math.round((filteredData.paidCount / filteredData.totalM) * 100)}%</div></CardContent></Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-7">
        <Card className="lg:col-span-4 border-border/50 overflow-hidden">
          <CardHeader><CardTitle className="text-lg">Revenue Trends</CardTitle><CardDescription className="text-xs sm:text-sm">Historical collections overview.</CardDescription></CardHeader>
          <CardContent className="px-1 sm:px-6">
             <ChartContainer config={chartConfig} className="h-[250px] sm:h-[350px] w-full">
                <BarChart data={filteredData.collectionData} margin={{ top: 20, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={10} axisLine={false} tickLine={false} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${v/1000}k`} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="amount" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} barSize={32} />
                </BarChart>
             </ChartContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3 border-border/50 overflow-hidden">
          <CardHeader><CardTitle className="text-lg">Status Share</CardTitle><CardDescription className="text-xs sm:text-sm">Participation breakdown.</CardDescription></CardHeader>
          <CardContent className="flex flex-col items-center">
             <ChartContainer config={pieChartConfig} className="h-[220px] sm:h-[250px] w-full">
                <PieChart><Pie data={filteredData.statusData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">{filteredData.statusData.map((e, i) => (<Cell key={`cell-${i}`} fill={e.color} />))}</Pie><ChartTooltip content={<ChartTooltipContent />} /></PieChart>
             </ChartContainer>
             <div className="w-full space-y-3 mt-4 px-4 sm:px-10">
                {filteredData.statusData.map((item, i) => (
                   <div key={i} className="flex items-center justify-between text-xs sm:text-sm"><div className="flex items-center gap-2"><div className="size-2.5 rounded-full" style={{ backgroundColor: item.color }} /><span>{item.name}</span></div><span className="font-bold tabular-nums">{item.value}%</span></div>
                ))}
             </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="collections" className="w-full">
        <TabsList className="grid w-full grid-cols-2 lg:grid-cols-4 h-auto p-1 bg-muted/50 border overflow-x-auto">
          <TabsTrigger value="collections" className="py-2.5 text-xs font-bold uppercase">Collections</TabsTrigger>
          <TabsTrigger value="members" className="py-2.5 text-xs font-bold uppercase">Members</TabsTrigger>
          <TabsTrigger value="pending" className="py-2.5 text-xs font-bold uppercase">Pending</TabsTrigger>
          <TabsTrigger value="winners" className="py-2.5 text-xs font-bold uppercase">Winners</TabsTrigger>
        </TabsList>
        <TabsContent value="collections" className="mt-6"><div className="rounded-xl border bg-card overflow-hidden"><div className="overflow-x-auto"><Table><TableHeader className="bg-muted/30"><TableRow><TableHead className="text-xs uppercase font-bold">Month</TableHead><TableHead className="text-right text-xs uppercase font-bold">Revenue</TableHead></TableRow></TableHeader><TableBody>{filteredData.collectionData.map((row, i) => (<TableRow key={i}><TableCell className="font-semibold">{row.month}</TableCell><TableCell className="text-right font-bold text-emerald-600 tabular-nums">₹{row.amount.toLocaleString()}</TableCell></TableRow>))}</TableBody></Table></div></div></TabsContent>
      </Tabs>
    </div>
  )
}
