"use client"

import { useState, useEffect } from "react"
import { Download, Printer, TrendingUp, DollarSign, FileText, User, Clock, Trophy, Loader2, Database, Calendar, BarChart3 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
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
import { useToast } from "@/hooks/use-toast"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, query, orderBy } from "firebase/firestore"
import { format, parseISO, isSameMonth, subMonths, isSameYear } from "date-fns"

const chartConfig = {
  amount: {
    label: "Collected Amount",
    color: "hsl(var(--primary))",
  },
} satisfies ChartConfig

const pieChartConfig = {
  value: {
    label: "Status Percentage",
  },
} satisfies ChartConfig

export default function ReportsPage() {
  const [mounted, setMounted] = useState(false)
  const { toast } = useToast()
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

  const handleExport = (type: 'CSV' | 'PDF', reportName: string) => {
    toast({
      title: "Export Started",
      description: `Your ${reportName} is being exported as ${type}.`,
    })
  }

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
        <p className="text-muted-foreground text-center">Data is required to generate financial reports.</p>
      </div>
    )
  }

  // --- Aggregations ---
  const now = new Date()
  const ytdPayments = (payments || []).filter(p => p.paymentDate && isSameYear(parseISO(p.paymentDate), now) && p.status === 'paid')
  const totalRevenue = ytdPayments.reduce((acc, p) => acc + (p.amountPaid || 0), 0)

  // Monthly Revenue Growth Chart
  const last6Months = Array.from({ length: 6 }).map((_, i) => subMonths(now, i)).reverse()
  const collectionData = last6Months.map(monthDate => {
    const amount = (payments || []).filter(p => p.paymentDate && isSameMonth(parseISO(p.paymentDate), monthDate) && p.status === 'paid')
      .reduce((acc, p) => acc + (p.amountPaid || 0), 0)
    return {
      month: format(monthDate, 'MMM'),
      amount
    }
  })

  // Pie Chart: Member Status Distribution
  const paidCount = (members || []).filter(m => m.paymentStatus === 'paid').length
  const pendingCount = (members || []).filter(m => m.paymentStatus === 'pending').length
  const totalM = members?.length || 1
  const statusData = [
    { name: "Paid", value: Math.round((paidCount / totalM) * 100), color: "hsl(var(--primary))" },
    { name: "Pending", value: Math.round((pendingCount / totalM) * 100), color: "hsl(var(--accent))" },
  ]

  // Pending Payments List
  const overduePayments = (payments || []).filter(p => p.status === 'pending')

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-headline font-bold tracking-tight">Financial Reports</h2>
          <p className="text-muted-foreground">Comprehensive overview of collections and dues from Firestore.</p>
        </div>
        <div className="flex items-center gap-2">
           <Button variant="outline" size="sm" className="hidden sm:flex" onClick={() => window.print()}>
             <Printer className="mr-2 size-4" />
             Print
           </Button>
           <Button size="sm" className="h-10" onClick={() => handleExport('PDF', 'Overview Report')}>
             <Download className="mr-2 size-4" />
             Export PDF
           </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="size-4 text-emerald-500" />
              Year-to-Date Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">₹{totalRevenue.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <TrendingUp className="size-3 text-emerald-500" /> Current year collections
            </p>
          </CardContent>
        </Card>
        
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Calendar className="size-4 text-primary" />
              Avg. Monthly Collection
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">₹{Math.round(totalRevenue / (now.getMonth() + 1)).toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">Based on YTD data</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <BarChart3 className="size-4 text-accent" />
              Collection Efficiency
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{Math.round((paidCount / (paidCount + pendingCount || 1)) * 100)}%</div>
            <p className="text-xs text-muted-foreground mt-1">Active month target: 95%</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
        <Card className="lg:col-span-4 border-border/50">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Monthly Revenue Growth</CardTitle>
              <CardDescription>Visualizing total collections per month.</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
             <ChartContainer config={chartConfig} className="h-[350px] w-full">
                <BarChart data={collectionData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis axisLine={false} tickLine={false} stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="amount" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} barSize={40} />
                </BarChart>
             </ChartContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3 border-border/50">
          <CardHeader>
            <CardTitle>Member Payment Status</CardTitle>
            <CardDescription>Current distribution of overall payments.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center">
             <ChartContainer config={pieChartConfig} className="h-[250px] w-full">
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <ChartTooltip content={<ChartTooltipContent />} />
                </PieChart>
             </ChartContainer>
             <div className="w-full space-y-3 mt-4">
                {statusData.map((item, i) => (
                   <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                         <div className="size-3 rounded-full" style={{ backgroundColor: item.color }} />
                         <span className="text-sm font-medium">{item.name}</span>
                      </div>
                      <span className="text-sm text-muted-foreground font-semibold">{item.value}%</span>
                   </div>
                ))}
             </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <h3 className="text-2xl font-bold font-headline">Detailed Insights</h3>

        <Tabs defaultValue="collections" className="w-full">
          <TabsList className="grid w-full grid-cols-2 lg:grid-cols-4 h-auto p-1 bg-muted/50 border">
            <TabsTrigger value="collections" className="py-2.5">
              <BarChart3 className="size-4 mr-2" />
              Collections
            </TabsTrigger>
            <TabsTrigger value="members" className="py-2.5">
              <User className="size-4 mr-2" />
              Members
            </TabsTrigger>
            <TabsTrigger value="pending" className="py-2.5">
              <Clock className="size-4 mr-2" />
              Pending
            </TabsTrigger>
            <TabsTrigger value="winners" className="py-2.5">
              <Trophy className="size-4 mr-2" />
              Winners
            </TabsTrigger>
          </TabsList>

          <TabsContent value="collections" className="mt-6">
            <Card className="border-border/50">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Monthly Collection Summary</CardTitle>
                  <CardDescription>Total funds received grouped by month.</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Month</TableHead>
                      <TableHead className="text-right">Total Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {collectionData.map((row, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{row.month}</TableCell>
                        <TableCell className="text-right font-bold text-emerald-600">₹{row.amount.toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="members" className="mt-6">
            <Card className="border-border/50">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Individual Member Performance</CardTitle>
                  <CardDescription>Cumulative contributions and outstanding dues per member.</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Member Name</TableHead>
                      <TableHead>Total Paid</TableHead>
                      <TableHead className="text-right">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {members?.map((row, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{row.name}</TableCell>
                        <TableCell className="text-emerald-600 font-semibold">₹{(row.totalPaid || 0).toLocaleString()}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant={row.paymentStatus === 'paid' ? 'default' : 'secondary'}>
                            {row.paymentStatus || 'pending'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="pending" className="mt-6">
            <Card className="border-border/50">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Overdue Contributions</CardTitle>
                  <CardDescription>Members who haven't fulfilled their dues.</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Member Name</TableHead>
                      <TableHead>Period</TableHead>
                      <TableHead className="text-right">Amount Due</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {overduePayments.length > 0 ? (
                      overduePayments.map((row, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium">{row.memberName}</TableCell>
                          <TableCell>{row.month}</TableCell>
                          <TableCell className="text-right text-rose-600 font-bold">₹{(row.amountPaid || 0).toLocaleString()}</TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={3} className="h-24 text-center text-muted-foreground italic">
                          No pending payments for this period.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="winners" className="mt-6">
            <Card className="border-border/50">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Chit Auction History</CardTitle>
                  <CardDescription>Historical list of round winners and distributions.</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Round #</TableHead>
                      <TableHead>Winner Name</TableHead>
                      <TableHead>Winning Amount</TableHead>
                      <TableHead className="text-right">Auction Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(rounds || []).filter(r => r.status === 'completed').map((row, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-bold text-primary">#{row.roundNumber}</TableCell>
                        <TableCell className="font-medium">{row.winnerName}</TableCell>
                        <TableCell className="text-emerald-600 font-bold">₹{row.winningAmount?.toLocaleString()}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{row.date ? format(parseISO(row.date), 'yyyy-MM-dd') : '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
