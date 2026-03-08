
"use client"

import { useState } from "react"
import { Search, Filter, CreditCard, CheckCircle2, AlertCircle, Clock, MoreHorizontal } from "lucide-react"
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
import { useToast } from "@/hooks/use-toast"

const initialPayments = [
  { id: "1", memberName: "John Doe", month: "September 2023", amount: 5000, date: "2023-09-05", status: "paid" },
  { id: "2", memberName: "Sarah Smith", month: "September 2023", amount: 5000, date: "2023-09-07", status: "paid" },
  { id: "3", memberName: "Emma Watson", month: "September 2023", amount: 5000, date: "2023-09-12", status: "pending" },
  { id: "4", memberName: "Robert Wilson", month: "September 2023", amount: 5000, date: "2023-09-15", status: "paid" },
  { id: "5", memberName: "Michael Chen", month: "September 2023", amount: 5000, date: "-", status: "pending" },
  { id: "6", memberName: "John Doe", month: "August 2023", amount: 5000, date: "2023-08-04", status: "paid" },
]

export default function PaymentsPage() {
  const [payments, setPayments] = useState(initialPayments)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const { toast } = useToast()

  const markAsPaid = (id: string) => {
    setPayments(payments.map(p => 
      p.id === id ? { ...p, status: "paid", date: new Date().toISOString().split('T')[0] } : p
    ))
    toast({
      title: "Payment Recorded",
      description: "Member's monthly contribution has been marked as paid.",
    })
  }

  const filteredPayments = payments.filter(payment => {
    const matchesSearch = payment.memberName.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === "all" || payment.status === statusFilter
    return matchesSearch && matchesStatus
  })

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-headline font-bold tracking-tight">Payments</h2>
          <p className="text-muted-foreground">Track and record monthly member contributions.</p>
        </div>
        <div className="flex items-center gap-2">
           <Button variant="outline" className="hidden sm:flex">
             <Filter className="mr-2 size-4" />
             Filters
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

      <div className="flex flex-col sm:flex-row gap-4 bg-card p-4 rounded-xl shadow-sm border border-border/50">
        <div className="flex-1 flex items-center space-x-2">
          <Search className="size-5 text-muted-foreground" />
          <Input
            placeholder="Search by member name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="border-none focus-visible:ring-0 shadow-none bg-transparent"
          />
        </div>
        <div className="w-full sm:w-[200px]">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="bg-background">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
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
              <TableHead className="font-semibold">Payment Date</TableHead>
              <TableHead className="font-semibold">Status</TableHead>
              <TableHead className="w-[100px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredPayments.length > 0 ? (
              filteredPayments.map((payment) => (
                <TableRow key={payment.id} className="hover:bg-muted/10 transition-colors">
                  <TableCell className="font-medium">{payment.memberName}</TableCell>
                  <TableCell>{payment.month}</TableCell>
                  <TableCell className="font-semibold">₹{payment.amount.toLocaleString()}</TableCell>
                  <TableCell className="text-muted-foreground">
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
                    ) : (
                      <Badge variant="outline" className="border-amber-500 text-amber-600 bg-amber-50 gap-1.5">
                        <AlertCircle className="size-3.5" /> Pending
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {payment.status === 'pending' ? (
                      <Button 
                        size="sm" 
                        onClick={() => markAsPaid(payment.id)}
                        className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white"
                      >
                        Record
                      </Button>
                    ) : (
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="size-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                  No payment records found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
