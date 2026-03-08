
"use client"

import { useState } from "react"
import { Search, CreditCard, CheckCircle2, AlertCircle, Clock, MoreHorizontal, Download, History, Banknote, Smartphone, Building2, User, Plus, Loader2 } from "lucide-react"
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
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, query, doc, serverTimestamp, orderBy, addDoc, updateDoc } from "firebase/firestore"
import { useRole } from "@/hooks/use-role"

export default function PaymentsPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [historyMember, setHistoryMember] = useState<any>(null)
  const [isQuickRecordOpen, setIsQuickRecordOpen] = useState(false)
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)
  const [isActionPending, setIsActionPending] = useState(false)
  const { toast } = useToast()
  const db = useFirestore()
  const { isAdmin, isLoading: isRoleLoading } = useRole()

  const paymentsQuery = useMemoFirebase(() => query(collection(db, 'payments'), orderBy('paymentDate', 'desc')), [db]);
  const { data: paymentsData, isLoading: isPaymentsLoading } = useCollection(paymentsQuery);
  const payments = paymentsData || [];

  const membersQuery = useMemoFirebase(() => collection(db, 'members'), [db]);
  const { data: membersData } = useCollection(membersQuery);
  const members = membersData || [];

  const [recordData, setRecordData] = useState({
    memberId: "",
    amount: 5000,
    month: new Date().toLocaleString('default', { month: 'long', year: 'numeric' }),
    method: "Cash"
  })

  const restoreInteraction = (open: boolean) => {
    if (!open) {
      setTimeout(() => {
        document.body.style.pointerEvents = 'auto'
      }, 100)
    }
  }

  const handleQuickRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || isActionPending) return;

    const member = members.find(m => m.id === recordData.memberId);
    if (!member) return;
    
    setIsActionPending(true)
    const amount = Number(recordData.amount);

    try {
      await addDoc(collection(db, 'payments'), {
        memberId: member.id,
        memberName: member.name,
        month: recordData.month,
        amountPaid: amount,
        paymentDate: new Date().toISOString(),
        status: "paid",
        method: recordData.method,
        createdAt: serverTimestamp()
      });

      await updateDoc(doc(db, 'members', member.id), {
        paymentStatus: "paid",
        totalPaid: (member.totalPaid || 0) + amount,
        pendingAmount: Math.max(0, (member.pendingAmount || 0) - amount)
      });

      setIsQuickRecordOpen(false);
      toast({
        title: "Payment Recorded",
        description: `Payment of ₹${amount} for ${member.name} saved successfully.`,
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to record payment.",
      });
    } finally {
      setIsActionPending(false)
    }
  }

  const successfulPayments = payments.filter(p => p.status === 'paid' && 
    (p.memberName?.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  if (isRoleLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-headline font-bold tracking-tight">Payments</h2>
          <p className="text-muted-foreground">Viewing only successful contribution records.</p>
        </div>
        <Dialog open={isQuickRecordOpen} onOpenChange={(open) => {
          setIsQuickRecordOpen(open)
          restoreInteraction(open)
        }}>
          <DialogTrigger asChild>
            <Button className="h-11 shadow-md">
              <Plus className="mr-2 size-5" />
              Quick Record
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <form onSubmit={handleQuickRecord}>
              <DialogHeader>
                <DialogTitle>Record Payment</DialogTitle>
                <DialogDescription>Manually record a successful payment received from a member.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-6">
                <div className="grid gap-2">
                  <Label htmlFor="member">Member</Label>
                  <Select disabled={isActionPending} value={recordData.memberId} onValueChange={(v) => setRecordData({...recordData, memberId: v})}>
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
                  <Input disabled={isActionPending} id="amount" type="number" value={recordData.amount} onChange={e => setRecordData({...recordData, amount: Number(e.target.value)})} required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="method">Method</Label>
                  <Select disabled={isActionPending} value={recordData.method} onValueChange={(v) => setRecordData({...recordData, method: v})}>
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
                <Button type="button" variant="outline" onClick={() => setIsQuickRecordOpen(false)} disabled={isActionPending}>Cancel</Button>
                <Button type="submit" disabled={isActionPending}>
                  {isActionPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                  Save Payment
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center space-x-2 bg-card p-4 rounded-xl shadow-sm border border-border/50">
        <Search className="size-5 text-muted-foreground" />
        <Input
          placeholder="Search by member name..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="border-none focus-visible:ring-0 shadow-none bg-transparent"
        />
      </div>

      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead className="font-semibold">Member</TableHead>
              <TableHead className="font-semibold">Period</TableHead>
              <TableHead className="font-semibold">Amount Paid</TableHead>
              <TableHead className="font-semibold">Method</TableHead>
              <TableHead className="font-semibold">Last Paid Date</TableHead>
              <TableHead className="font-semibold">Status</TableHead>
              <TableHead className="w-[100px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isPaymentsLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center text-muted-foreground animate-pulse">
                  Loading records...
                </TableCell>
              </TableRow>
            ) : successfulPayments.length > 0 ? (
              successfulPayments.map((payment) => (
                <TableRow key={payment.id} className="hover:bg-muted/10 transition-colors">
                  <TableCell className="font-medium">{payment.memberName}</TableCell>
                  <TableCell>{payment.month}</TableCell>
                  <TableCell className="font-bold text-emerald-600">₹{payment.amountPaid?.toLocaleString()}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">{payment.method || "Cash"}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {payment.paymentDate ? new Date(payment.paymentDate).toLocaleDateString() : "-"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="border-emerald-500 text-emerald-600 bg-emerald-50 gap-1.5">
                      <CheckCircle2 className="size-3.5" /> Success
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={(e) => {
                          e.preventDefault()
                          setHistoryMember(payment)
                          setIsHistoryOpen(true)
                        }}>
                          <History className="mr-2 size-4" /> History
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                          <Download className="mr-2 size-4" /> Receipt
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                  No successful payments found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isHistoryOpen} onOpenChange={(open) => {
        setIsHistoryOpen(open)
        restoreInteraction(open)
        if (!open) setHistoryMember(null)
      }}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle>Payment History: {historyMember?.memberName}</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Month</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead className="text-right">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.filter(p => p.memberId === historyMember?.memberId && p.status === 'paid').map((entry, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-sm font-medium">{entry.month}</TableCell>
                    <TableCell className="text-sm">₹{entry.amountPaid?.toLocaleString()}</TableCell>
                    <TableCell className="text-sm text-right text-muted-foreground">
                      {entry.paymentDate ? new Date(entry.paymentDate).toLocaleDateString() : "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
