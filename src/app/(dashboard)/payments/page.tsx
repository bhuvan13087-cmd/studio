"use client"

import { useState } from "react"
import { Search, Filter, CreditCard, CheckCircle2, AlertCircle, Clock, MoreHorizontal, Download, History, Banknote, Smartphone, Building2, Calendar, User, Plus, Loader2 } from "lucide-react"
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
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { useFirestore, useCollection, useMemoFirebase, addDocumentNonBlocking, updateDocumentNonBlocking } from "@/firebase"
import { collection, query, where, doc, serverTimestamp } from "firebase/firestore"
import { useRole } from "@/hooks/use-role"

export default function PaymentsPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [monthFilter, setMonthFilter] = useState("all")
  const [historyMember, setHistoryMember] = useState<any>(null)
  const [isQuickRecordOpen, setIsQuickRecordOpen] = useState(false)
  const { toast } = useToast()
  const db = useFirestore()
  const { isAdmin, isLoading: isRoleLoading } = useRole()

  const paymentsQuery = useMemoFirebase(() => {
    if (!db || !isAdmin) return null;
    return query(collection(db, 'payments'));
  }, [db, isAdmin]);

  const { data: paymentsData, isLoading: isPaymentsLoading } = useCollection(paymentsQuery);
  const payments = paymentsData || [];

  const membersQuery = useMemoFirebase(() => {
    if (!db || !isAdmin) return null;
    return collection(db, 'members');
  }, [db, isAdmin]);

  const { data: membersData } = useCollection(membersQuery);
  const members = membersData || [];

  const [recordData, setRecordData] = useState({
    memberId: "",
    amount: 5000,
    month: new Date().toLocaleString('default', { month: 'long', year: 'numeric' }),
    method: "Cash"
  })

  const handleQuickRecord = (e: React.FormEvent) => {
    e.preventDefault();
    if (!db) return;

    const member = members.find(m => m.id === recordData.memberId);
    if (!member) return;

    const paymentId = Math.random().toString(36).substr(2, 9);
    addDocumentNonBlocking(collection(db, 'payments'), {
      id: paymentId,
      memberId: member.id,
      memberName: member.name,
      month: recordData.month,
      amountPaid: Number(recordData.amount),
      paymentDate: new Date().toISOString(),
      status: "paid",
      method: recordData.method,
      createdAt: serverTimestamp()
    });

    setIsQuickRecordOpen(false);
    toast({
      title: "Payment Recorded",
      description: `Payment for ${member.name} has been added.`,
    });
  }

  const markAsPaid = (payment: any) => {
    if (!db) return;
    const docRef = doc(db, 'payments', payment.id);
    updateDocumentNonBlocking(docRef, {
      status: "paid",
      paymentDate: new Date().toISOString(),
      method: "Cash"
    });
    toast({
      title: "Payment Updated",
      description: "Member's contribution has been marked as paid.",
    })
  }

  const filteredPayments = payments.filter(payment => {
    const matchesSearch = payment.memberName?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === "all" || payment.status === statusFilter
    const matchesMonth = monthFilter === "all" || payment.month?.includes(monthFilter)
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

  if (isRoleLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4 text-center">
        <AlertCircle className="size-12 text-amber-500" />
        <h2 className="text-xl font-bold">Administrative Access Required</h2>
        <p className="text-muted-foreground max-w-md">
          This page is restricted to administrators.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-headline font-bold tracking-tight">Payments</h2>
          <p className="text-muted-foreground">
            Track and record monthly member contributions.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Dialog open={isQuickRecordOpen} onOpenChange={setIsQuickRecordOpen}>
            <DialogTrigger asChild>
              <Button className="h-11">
                <Plus className="mr-2 size-5" />
                Quick Record
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <form onSubmit={handleQuickRecord}>
                <DialogHeader>
                  <DialogTitle>Quick Record Payment</DialogTitle>
                  <DialogDescription>Manually record a payment received from a member.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-6">
                  <div className="grid gap-2">
                    <Label htmlFor="member">Member</Label>
                    <Select value={recordData.memberId} onValueChange={(v) => setRecordData({...recordData, memberId: v})}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select member" />
                      </SelectTrigger>
                      <SelectContent>
                        {members.map(m => (
                          <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="amount">Amount (₹)</Label>
                    <Input id="amount" type="number" value={recordData.amount} onChange={e => setRecordData({...recordData, amount: Number(e.target.value)})} required />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="method">Method</Label>
                    <Select value={recordData.method} onValueChange={(v) => setRecordData({...recordData, method: v})}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select method" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Cash">Cash</SelectItem>
                        <SelectItem value="UPI">UPI</SelectItem>
                        <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsQuickRecordOpen(false)}>Cancel</Button>
                  <Button type="submit">Record Payment</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="bg-emerald-50 border-emerald-100 dark:bg-emerald-950/20 dark:border-emerald-900/50">
          <CardHeader className="pb-2">
            <CardDescription className="text-emerald-700 dark:text-emerald-400">Total Collected</CardDescription>
            <CardTitle className="text-2xl font-bold text-emerald-900 dark:text-emerald-300">
              ₹{payments.filter(p => p.status === 'paid').reduce((acc, p) => acc + (p.amountPaid || 0), 0).toLocaleString()}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="bg-amber-50 border-amber-100 dark:bg-amber-950/20 dark:border-amber-900/50">
          <CardHeader className="pb-2">
            <CardDescription className="text-amber-700 dark:text-amber-400">Pending Payments</CardDescription>
            <CardTitle className="text-2xl font-bold text-amber-900 dark:text-amber-300">
              {payments.filter(p => p.status === 'pending').length}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="bg-primary/5 border-primary/10">
          <CardHeader className="pb-2">
            <CardDescription className="text-primary/70">Participation Rate</CardDescription>
            <CardTitle className="text-2xl font-bold text-primary">
              {payments.length ? Math.round((payments.filter(p => p.status === 'paid').length / payments.length) * 100) : 0}%
            </CardTitle>
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
            {isPaymentsLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center text-muted-foreground animate-pulse">
                  Loading payments...
                </TableCell>
              </TableRow>
            ) : filteredPayments.length > 0 ? (
              filteredPayments.map((payment) => (
                <TableRow key={payment.id} className="hover:bg-muted/10 transition-colors">
                  <TableCell>
                    <button 
                      onClick={() => setHistoryMember(payment)}
                      className="font-medium hover:text-primary transition-colors flex items-center gap-2"
                    >
                      <User className="size-3.5 text-muted-foreground" />
                      {payment.memberName}
                    </button>
                  </TableCell>
                  <TableCell>{payment.month}</TableCell>
                  <TableCell className="font-semibold">₹{payment.amountPaid?.toLocaleString()}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 text-muted-foreground text-xs">
                      {getMethodIcon(payment.method)}
                      {payment.method || "-"}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {payment.status === 'pending' ? (
                      <span className="flex items-center gap-1.5 text-amber-600">
                        <Clock className="size-3.5" /> Awaiting
                      </span>
                    ) : payment.paymentDate ? new Date(payment.paymentDate).toLocaleDateString() : "-"}
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
                          <DropdownMenuItem onSelect={(e) => {
                            e.preventDefault()
                            markAsPaid(payment)
                          }}>
                            <CreditCard className="mr-2 size-4" /> Record Payment
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onSelect={(e) => {
                          e.preventDefault()
                          setHistoryMember(payment)
                        }}>
                          <History className="mr-2 size-4" /> Payment History
                        </DropdownMenuItem>
                        {payment.status === 'paid' && (
                          <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
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
      <Dialog open={!!historyMember} onOpenChange={(open) => {
        if (!open) setHistoryMember(null)
      }}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="size-5 text-primary" />
              Payment History: {historyMember?.memberName}
            </DialogTitle>
            <DialogDescription>
              A record of all contributions made by {historyMember?.memberName}.
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
                  {payments.filter(p => p.memberId === historyMember?.memberId).length > 0 ? (
                    payments
                      .filter(p => p.memberId === historyMember?.memberId)
                      .map((entry, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-sm font-medium">{entry.month}</TableCell>
                          <TableCell className="text-sm">₹{entry.amountPaid?.toLocaleString()}</TableCell>
                          <TableCell className="text-sm">
                             <div className="flex items-center gap-1.5">
                               {getMethodIcon(entry.method)}
                               {entry.method || "Cash"}
                             </div>
                          </TableCell>
                          <TableCell className="text-sm text-right text-muted-foreground">
                            {entry.paymentDate ? new Date(entry.paymentDate).toLocaleDateString() : "-"}
                          </TableCell>
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
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
