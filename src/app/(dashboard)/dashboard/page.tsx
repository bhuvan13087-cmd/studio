"use client"

import { useEffect, useState } from "react"
import { Users, IndianRupee, TrendingUp, AlertCircle, Calendar, ArrowUpRight, ArrowDownRight, Clock, CheckCircle2, DollarSign } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { Area, AreaChart, CartesianGrid, XAxis, YAxis, Bar, BarChart, ResponsiveContainer } from "recharts"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"

const chartData = [
  { month: "Jan", collected: 45000, pending: 5000 },
  { month: "Feb", collected: 52000, pending: 3000 },
  { month: "Mar", collected: 48000, pending: 7000 },
  { month: "Apr", collected: 61000, pending: 2000 },
  { month: "May", collected: 55000, pending: 4500 },
  { month: "Jun", collected: 67000, pending: 1500 },
]

const monthlyCollectionData = [
  { month: "Jul", total: 62000 },
  { month: "Aug", total: 58000 },
  { month: "Sep", total: 71000 },
  { month: "Oct", total: 65000 },
  { month: "Nov", total: 69000 },
  { month: "Dec", total: 75000 },
]

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

const pendingMembers = [
  { name: "Robert Wilson", amount: "₹5,000", daysOverdue: 5 },
  { name: "Lisa Wong", amount: "₹5,000", daysOverdue: 3 },
  { name: "David Miller", amount: "₹5,000", daysOverdue: 12 },
]

const recentPayments = [
  { member: "John Doe", amount: "₹5,000", date: "Today, 10:30 AM", status: "completed" },
  { member: "Sarah Smith", amount: "₹5,000", date: "Today, 09:15 AM", status: "completed" },
  { member: "Michael Chen", amount: "₹5,000", date: "Yesterday", status: "completed" },
  { member: "Emma Watson", amount: "₹5,000", date: "Yesterday", status: "completed" },
  { member: "Chris Evans", amount: "₹5,000", date: "2 days ago", status: "completed" },
]

export default function DashboardPage() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-10">
      <div className="flex flex-col gap-2">
        <h2 className="text-3xl font-headline font-bold tracking-tight">Overview</h2>
        <p className="text-muted-foreground">Monitor your chit fund's financial health at a glance.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="hover:shadow-md transition-shadow duration-200">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Total Members</CardTitle>
            <Users className="size-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">124</div>
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
              <span className="text-emerald-500 font-medium inline-flex items-center">
                <ArrowUpRight className="size-3" /> +4
              </span>
              since last month
            </p>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow duration-200">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Collected This Month</CardTitle>
            <IndianRupee className="size-4 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹67,200</div>
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
              <span className="text-emerald-500 font-medium inline-flex items-center">
                <ArrowUpRight className="size-3" /> +12%
              </span>
              from target
            </p>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow duration-200">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Pending Payments</CardTitle>
            <AlertCircle className="size-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">12</div>
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
              <span className="text-rose-500 font-medium inline-flex items-center">
                <ArrowDownRight className="size-3" /> -2
              </span>
              from yesterday
            </p>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow duration-200">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Next Round Date</CardTitle>
            <Calendar className="size-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Oct 15</div>
            <p className="text-xs text-muted-foreground mt-1">In 12 days</p>
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
              <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
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
            <div className="space-y-6">
              {[
                { name: "John Doe", amount: "₹45,000", round: "Round 12", date: "Sep 15" },
                { name: "Sarah Smith", amount: "₹45,000", round: "Round 11", date: "Aug 15" },
                { name: "Michael Chen", amount: "₹45,000", round: "Round 10", date: "Jul 15" },
                { name: "Emma Watson", amount: "₹45,000", round: "Round 9", date: "Jun 15" },
              ].map((winner, i) => (
                <div key={i} className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-bold">
                    {winner.name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div className="flex-1 space-y-1">
                    <p className="text-sm font-medium leading-none">{winner.name}</p>
                    <p className="text-xs text-muted-foreground">{winner.round} • {winner.date}</p>
                  </div>
                  <div className="font-bold text-emerald-600">{winner.amount}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* NEW WIDGETS START HERE */}
      
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Widget 1: Today's Collection */}
        <Card className="hover:shadow-md transition-shadow duration-200 border-l-4 border-l-emerald-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Today's Collection</CardTitle>
            <div className="h-8 w-8 rounded-full bg-emerald-100 flex items-center justify-center">
               <DollarSign className="size-4 text-emerald-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-emerald-600">₹12,500</div>
            <p className="text-xs text-muted-foreground mt-1">Total payments received today</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Widget 2: Pending Members List */}
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
                    <TableHead>Amount</TableHead>
                    <TableHead className="text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingMembers.map((member, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{member.name}</TableCell>
                      <TableCell>{member.amount}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50">
                          {member.daysOverdue} days late
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Widget 3: Recent Payments */}
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
               <CheckCircle2 className="size-5 text-emerald-500" />
               Recent Payments
            </CardTitle>
            <CardDescription>Latest transactions recorded in the system.</CardDescription>
          </CardHeader>
          <CardContent>
             <div className="space-y-4">
               {recentPayments.map((payment, i) => (
                 <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                    <div className="flex flex-col">
                       <span className="font-medium text-sm">{payment.member}</span>
                       <span className="text-xs text-muted-foreground">{payment.date}</span>
                    </div>
                    <div className="flex flex-col items-end">
                       <span className="font-bold text-emerald-600 text-sm">{payment.amount}</span>
                       <span className="text-[10px] uppercase font-semibold text-muted-foreground">Completed</span>
                    </div>
                 </div>
               ))}
             </div>
          </CardContent>
        </Card>
      </div>

      {/* Widget 4: Monthly Collection Chart */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle>Monthly Collection Trends</CardTitle>
          <CardDescription>Overview of total funds collected per month.</CardDescription>
        </CardHeader>
        <CardContent>
           <ChartContainer config={barChartConfig} className="h-[300px] w-full">
              <BarChart data={monthlyCollectionData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `₹${value / 1000}k`} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
           </ChartContainer>
        </CardContent>
      </Card>
    </div>
  )
}
