
"use client"

import { useEffect, useState } from "react"
import { Users, IndianRupee, TrendingUp, AlertCircle, Calendar, ArrowUpRight, ArrowDownRight, Clock, CheckCircle2, DollarSign, Loader2, Database } from "lucide-react"
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
import { Badge } from "@/components/ui/badge"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, query, orderBy, limit } from "firebase/firestore"
import { format, isSameMonth, parseISO, startOfMonth, endOfMonth, subMonths } from "date-fns"

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
      <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
        <Database className="size-16 text-muted-foreground/20" />
        <h2 className="text-xl font-semibold">No data available. Please add records.</h2>
        <p className="text-muted-foreground text-center max-w-sm">
          Start by adding members or recording payments to see your dashboard insights.
        </p>
      </div>
    )
  }

  // --- Calculations ---
  const now = new Date()
  const currentMonthPayments = (payments || []).filter(p => p.paymentDate && isSameMonth(parseISO(p.paymentDate), now))
  const collectedThisMonth = currentMonthPayments.filter(p => p.status === 'paid' || p.status === 'success').reduce((acc, p) => acc + (p.amountPaid || 0), 0)
  
  // Real-time pending count derived from members who haven't paid this cycle
  const pendingPaymentsCount = (members || []).filter(m => m.paymentStatus === 'pending').length
  
  const futureRounds = (rounds || []).filter(r => r.date && parseISO(r.date) > now).sort((a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime())
  const nextRoundDate = futureRounds.length > 0 ? format(parseISO(futureRounds[0].date), 'MMM dd') : 'None scheduled'
  const nextRoundDays = futureRounds.length > 0 ? Math.ceil((parseISO(futureRounds[0].date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null

  // Financial Performance Chart (last 6 months)
  const last6Months = Array.from({ length: 6 }).map((_, i) => subMonths(now, i)).reverse()
  const financialChartData = last6Months.map(monthDate => {
    const monthPayments = (payments || []).filter(p => p.paymentDate && isSameMonth(parseISO(p.paymentDate), monthDate))
    return {
      month: format(monthDate, 'MMM'),
      collected: monthPayments.filter(p => p.status === 'paid' || p.status === 'success').reduce((acc, p) => acc + (p.amountPaid || 0), 0),
      pending: monthPayments.filter(p => p.status === 'pending').reduce((acc, p) => acc + (p.amountPaid || 0), 0),
    }
  })

  // Recent Winners
  const recentWinners = (rounds || []).filter(r => r.status === 'completed').slice(0, 4)
  
  // Recent Payments
  const recentPaymentsList = (payments || []).filter(p => p.status === 'paid' || p.status === 'success').slice(0, 5)

  // Pending Members
  const pendingMembersList = (members || []).filter(m => m.paymentStatus === 'pending').slice(0, 3)

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-10">
      <div className="flex flex-col gap-2">
        <h2 className="text-3xl font-headline font-bold tracking-tight">Overview</h2>
        <p className="text-muted-foreground">Monitor your chit fund's financial health with real-time data.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="hover:shadow-md transition-shadow duration-200">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Total Members</CardTitle>
            <Users className="size-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{members?.length || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Total active participants</p>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow duration-200">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Collected This Month</CardTitle>
            <IndianRupee className="size-4 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{collectedThisMonth.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
              Current cycle revenue
            </p>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow duration-200">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Pending Payments</CardTitle>
            <AlertCircle className="size-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingPaymentsCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Members yet to pay</p>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow duration-200">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Next Round Date</CardTitle>
            <Calendar className="size-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{nextRoundDate}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {nextRoundDays ? `In ${nextRoundDays} days` : 'Schedule required'}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
        <Card className="lg:col-span-4 border-border/50">
          <CardHeader>
            <CardTitle>Financial Performance</CardTitle>
            <CardDescription>Monthly collection vs pending dues over the last 6 months.</CardDescription>
          </CardHeader>
          <CardContent className="pl-2">
            <ChartContainer config={chartConfig} className="h-[300px] w-full">
              <AreaChart data={financialChartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorCollected" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorPending" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--accent))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--accent))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area
                  type="monotone"
                  dataKey="collected"
                  stroke="hsl(var(--primary))"
                  fillOpacity={1}
                  fill="url(#colorCollected)"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="pending"
                  stroke="hsl(var(--accent))"
                  fillOpacity={1}
                  fill="url(#colorPending)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3 border-border/50">
          <CardHeader>
            <CardTitle>Recent Winners</CardTitle>
            <CardDescription>History of members who won the latest rounds.</CardDescription>
          </CardHeader>
          <CardContent>
            {recentWinners.length > 0 ? (
              <div className="space-y-6">
                {recentWinners.map((winner, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-bold">
                      {winner.winnerName?.split(' ').map(n => n[0]).join('') || '?'}
                    </div>
                    <div className="flex-1 space-y-1">
                      <p className="text-sm font-medium leading-none">{winner.winnerName}</p>
                      <p className="text-xs text-muted-foreground">Round #{winner.roundNumber} • {winner.date ? format(parseISO(winner.date), 'MMM dd') : '-'}</p>
                    </div>
                    <div className="font-bold text-emerald-600">₹{winner.winningAmount?.toLocaleString()}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground italic text-sm">
                No completed rounds yet.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="hover:shadow-md transition-shadow duration-200 border-l-4 border-l-emerald-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Today's Collection</CardTitle>
            <div className="h-8 w-8 rounded-full bg-emerald-100 flex items-center justify-center">
               <DollarSign className="size-4 text-emerald-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-emerald-600">
              ₹{payments?.filter(p => p.paymentDate && format(parseISO(p.paymentDate), 'yyyy-MM-dd') === format(now, 'yyyy-MM-dd') && (p.status === 'paid' || p.status === 'success')).reduce((acc, p) => acc + (p.amountPaid || 0), 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Total payments received today</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
               <Clock className="size-5 text-amber-500" />
               Pending Members
            </CardTitle>
            <CardDescription>Members who haven't paid for the current month.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingMembersList.length > 0 ? pendingMembersList.map((member, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{member.name}</TableCell>
                      <TableCell>{member.phone}</TableCell>
                      <TableCell className="text-right font-semibold">₹{member.monthlyAmount?.toLocaleString()}</TableCell>
                    </TableRow>
                  )) : (
                    <TableRow>
                      <TableCell colSpan={3} className="h-24 text-center text-muted-foreground italic">
                        No pending members this month.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
               <CheckCircle2 className="size-5 text-emerald-500" />
               Recent Payments
            </CardTitle>
            <CardDescription>Latest transactions recorded in the system.</CardDescription>
          </CardHeader>
          <CardContent>
             {recentPaymentsList.length > 0 ? (
               <div className="space-y-4">
                 {recentPaymentsList.map((payment, i) => (
                   <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                      <div className="flex flex-col">
                         <span className="font-medium text-sm">{payment.memberName}</span>
                         <span className="text-xs text-muted-foreground">{payment.paymentDate ? format(parseISO(payment.paymentDate), 'MMM dd, hh:mm a') : '-'}</span>
                      </div>
                      <div className="flex flex-col items-end">
                         <span className="font-bold text-emerald-600 text-sm">₹{payment.amountPaid?.toLocaleString()}</span>
                         <span className="text-[10px] uppercase font-semibold text-muted-foreground">Success</span>
                      </div>
                   </div>
                 ))}
               </div>
             ) : (
               <div className="h-[200px] flex items-center justify-center text-muted-foreground italic text-sm">
                 No recent payments found.
               </div>
             )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/50">
        <CardHeader>
          <CardTitle>Monthly Collection Trends</CardTitle>
          <CardDescription>Overview of total funds collected per month.</CardDescription>
        </CardHeader>
        <CardContent>
           <ChartContainer config={barChartConfig} className="h-[300px] w-full">
              <BarChart data={financialChartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `₹${value / 1000}k`} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="collected" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
           </ChartContainer>
        </CardContent>
      </Card>
    </div>
  )
}
