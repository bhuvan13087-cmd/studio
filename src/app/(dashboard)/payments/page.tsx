
"use client"

import { useState, useMemo } from "react"
import { Search, CreditCard, CheckCircle2, AlertCircle, Clock, MoreHorizontal, Download, History, Banknote, Smartphone, Building2, User, Plus, Loader2, Calendar, Trash2, Check, ChevronsUpDown, FileText, LayoutList } from "lucide-react"
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, query, doc, serverTimestamp, orderBy, deleteDoc, updateDoc } from "firebase/firestore"
import { addDocumentNonBlocking, updateDocumentNonBlocking } from "@/firebase/non-blocking-updates"
import { useRole } from "@/hooks/use-role"
import { format, parseISO, startOfMonth, endOfMonth, isSameMonth } from "date-fns"
import { cn } from "@/lib/utils"

export default function PaymentsPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [typeFilter, setTypeFilter] = useState("all")
  const [historyMember, setHistoryMember] = useState<any>(null)
  const [isQuickRecordOpen, setIsQuickRecordOpen] = useState(false)
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)
  const [isDeletePaymentDialogOpen, setIsDeletePaymentDialogOpen] = useState(false)
  const [paymentToDelete, setPaymentToDelete] = useState<any>(null)
  const [isActionPending, setIsActionPending] = useState(false)
  
  // Searchable Member Selection State
  const [memberSearch, setMemberSearch] = useState("")
  const [isMemberPopoverOpen, setIsMemberPopoverOpen] = useState(false)

  const { toast } = useToast()
  const db = useFirestore()
  const { isAdmin, isLoading: isRoleLoading } = useRole()

  const paymentsQuery = useMemoFirebase(() => query(collection(db, 'payments'), orderBy('paymentDate', 'desc')), [db]);
  const { data: paymentsData, isLoading: isPaymentsLoading } = useCollection(paymentsQuery);
  const payments = paymentsData || [];

  const membersQuery = useMemoFirebase(() => collection(db, 'members'), [db]);
  const { data: membersData, isLoading: isMembersLoading } = useCollection(membersQuery);
  const members = membersData || [];

  const roundsQuery = useMemoFirebase(() => query(collection(db, 'chitRounds'), [db]));
  const { data: roundsData } = useCollection(roundsQuery);
  const rounds = roundsData || [];

  const [recordData, setRecordData] = useState({
    memberId: "",
    amount: 5000,
    month: new Date().toLocaleString('default', { month: 'long', year: 'numeric' }),
    method: "Cash"
  })

  // Filter members for the searchable selection
  const filteredMembersForSelection = useMemo(() => {
    if (!memberSearch) return members;
    return members.filter(m => m.name.toLowerCase().includes(memberSearch.toLowerCase()));
  }, [members, memberSearch]);

  const selectedMemberName = members.find(m => m.id === recordData.memberId)?.name || "Select member...";

  /**
   * Permanent Fix for UI Freeze Bug
   */
  const restoreInteraction = (open: boolean) => {
    if (!open) {
      setTimeout(() => {
        document.body.style.pointerEvents = 'auto'
        document.body.style.overflow = 'auto'
        const html = document.documentElement;
        if (html) {
          html.style.pointerEvents = 'auto'
          html.style.overflow = 'auto'
        }
        document.querySelectorAll('.modal-backdrop, .overlay, .dropdown-backdrop, [data-radix-portal]').forEach(el => {
          if (el.getAttribute('data-radix-portal') !== null && el.innerHTML === '') {
             el.remove();
          } else if (!el.getAttribute('data-radix-portal')) {
             el.remove();
          }
        });
      }, 300)
    }
  }

  const handleQuickRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || isActionPending || !recordData.memberId) return;

    const member = members.find(m => m.id === recordData.memberId);
    if (!member) return;
    
    setIsActionPending(true)
    const amount = Number(recordData.amount);

    try {
      addDocumentNonBlocking(collection(db, 'payments'), {
        memberId: member.id,
        memberName: member.name,
        month: recordData.month,
        amountPaid: amount,
        paymentDate: new Date().toISOString(),
        status: "paid",
        method: recordData.method,
        createdAt: serverTimestamp()
      });

      updateDocumentNonBlocking(doc(db, 'members', member.id), {
        paymentStatus: "success",
        totalPaid: (member.totalPaid || 0) + amount,
        pendingAmount: Math.max(0, (member.pendingAmount || 0) - amount)
      });

      setIsQuickRecordOpen(false);
      restoreInteraction(false);
      setRecordData({
        memberId: "",
        amount: 5000,
        month: new Date().toLocaleString('default', { month: 'long', year: 'numeric' }),
        method: "Cash"
      });
      setMemberSearch("");
      
      toast({
        title: "Payment Recorded",
        description: `Payment of ₹${amount} for ${member.name} saved successfully.`,
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to initiate payment recording.",
      });
    } finally {
      setIsActionPending(false)
    }
  }

  const handleDeletePayment = async () => {
    if (!db || !paymentToDelete || isActionPending) return;

    setIsActionPending(true)
    try {
      const paymentRef = doc(db, 'payments', paymentToDelete.id);
      
      const member = members.find(m => m.id === paymentToDelete.memberId);
      if (member) {
        await updateDoc(doc(db, 'members', member.id), {
          totalPaid: Math.max(0, (member.totalPaid || 0) - (paymentToDelete.amountPaid || 0)),
        });
      }

      await deleteDoc(paymentRef);

      setIsDeletePaymentDialogOpen(false);
      setPaymentToDelete(null);
      restoreInteraction(false);
      
      toast({
        title: "Record Deleted",
        description: `The payment record for ₹${paymentToDelete.amountPaid} has been removed.`,
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to delete payment record.",
      });
    } finally {
      setIsActionPending(false)
    }
  }

  const filteredPayments = useMemo(() => {
    const activeMemberIds = new Set(members.map(m => m.id));
    let list = payments.filter(p => (p.status === 'paid' || p.status === 'success') && activeMemberIds.has(p.memberId));
    
    if (searchTerm) {
      list = list.filter(p => p.memberName?.toLowerCase().includes(searchTerm.toLowerCase()));
    }

    if (typeFilter !== "all") {
      list = list.filter(p => {
        const member = members.find(m => m.id === p.memberId);
        const round = rounds.find(r => r.name === member?.chitGroup);
        const colType = (round?.collectionType || "Monthly").toLowerCase();
        return colType === typeFilter;
      });
    }

    return list;
  }, [payments, searchTerm, typeFilter, members, rounds]);

  // --- Summary View Logic ---
  const memberSummaries = useMemo(() => {
    const now = new Date();
    const start = startOfMonth(now);
    const end = endOfMonth(now);

    return members
      .filter(m => {
        const matchesSearch = m.name.toLowerCase().includes(searchTerm.toLowerCase());
        if (!matchesSearch) return false;
        
        if (typeFilter !== "all") {
          const round = rounds.find(r => r.name === m.chitGroup);
          const colType = (round?.collectionType || "Monthly").toLowerCase();
          return colType === typeFilter;
        }
        return true;
      })
      .map(member => {
        const monthlyPayments = payments.filter(p => 
          p.memberId === member.id && 
          (p.status === 'paid' || p.status === 'success') &&
          parseISO(p.paymentDate) >= start &&
          parseISO(p.paymentDate) <= end
        );

        const totalPaidThisMonth = monthlyPayments.reduce((acc, p) => acc + (p.amountPaid || 0), 0);
        const monthlyTarget = member.monthlyAmount || 0;
        const pendingAmount = Math.max(0, monthlyTarget - totalPaidThisMonth);
        const isFullyPaid = totalPaidThisMonth >= monthlyTarget;

        return {
          id: member.id,
          name: member.name,
          chitName: member.chitGroup || "N/A",
          totalAmount: monthlyTarget,
          amountPaid: totalPaidThisMonth,
          pendingAmount: pendingAmount,
          status: isFullyPaid ? "Paid" : "Pending"
        };
      });
  }, [members, payments, rounds, searchTerm, typeFilter]);

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
          <h2 className="text-3xl font-headline font-bold tracking-tight text-primary">Payments</h2>
          <p className="text-muted-foreground">Manage transactions and track member payment status.</p>
        </div>
        <Dialog open={isQuickRecordOpen} onOpenChange={(open) => {
          setIsQuickRecordOpen(open)
          restoreInteraction(open)
          if (!open) {
            setMemberSearch("")
          }
        }}>
          <DialogTrigger asChild>
            <Button className="h-11 shadow-lg hover:shadow-xl transition-all">
              <Plus className="mr-2 size-5" />
              Quick Record
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px] max-h-[90vh] overflow-y-auto focus:outline-none">
            {isQuickRecordOpen && (
              <form onSubmit={handleQuickRecord}>
                <DialogHeader>
                  <DialogTitle>Record Payment</DialogTitle>
                  <DialogDescription>Manually record a successful payment received from a member.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-6">
                  <div className="grid gap-2">
                    <Label>Member</Label>
                    <Popover open={isMemberPopoverOpen} onOpenChange={setIsMemberPopoverOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={isMemberPopoverOpen}
                          className="w-full justify-between bg-muted/30 font-normal border-border/50 h-10 px-3"
                          disabled={isActionPending}
                        >
                          {selectedMemberName}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-full p-0" align="start">
                        <div className="flex flex-col">
                          <div className="flex items-center border-b px-3">
                            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                            <Input
                              placeholder="Search member..."
                              className="flex h-10 w-full border-none bg-transparent py-3 text-sm outline-none focus-visible:ring-0 shadow-none"
                              value={memberSearch}
                              onChange={(e) => setMemberSearch(e.target.value)}
                            />
                          </div>
                          <ScrollArea className="h-[200px]">
                            <div className="p-1">
                              {filteredMembersForSelection.length > 0 ? (
                                filteredMembersForSelection.map((m) => (
                                  <Button
                                    key={m.id}
                                    type="button"
                                    variant="ghost"
                                    className="w-full justify-start font-normal h-9 px-2 text-sm"
                                    onClick={() => {
                                      setRecordData({ ...recordData, memberId: m.id });
                                      setIsMemberPopoverOpen(false);
                                      setMemberSearch("");
                                    }}
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        recordData.memberId === m.id ? "opacity-100" : "opacity-0"
                                      )}
                                    />
                                    {m.name}
                                  </Button>
                                ))
                              ) : (
                                <div className="p-4 text-center text-sm text-muted-foreground">No member found.</div>
                              )}
                            </div>
                          </ScrollArea>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="amount">Amount (₹)</Label>
                    <Input disabled={isActionPending} id="amount" type="number" value={recordData.amount} onChange={e => setRecordData({...recordData, amount: Number(e.target.value)})} required />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="method">Method</Label>
                    <Select disabled={isActionPending} value={recordData.method} onValueChange={(v) => setRecordData({...recordData, method: v})}>
                      <SelectTrigger className="bg-muted/30">
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
                <DialogFooter className="sticky bottom-0 bg-background pt-2 border-t">
                  <Button type="button" variant="outline" onClick={() => { setIsQuickRecordOpen(false); restoreInteraction(false); }} disabled={isActionPending}>Cancel</Button>
                  <Button type="submit" disabled={isActionPending || !recordData.memberId}>
                    {isActionPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                    Save Payment
                  </Button>
                </DialogFooter>
              </form>
            )}
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-col md:flex-row items-center gap-4 bg-card p-4 rounded-xl shadow-sm border border-border/50">
        <div className="flex items-center flex-1 w-full gap-2">
          <Search className="size-5 text-muted-foreground" />
          <Input
            placeholder="Search by member name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="border-none focus-visible:ring-0 shadow-none bg-transparent"
          />
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto border-t md:border-t-0 md:border-l pt-4 md:pt-0 md:pl-4">
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-full md:w-[100px] h-8 bg-muted/30 border-none shadow-none focus:ring-0 text-xs font-semibold px-2">
              <SelectValue placeholder="Schemes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs defaultValue="history" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-[400px] h-10 p-1 bg-muted/50 border mb-6">
          <TabsTrigger value="history" className="text-xs font-bold uppercase tracking-wider flex items-center gap-2">
            <LayoutList className="size-3.5" />
            History
          </TabsTrigger>
          <TabsTrigger value="summary" className="text-xs font-bold uppercase tracking-wider flex items-center gap-2">
            <FileText className="size-3.5" />
            Status Summary
          </TabsTrigger>
        </TabsList>

        <TabsContent value="history" className="mt-0 space-y-4">
          <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="font-bold">Payment Date</TableHead>
                  <TableHead className="font-bold">Member Name</TableHead>
                  <TableHead className="font-bold">Chit Name</TableHead>
                  <TableHead className="font-bold">Amount</TableHead>
                  <TableHead className="font-bold">Collection Type</TableHead>
                  <TableHead className="font-bold">Method</TableHead>
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isPaymentsLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-32 text-center text-muted-foreground animate-pulse">
                      Loading transaction history...
                    </TableCell>
                  </TableRow>
                ) : filteredPayments.length > 0 ? (
                  filteredPayments.map((payment) => {
                    const member = members.find(m => m.id === payment.memberId);
                    const round = rounds.find(r => r.name === member?.chitGroup);
                    const colType = round?.collectionType || "Monthly";

                    return (
                      <TableRow key={payment.id} className="hover:bg-muted/10 transition-colors">
                        <TableCell className="text-muted-foreground text-sm font-medium">
                          <div className="flex items-center gap-2">
                            <Calendar className="size-3.5 text-primary" />
                            {payment.paymentDate ? format(parseISO(payment.paymentDate), 'MMM dd, yyyy') : "-"}
                          </div>
                        </TableCell>
                        <TableCell className="font-semibold text-foreground">{payment.memberName}</TableCell>
                        <TableCell className="text-sm font-medium text-primary">{member?.chitGroup || "N/A"}</TableCell>
                        <TableCell className="font-bold text-emerald-600">₹{payment.amountPaid?.toLocaleString()}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5">
                            {colType}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs font-bold text-muted-foreground uppercase tracking-tight">
                          {payment.method || "Cash"}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-primary/10">
                                <MoreHorizontal className="size-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48 shadow-xl border-border/50">
                              <DropdownMenuItem onSelect={(e) => {
                                e.preventDefault()
                                setHistoryMember(payment)
                                setIsHistoryOpen(true)
                              }}>
                                <History className="mr-2 size-4" /> Full Member History
                              </DropdownMenuItem>
                              <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                <Download className="mr-2 size-4" /> Download Receipt
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                className="text-destructive focus:bg-destructive/10 focus:text-destructive" 
                                onSelect={(e) => {
                                  e.preventDefault()
                                  setPaymentToDelete(payment)
                                  setIsDeletePaymentDialogOpen(true)
                                }}
                              >
                                <Trash2 className="mr-2 size-4" /> Delete Record
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    )
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="h-32 text-center text-muted-foreground italic">
                      No payment records found matching the criteria.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="summary" className="mt-0">
          <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="font-bold">Member Name</TableHead>
                  <TableHead className="font-bold">Chit Name</TableHead>
                  <TableHead className="font-bold text-right">Total Amount</TableHead>
                  <TableHead className="font-bold text-right">Amount Paid</TableHead>
                  <TableHead className="font-bold text-right">Pending Amount</TableHead>
                  <TableHead className="font-bold text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isMembersLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center text-muted-foreground animate-pulse">
                      Generating status summary...
                    </TableCell>
                  </TableRow>
                ) : memberSummaries.length > 0 ? (
                  memberSummaries.map((summary) => (
                    <TableRow key={summary.id} className="hover:bg-muted/10 transition-colors">
                      <TableCell className="font-semibold">{summary.name}</TableCell>
                      <TableCell className="text-sm font-medium text-primary">{summary.chitName}</TableCell>
                      <TableCell className="text-right font-medium">₹{summary.totalAmount.toLocaleString()}</TableCell>
                      <TableCell className="text-right font-bold text-emerald-600">₹{summary.amountPaid.toLocaleString()}</TableCell>
                      <TableCell className="text-right font-bold text-amber-600">₹{summary.pendingAmount.toLocaleString()}</TableCell>
                      <TableCell className="text-center">
                        <Badge 
                          variant={summary.status === 'Paid' ? 'default' : 'secondary'}
                          className={cn(
                            "text-[10px] font-bold uppercase tracking-wider px-3 py-1",
                            summary.status === 'Paid' ? "bg-emerald-500 hover:bg-emerald-600" : "bg-amber-100 text-amber-700 border-amber-200"
                          )}
                        >
                          {summary.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center text-muted-foreground italic">
                      No members found for the current filter.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      {/* History Dialog */}
      <Dialog open={isHistoryOpen} onOpenChange={(open) => {
        setIsHistoryOpen(open)
        restoreInteraction(open)
        if (!open) setHistoryMember(null)
      }}>
        <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto focus:outline-none">
          {isHistoryOpen && (
            <>
              <DialogHeader>
                <DialogTitle>Member History: {historyMember?.memberName}</DialogTitle>
                <DialogDescription>Viewing all historical contributions for this participant.</DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <Table>
                  <TableHeader className="bg-muted/10">
                    <TableRow>
                      <TableHead className="font-bold text-xs uppercase tracking-wider">Period</TableHead>
                      <TableHead className="font-bold text-xs uppercase tracking-wider">Amount</TableHead>
                      <TableHead className="text-right font-bold text-xs uppercase tracking-wider">Payment Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.filter(p => p.memberId === historyMember?.memberId && (p.status === 'paid' || p.status === 'success')).map((entry, i) => (
                      <TableRow key={i} className="hover:bg-muted/5">
                        <TableCell className="text-sm font-medium">{entry.month}</TableCell>
                        <TableCell className="text-sm font-bold text-emerald-600">₹{entry.amountPaid?.toLocaleString()}</TableCell>
                        <TableCell className="text-sm text-right text-muted-foreground font-medium">
                          {entry.paymentDate ? format(parseISO(entry.paymentDate), 'MMM dd, yyyy') : "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <DialogFooter className="sticky bottom-0 bg-background pt-2 border-t mt-4">
                <Button className="w-full sm:w-auto" onClick={() => { setIsHistoryOpen(false); restoreInteraction(false); }}>Close</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Payment Dialog */}
      <AlertDialog open={isDeletePaymentDialogOpen} onOpenChange={(open) => {
        setIsDeletePaymentDialogOpen(open)
        restoreInteraction(open)
        if (!open) setPaymentToDelete(null)
      }}>
        <AlertDialogContent className="focus:outline-none">
          {isDeletePaymentDialogOpen && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle className="text-destructive">Delete Transaction?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently remove the payment of <strong>₹{paymentToDelete?.amountPaid?.toLocaleString()}</strong> recorded on {paymentToDelete?.paymentDate ? format(parseISO(paymentToDelete.paymentDate), 'MMM dd, yyyy') : ''} for {paymentToDelete?.memberName}. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => { setIsDeletePaymentDialogOpen(false); restoreInteraction(false); }} disabled={isActionPending}>Cancel</AlertDialogCancel>
                <AlertDialogAction 
                  className="bg-destructive hover:bg-destructive/90" 
                  onClick={(e) => {
                    e.preventDefault()
                    handleDeletePayment()
                  }}
                  disabled={isActionPending}
                >
                  {isActionPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                  Confirm Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
