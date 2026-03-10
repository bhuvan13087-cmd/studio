
"use client"

import { useEffect, useState } from "react"
import { Users, IndianRupee, AlertCircle, Calendar, Clock, CheckCircle2, DollarSign, Loader2, Database } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { Area, AreaChart, CartesianGrid, XAxis, YAxis, Bar, BarChart } from "recharts"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, query, orderBy } from "firebase/firestore"
import { format, isSameMonth, parseISO, subMonths } from "date-fns"

const chartConfig = {
  collected: {
    label: "Collected",
    color: "hsl(var(--primary))",
  },
  pending: {
    label: "Pending",
    color: "hsl(var(--accent))",
  },
} satisfies ChartConfig

const barChartConfig = {
  total: {
    label: "Total Collection",
    color: "hsl(var(--primary))",
  },
} satisfies ChartConfig

export default function DashboardPage() {
  const [mounted, setMounted] = useState(false)
  const [revenueView, setRevenueView] = useState<'month' | 'today'>('month')
  const db = useFirestore()

  const membersQuery = useMemoFirebase(() => collection(db, 'members'), [db])
  const { data: members, isLoading: membersLoading } = useCollection(membersQuery)

  const paymentsQuery = useMemoFirebase(() => query(collection(db, 'payments'), orderBy('paymentDate', 'desc')), [db])
  const { data: payments, isLoading: paymentsLoading } = useCollection(paymentsQuery)

  const roundsQuery = useMemoFirebase(() => query(collection(db, 'chitRounds'), orderBy('date', 'desc')), [db])
  const { data: rounds, isLoading: roundsLoading } = useCollection(roundsQuery)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted || membersLoading || paymentsLoading || roundsLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    )
  }

  const noData = (!members || members.length === 0) && (!payments || payments.length === 0) && (!rounds || rounds.length === 0)

  if (noData) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] space-y-4 p-4 text-center">
        <Database className="size-16 text-muted-foreground/20" />
        <h2 className="text-xl font-semibold">No data available.</h2>
        <p className="text-muted-foreground max-w-sm">
          Start by adding members or recording payments to see your dashboard insights.
        </p>
      </div>
    )
  }

  // --- Calculations ---
  const now = new Date()
  const currentMonthPayments = (payments || []).filter(p => p.paymentDate && isSameMonth(parseISO(p.paymentDate), now))
  const collectedThisMonth = currentMonthPayments.filter(p => p.status === 'paid' || p.status === 'success').reduce((acc, p) => acc + (p.amountPaid || 0), 0)
  
  const collectedToday = (payments || []).filter(p => p.paymentDate && format(parseISO(p.paymentDate), 'yyyy-MM-dd') === format(now, 'yyyy-MM-dd') && (p.status === 'paid' || p.status === 'success')).reduce((acc, p) => acc + (p.amountPaid || 0), 0)

  const pendingMembers = (members || []).filter(m => {
    const paidThisMonth = currentMonthPayments.some(p => p.memberId === m.id && (p.status === 'paid' || p.status === 'success'));
    return !paidThisMonth;
  });
  const pendingPaymentsCount = pendingMembers.length
  
  const futureRounds = (rounds || []).filter(r => r.date && parseISO(r.date) > now).sort((a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime())
  const nextRoundDate = futureRounds.length > 0 ? format(parseISO(futureRounds[0].date), 'MMM dd') : 'None scheduled'
  const nextRoundDays = futureRounds.length > 0 ? Math.ceil((parseISO(futureRounds[0].date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null

  const last6Months = Array.from({ length: 6 }).map((_, i) => subMonths(now, i)).reverse()
  const financialChartData = last6Months.map(monthDate => {
    const monthPayments = (payments || []).filter(p => p.paymentDate && isSameMonth(parseISO(p.paymentDate), monthDate))
    return {
      month: format(monthDate, 'MMM'),
      collected: monthPayments.filter(p => p.status === 'paid' || p.status === 'success').reduce((acc, p) => acc + (p.amountPaid || 0), 0),
      pending: monthPayments.filter(p => p.status === 'pending').reduce((acc, p) => acc + (p.amountPaid || 0), 0),
    }
  })

  const recentWinners = (rounds || []).filter(r => r.status === 'completed').slice(0, 4)
  const recentPaymentsList = (payments || []).filter(p => p.status === 'paid' || p.status === 'success').slice(0, 5)
  const pendingMembersList = pendingMembers.slice(0, 3)

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-10 overflow-x-hidden">
      <div className="flex flex-col gap-1.5">
        <h2 className="text-2xl sm:text-3xl font-headline font-bold tracking-tight">Dashboard Overview</h2>
        <p className="text-sm sm:text-base text-muted-foreground">Monitor your chit fund's financial health in real-time.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="hover:shadow-md transition-shadow duration-200">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs sm:text-sm font-medium">Total Members</CardTitle>
            <Users className="size-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-xl sm:text-2xl font-bold">{members?.length || 0}</div>
            <p className="text-[10px] sm:text-xs text-muted-foreground mt-1 uppercase font-semibold">Active participants</p>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow duration-200 overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs sm:text-sm font-medium">Revenue</CardTitle>
            <div className="flex items-center gap-1.5">
              <Select value={revenueView} onValueChange={(v: any) => setRevenueView(v)}>
                <SelectTrigger className="h-6 w-fit min-w-[70px] text-[8px] sm:text-[10px] font-bold border-none bg-muted/50 focus:ring-0 shadow-none px-1.5 sm:px-2">
                  <SelectValue placeholder="Period" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="month" className="text-[10px] font-bold">This Month</SelectItem>
                  <SelectItem value="today" className="text-[10px] font-bold">Today</SelectItem>
                </SelectContent>
              </Select>
              <IndianRupee className="size-4 text-accent" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-xl sm:text-2xl font-bold text-primary">
              ₹{(revenueView === 'month' ? collectedThisMonth : collectedToday).toLocaleString()}
            </div>
            <p className="text-[10px] sm:text-xs text-muted-foreground font-semibold mt-1 uppercase">
              {revenueView === 'month' ? 'Current Cycle' : 'Collected Today'}
            </p>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow duration-200">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs sm:text-sm font-medium">Pending Payments</CardTitle>
            <AlertCircle className="size-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-xl sm:text-2xl font-bold">{pendingPaymentsCount}</div>
            <p className="text-[10px] sm:text-xs text-muted-foreground mt-1 uppercase font-semibold">Outstanding dues</p>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow duration-200">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs sm:text-sm font-medium">Next Round</CardTitle>
            <Calendar className="size-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-xl sm:text-2xl font-bold">{nextRoundDate}</div>
            <p className="text-[10px] sm:text-xs text-muted-foreground mt-1 uppercase font-semibold">
              {nextRoundDays ? `In ${nextRoundDays} days` : 'Not scheduled'}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-7">
        <Card className="lg:col-span-4 border-border/50">
          <CardHeader>
            <CardTitle className="text-lg">Financial Performance</CardTitle>
            <CardDescription className="text-xs sm:text-sm">Monthly collection vs pending dues (Last 6 Months).</CardDescription>
          </CardHeader>
          <CardContent className="px-1 sm:px-6">
            <ChartContainer config={chartConfig} className="h-[250px] sm:h-[300px] w-full">
              <AreaChart data={financialChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorCollected" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorPending" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--accent))" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="hsl(var(--accent))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `₹${v/1000}k`} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area type="monotone" dataKey="collected" stroke="hsl(var(--primary))" fill="url(#colorCollected)" strokeWidth={2} />
                <Area type="monotone" dataKey="pending" stroke="hsl(var(--accent))" fill="url(#colorPending)" strokeWidth={2} />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3 border-border/50 overflow-hidden">
          <CardHeader>
            <CardTitle className="text-lg">Recent Winners</CardTitle>
            <CardDescription className="text-xs sm:text-sm">Members who won the latest auction rounds.</CardDescription>
          </CardHeader>
          <CardContent className="px-4 sm:px-6">
            {recentWinners.length > 0 ? (
              <div className="space-y-4 sm:space-y-6">
                {recentWinners.map((winner, i) => (
                  <div key={i} className="flex items-center gap-3 sm:gap-4">
                    <div className="flex h-8 w-8 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs sm:text-sm">
                      {winner.winnerName?.split(' ').map(n => n[0]).join('') || '?'}
                    </div>
                    <div className="flex-1 min-w-0 space-y-0.5 sm:space-y-1">
                      <p className="text-xs sm:text-sm font-medium leading-none truncate">{winner.winnerName}</p>
                      <p className="text-[10px] sm:text-xs text-muted-foreground truncate">Round #{winner.roundNumber} • {winner.date ? format(parseISO(winner.date), 'MMM dd') : '-'}</p>
                    </div>
                    <div className="font-bold text-emerald-600 text-xs sm:text-sm tabular-nums shrink-0">₹{winner.winningAmount?.toLocaleString()}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground italic text-xs sm:text-sm">
                No completed rounds yet.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-border/50 overflow-hidden">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
               <Clock className="size-4 sm:size-5 text-amber-500" />
               Pending Members
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">Members yet to pay for this month.</CardDescription>
          </CardHeader>
          <CardContent className="px-0 sm:px-6">
            <div className="rounded-md border sm:border-none">
              <Table>
                <TableHeader className="sm:bg-muted/30">
                  <TableRow>
                    <TableHead className="text-[10px] sm:text-xs uppercase font-bold tracking-wider">Member</TableHead>
                    <TableHead className="hidden sm:table-cell text-[10px] sm:text-xs uppercase font-bold tracking-wider">Phone</TableHead>
                    <TableHead className="text-right text-[10px] sm:text-xs uppercase font-bold tracking-wider">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingMembersList.length > 0 ? pendingMembersList.map((member, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-xs sm:text-sm font-medium truncate max-w-[100px] sm:max-w-none">{member.name}</TableCell>
                      <TableCell className="hidden sm:table-cell text-xs">{member.phone}</TableCell>
                      <TableCell className="text-right font-semibold text-xs sm:text-sm tabular-nums text-amber-600">₹{member.monthlyAmount?.toLocaleString()}</TableCell>
                    </TableRow>
                  )) : (
                    <TableRow>
                      <TableCell colSpan={3} className="h-24 text-center text-muted-foreground italic text-xs sm:text-sm">
                        Zero pending dues this month.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 overflow-hidden">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
               <CheckCircle2 className="size-4 sm:size-5 text-emerald-500" />
               Recent Activity
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">Latest transactions recorded.</CardDescription>
          </CardHeader>
          <CardContent className="px-4 sm:px-6">
             {recentPaymentsList.length > 0 ? (
               <div className="space-y-3">
                 {recentPaymentsList.map((payment, i) => (
                   <div key={i} className="flex items-center justify-between p-2.5 sm:p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                      <div className="flex flex-col min-w-0">
                         <span className="font-medium text-xs sm:text-sm truncate">{payment.memberName}</span>
                         <span className="text-[9px] sm:text-[10px] text-muted-foreground">{payment.paymentDate ? format(parseISO(payment.paymentDate), 'MMM dd, hh:mm a') : '-'}</span>
                      </div>
                      <div className="flex flex-col items-end shrink-0 pl-2">
                         <span className="font-bold text-emerald-600 text-xs sm:text-sm tabular-nums">₹{payment.amountPaid?.toLocaleString()}</span>
                         <span className="text-[8px] sm:text-[9px] uppercase font-bold text-muted-foreground tracking-tighter">Success</span>
                      </div>
                   </div>
                 ))}
               </div>
             ) : (
               <div className="h-[200px] flex items-center justify-center text-muted-foreground italic text-xs sm:text-sm">
                 No recent activity found.
               </div>
             )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/50 overflow-hidden">
        <CardHeader>
          <CardTitle className="text-lg">Monthly Collection Trends</CardTitle>
          <CardDescription className="text-xs sm:text-sm">Revenue trends over the past 6 months.</CardDescription>
        </CardHeader>
        <CardContent className="px-1 sm:px-6">
           <ChartContainer config={barChartConfig} className="h-[250px] sm:h-[300px] w-full">
              <BarChart data={financialChartData} margin={{ top: 20, right: 10, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `₹${v/1000}k`} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="collected" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} barSize={32} />
              </BarChart>
           </ChartContainer>
        </CardContent>
      </Card>
    </div>
  )
}
