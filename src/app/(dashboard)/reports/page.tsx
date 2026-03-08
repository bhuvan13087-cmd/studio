"use client"

import { useState, useEffect } from "react"
import { Download, Printer, Filter, Calendar, BarChart3, TrendingUp, DollarSign, FileText, User, Clock, Trophy, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
  ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
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

const collectionData = [
  { month: "Jan", amount: 45000 },
  { month: "Feb", amount: 52000 },
  { month: "Mar", amount: 48000 },
  { month: "Apr", amount: 61000 },
  { month: "May", amount: 55000 },
  { month: "Jun", amount: 67000 },
]

const statusData = [
  { name: "Paid", value: 85, color: "hsl(var(--primary))" },
  { name: "Pending", value: 10, color: "hsl(var(--accent))" },
  { name: "Defaulter", value: 5, color: "hsl(var(--destructive))" },
]

const memberPayments = [
  { name: "John Doe", totalPaid: 45000, pending: 0, lastPayment: "2023-09-05" },
  { name: "Sarah Smith", totalPaid: 40000, pending: 0, lastPayment: "2023-09-07" },
  { name: "Emma Watson", totalPaid: 25000, pending: 5000, lastPayment: "2023-08-20" },
  { name: "Michael Chen", totalPaid: 30000, pending: 5000, lastPayment: "2023-08-15" },
  { name: "Robert Wilson", totalPaid: 20000, pending: 0, lastPayment: "2023-09-15" },
]

const pendingPayments = [
  { name: "Emma Watson", month: "September 2023", amount: 5000, daysOverdue: 12 },
  { name: "Michael Chen", month: "September 2023", amount: 5000, daysOverdue: 15 },
  { name: "Lisa Wong", month: "September 2023", amount: 5000, daysOverdue: 3 },
]

const chitWinners = [
  { round: 12, name: "John Doe", amount: 45000, date: "2023-09-15" },
  { round: 11, name: "Sarah Smith", amount: 45000, date: "2023-08-15" },
  { round: 10, name: "Michael Chen", amount: 45000, date: "2023-07-15" },
  { round: 9, name: "Emma Watson", amount: 45000, date: "2023-06-15" },
]

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

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleExport = (type: 'CSV' | 'PDF', reportName: string) => {
    toast({
      title: "Export Started",
      description: `Your ${reportName} is being exported as ${type}.`,
    })
  }

  if (!mounted) return null

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-headline font-bold tracking-tight">Financial Reports</h2>
          <p className="text-muted-foreground">Comprehensive overview of collections and dues.</p>
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
            <div className="text-3xl font-bold">₹3,28,000</div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <TrendingUp className="size-3 text-emerald-500" /> +15.2% from last year
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
            <div className="text-3xl font-bold">₹54,667</div>
            <p className="text-xs text-muted-foreground mt-1">Based on last 6 months</p>
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
            <div className="text-3xl font-bold">92.4%</div>
            <p className="text-xs text-muted-foreground mt-1">Target: 95%</p>
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
            <div className="flex items-center gap-2">
              <Select defaultValue="2023">
                <SelectTrigger className="w-[100px] h-8 text-xs">
                  <SelectValue placeholder="Year" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2023">2023</SelectItem>
                  <SelectItem value="2022">2022</SelectItem>
                </SelectContent>
              </Select>
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
             <div className="h-[250px] w-full">
                <ChartContainer config={pieChartConfig} className="h-full w-full">
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
             </div>
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
        <div className="flex items-center justify-between">
          <h3 className="text-2xl font-bold font-headline">Detailed Insights</h3>
        </div>

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
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleExport('CSV', 'Monthly Collection Report')}>
                    <Download className="size-4 mr-2" /> CSV
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Month</TableHead>
                      <TableHead>Year</TableHead>
                      <TableHead className="text-right">Total Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {collectionData.map((row, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{row.month}</TableCell>
                        <TableCell>2023</TableCell>
                        <TableCell className="text-right font-bold text-emerald-600">₹{row.amount.toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/50 font-bold">
                      <TableCell colSpan={2}>Total YTD</TableCell>
                      <TableCell className="text-right text-emerald-700">₹3,28,000</TableCell>
                    </TableRow>
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
                <Button variant="outline" size="sm" onClick={() => handleExport('CSV', 'Member Payment Report')}>
                  <Download className="size-4 mr-2" /> CSV
                </Button>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Member Name</TableHead>
                      <TableHead>Total Paid</TableHead>
                      <TableHead>Pending Amount</TableHead>
                      <TableHead className="text-right">Last Payment</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {memberPayments.map((row, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{row.name}</TableCell>
                        <TableCell className="text-emerald-600 font-semibold">₹{row.totalPaid.toLocaleString()}</TableCell>
                        <TableCell className={row.pending > 0 ? "text-rose-500 font-semibold" : "text-muted-foreground"}>
                          ₹{row.pending.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">{row.lastPayment}</TableCell>
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
                  <CardDescription>Members who haven't fulfilled their dues for the current cycle.</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => handleExport('PDF', 'Pending Payments Report')}>
                  <FileText className="size-4 mr-2" /> PDF
                </Button>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Member Name</TableHead>
                      <TableHead>Period</TableHead>
                      <TableHead>Amount Due</TableHead>
                      <TableHead className="text-right">Days Overdue</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingPayments.length > 0 ? (
                      pendingPayments.map((row, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium">{row.name}</TableCell>
                          <TableCell>{row.month}</TableCell>
                          <TableCell className="text-rose-600 font-bold">₹{row.amount.toLocaleString()}</TableCell>
                          <TableCell className="text-right">
                             <span className="px-2 py-1 rounded bg-rose-50 text-rose-700 text-xs font-bold border border-rose-100">
                               {row.daysOverdue} days
                             </span>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
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
                <Button variant="outline" size="sm" onClick={() => handleExport('CSV', 'Chit Winner Report')}>
                  <Download className="size-4 mr-2" /> CSV
                </Button>
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
                    {chitWinners.map((row, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-bold text-primary">#{row.round}</TableCell>
                        <TableCell className="font-medium">{row.name}</TableCell>
                        <TableCell className="text-emerald-600 font-bold">₹{row.amount.toLocaleString()}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{row.date}</TableCell>
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
