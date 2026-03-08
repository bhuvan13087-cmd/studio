"use client"

import { useState } from "react"
import { Search, Filter, CreditCard, CheckCircle2, AlertCircle, Clock, MoreHorizontal, Download, History, Banknote, Smartphone, Building2, Calendar, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

const initialPayments = [
  { id: "1", memberName: "John Doe", month: "September 2023", amount: 5000, date: "2023-09-05", status: "paid", method: "UPI" },
  { id: "2", memberName: "Sarah Smith", month: "September 2023", amount: 5000, date: "2023-09-07", status: "paid", method: "Cash" },
  { id: "3", memberName: "Emma Watson", month: "September 2023", amount: 5000, date: "2023-09-12", status: "pending", method: "-" },
  { id: "4", memberName: "Robert Wilson", month: "September 2023", amount: 5000, date: "2023-09-15", status: "paid", method: "Bank Transfer" },
  { id: "5", memberName: "Michael Chen", month: "September 2023", amount: 5000, date: "-", status: "late", method: "-" },
  { id: "6", memberName: "John Doe", month: "August 2023", amount: 5000, date: "2023-08-04", status: "paid", method: "UPI" },
]

// Mock data for payment history
const paymentHistory = {
  "John Doe": [
    { month: "September 2023", amount: 5000, date: "2023-09-05", status: "paid", method: "UPI" },
    { month: "August 2023", amount: 5000, date: "2023-08-04", status: "paid", method: "UPI" },
    { month: "July 2023", amount: 5000, date: "2023-07-06", status: "paid", method: "Cash" },
  ],
  "Sarah Smith": [
    { month: "September 2023", amount: 5000, date: "2023-09-07", status: "paid", method: "Cash" },
    { month: "August 2023", amount: 5000, date: "2023-08-08", status: "paid", method: "Cash" },
  ],
}

export default function PaymentsPage() {
  const [payments, setPayments] = useState(initialPayments)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [monthFilter, setMonthFilter] = useState("all")
  const [historyMember, setHistoryMember] = useState<string | null>(null)
  const { toast } = useToast()

  const markAsPaid = (id: string) => {
    setPayments(payments.map(p => 
      p.id === id ? { ...p, status: "paid", date: new Date().toISOString().split('T')[0], method: "Cash" } : p
    ))
    toast({
      title: "Payment Recorded",
      description: "Member's monthly contribution has been marked as paid.",
    })
  }

  const downloadReceipt = (payment: any) => {
    toast({
      title: "Receipt Downloaded",
      description: `Receipt for ${payment.memberName} (${payment.month}) has been generated.`,
    })
  }

  const filteredPayments = payments.filter(payment => {
    const matchesSearch = payment.memberName.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === "all" || payment.status === statusFilter
    const matchesMonth = monthFilter === "all" || payment.month.includes(monthFilter)
    return matchesSearch && matchesStatus && matchesMonth
  })

  const getMethodIcon = (method: string) => {
    switch (method) {
      case 'Cash': return <Banknote className="size-3.5" />;
      case 'UPI': return <Smartphone className="size-3.5" />;
      case 'Bank Transfer': return <Building2 className="size-3.5" />;
      default: return null;
    }
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-headline font-bold tracking-tight">Payments</h2>
          <p className="text-muted-foreground">Track and record monthly member contributions.</p>
        </div>
        <div className="flex items-center gap-2">
           <Button variant="outline" className="hidden sm:flex">
             <Filter className="mr-2 size-4" />
             More Filters
           </Button>
           <Button className="h-11">
             <CreditCard className="mr-2 size-5" />
             Quick Record
           </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="bg-emerald-50 border-emerald-100 dark:bg-emerald-950/20 dark:border-emerald-900/50">
          <CardHeader className="pb-2">
            <CardDescription className="text-emerald-700 dark:text-emerald-400">Total Collected (Sep)</CardDescription>
            <CardTitle className="text-2xl font-bold text-emerald-900 dark:text-emerald-300">₹15,000</CardTitle>
          </CardHeader>
        </Card>
        <Card className="bg-amber-50 border-amber-100 dark:bg-amber-950/20 dark:border-amber-900/50">
          <CardHeader className="pb-2">
            <CardDescription className="text-amber-700 dark:text-amber-400">Pending Dues (Sep)</CardDescription>
            <CardTitle className="text-2xl font-bold text-amber-900 dark:text-amber-300">₹10,000</CardTitle>
          </CardHeader>
        </Card>
        <Card className="bg-primary/5 border-primary/10">
          <CardHeader className="pb-2">
            <CardDescription className="text-primary/70">Participation Rate</CardDescription>
            <CardTitle className="text-2xl font-bold text-primary">60%</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="flex flex-col lg:flex-row gap-4 bg-card p-4 rounded-xl shadow-sm border border-border/50">
        <div className="flex-1 flex items-center space-x-2">
          <Search className="size-5 text-muted-foreground" />
          <Input
            placeholder="Search by member name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="border-none focus-visible:ring-0 shadow-none bg-transparent"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={monthFilter} onValueChange={setMonthFilter}>
            <SelectTrigger className="w-[160px] bg-background">
              <SelectValue placeholder="Month" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Months</SelectItem>
              <SelectItem value="September">September</SelectItem>
              <SelectItem value="August">August</SelectItem>
              <SelectItem value="July">July</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px] bg-background">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="late">Late</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead className="font-semibold">Member</TableHead>
              <TableHead className="font-semibold">Period</TableHead>
              <TableHead className="font-semibold">Amount</TableHead>
              <TableHead className="font-semibold">Method</TableHead>
              <TableHead className="font-semibold">Payment Date</TableHead>
              <TableHead className="font-semibold">Status</TableHead>
              <TableHead className="w-[100px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredPayments.length > 0 ? (
              filteredPayments.map((payment) => (
                <TableRow key={payment.id} className="hover:bg-muted/10 transition-colors">
                  <TableCell>
                    <button 
                      onClick={() => setHistoryMember(payment.memberName)}
                      className="font-medium hover:text-primary transition-colors flex items-center gap-2"
                    >
                      <User className="size-3.5 text-muted-foreground" />
                      {payment.memberName}
                    </button>
                  </TableCell>
                  <TableCell>{payment.month}</TableCell>
                  <TableCell className="font-semibold">₹{payment.amount.toLocaleString()}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 text-muted-foreground text-xs">
                      {getMethodIcon(payment.method)}
                      {payment.method}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {payment.date === '-' ? (
                      <span className="flex items-center gap-1.5 text-amber-600">
                        <Clock className="size-3.5" /> Awaiting
                      </span>
                    ) : payment.date}
                  </TableCell>
                  <TableCell>
                    {payment.status === 'paid' ? (
                      <Badge variant="outline" className="border-emerald-500 text-emerald-600 bg-emerald-50 gap-1.5">
                        <CheckCircle2 className="size-3.5" /> Paid
                      </Badge>
                    ) : payment.status === 'late' ? (
                      <Badge variant="outline" className="border-rose-500 text-rose-600 bg-rose-50 gap-1.5">
                        <AlertCircle className="size-3.5" /> Late
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="border-amber-500 text-amber-600 bg-amber-50 gap-1.5">
                        <AlertCircle className="size-3.5" /> Pending
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {payment.status !== 'paid' && (
                          <DropdownMenuItem onClick={() => markAsPaid(payment.id)}>
                            <CreditCard className="mr-2 size-4" /> Record Payment
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => setHistoryMember(payment.memberName)}>
                          <History className="mr-2 size-4" /> Payment History
                        </DropdownMenuItem>
                        {payment.status === 'paid' && (
                          <DropdownMenuItem onClick={() => downloadReceipt(payment)}>
                            <Download className="mr-2 size-4" /> Download Receipt
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                  No payment records found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Payment History Dialog */}
      <Dialog open={!!historyMember} onOpenChange={(open) => !open && setHistoryMember(null)}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="size-5 text-primary" />
              Payment History: {historyMember}
            </DialogTitle>
            <DialogDescription>
              A record of all contributions made by {historyMember}.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className="text-xs">Month</TableHead>
                    <TableHead className="text-xs">Amount</TableHead>
                    <TableHead className="text-xs">Method</TableHead>
                    <TableHead className="text-xs text-right">Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historyMember && (paymentHistory[historyMember as keyof typeof paymentHistory] || []).length > 0 ? (
                    (paymentHistory[historyMember as keyof typeof paymentHistory] || []).map((entry, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-sm font-medium">{entry.month}</TableCell>
                        <TableCell className="text-sm">₹{entry.amount.toLocaleString()}</TableCell>
                        <TableCell className="text-sm">
                           <div className="flex items-center gap-1.5">
                             {getMethodIcon(entry.method)}
                             {entry.method}
                           </div>
                        </TableCell>
                        <TableCell className="text-sm text-right text-muted-foreground">{entry.date}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} className="h-20 text-center text-muted-foreground italic">
                        No historical records found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-4">
             <Button variant="outline" size="sm" onClick={() => setHistoryMember(null)}>Close</Button>
             <Button size="sm">
                <Download className="mr-2 size-4" />
                Export History
             </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
