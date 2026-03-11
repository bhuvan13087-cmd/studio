"use client"

import { useState, useMemo, useEffect, useRef } from "react"
import { Search, CheckCircle2, Clock, MoreHorizontal, History, Plus, Loader2, Calendar, Trash2, X, LayoutList, FileText, User, Lock } from "lucide-react"
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { useFirestore, useCollection, useMemoFirebase, useUser } from "@/firebase"
import { collection, query, doc, serverTimestamp, orderBy, updateDoc } from "firebase/firestore"
import { addDocumentNonBlocking, deleteDocumentNonBlocking } from "@/firebase/non-blocking-updates"
import { useRole } from "@/hooks/use-role"
import { format, parseISO, startOfMonth, endOfMonth, isWithinInterval } from "date-fns"
import { cn } from "@/lib/utils"
import { createAuditLog } from "@/firebase/logging"

export default function PaymentsPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [typeFilter, setTypeFilter] = useState("all")
  const [historyMember, setHistoryMember] = useState<any>(null)
  const [isQuickRecordOpen, setIsQuickRecordOpen] = useState(false)
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)
  const [isDeletePaymentDialogOpen, setIsDeletePaymentDialogOpen] = useState(false)
  const [paymentToDelete, setPaymentToDelete] = useState<any>(null)
  const [isActionPending, setIsActionPending] = useState(false)
  
  const [memberSearch, setMemberSearch] = useState("")
  const [showSuggestions, setShowSuggestions] = useState(false)
  const suggestionsRef = useRef<HTMLDivElement>(null)

  const [selectedAuditMember, setSelectedAuditMember] = useState<any>(null)
  const [isAuditProfileOpen, setIsAuditProfileOpen] = useState(false)

  const { toast } = useToast()
  const db = useFirestore()
  const { user } = useUser()
  const { isAdmin, isLoading: isRoleLoading } = useRole()

  // STABILIZED QUERIES
  const paymentsQuery = useMemoFirebase(() => query(collection(db, 'payments'), orderBy('paymentDate', 'desc')), [db]);
  const { data: paymentsData, isLoading: isPaymentsLoading } = useCollection(paymentsQuery);
  const payments = paymentsData || [];

  const membersQuery = useMemoFirebase(() => query(collection(db, 'members'), orderBy('name', 'asc')), [db]);
  const { data: membersData, isLoading: isMembersLoading } = useCollection(membersQuery);
  const members = membersData || [];

  const roundsQuery = useMemoFirebase(() => query(collection(db, 'chitRounds')), [db]);
  const { data: roundsData } = useCollection(roundsQuery);
  const rounds = roundsData || [];

  const locksQuery = useMemoFirebase(() => collection(db, 'monthLocks'), [db]);
  const { data: monthLocks } = useCollection(locksQuery);

  const [recordData, setRecordData] = useState({ 
    memberId: "", 
    amount: 0, 
    month: new Date().toLocaleString('default', { month: 'long', year: 'numeric' }), 
    method: "Cash" 
  })

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target as Node)) setShowSuggestions(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.body.style.pointerEvents = 'auto'
      document.body.style.overflow = 'auto'
    }
  }, []);

  const isCurrentMonthLocked = useMemo(() => {
    if (!monthLocks) return false;
    const [monthName, yearStr] = recordData.month.split(' ');
    return monthLocks.some(l => l.year === yearStr && l.monthName === monthName);
  }, [monthLocks, recordData.month]);

  const filteredMembersForSelection = useMemo(() => {
    if (!memberSearch) return [];
    return members.filter(m => m.status !== 'inactive' && m.name.toLowerCase().includes(memberSearch.toLowerCase()));
  }, [members, memberSearch]);

  const handleMemberSelect = (member: any) => {
    setRecordData({ ...recordData, memberId: member.id, amount: member.monthlyAmount || 0 });
    setMemberSearch(member.name);
    setShowSuggestions(false);
  }

  const handleQuickRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || isActionPending || !recordData.memberId) return;
    
    if (isCurrentMonthLocked) {
      toast({ variant: "destructive", title: "Locked", description: "This month is locked. No new payments allowed." });
      return;
    }

    const member = members.find(m => m.id === recordData.memberId);
    if (!member) return;

    setIsActionPending(true)
    const amount = Number(recordData.amount);
    try {
      await addDocumentNonBlocking(collection(db, 'payments'), { 
        memberId: member.id, 
        memberName: member.name, 
        month: recordData.month, 
        amountPaid: amount, 
        paymentDate: new Date().toISOString(), 
        status: "paid", 
        method: recordData.method || "Cash", 
        createdAt: serverTimestamp() 
      });

      const memberRef = doc(db, 'members', member.id);
      await updateDoc(memberRef, { 
        paymentStatus: "success", 
        totalPaid: (member.totalPaid || 0) + amount 
      });
      
      await createAuditLog(db, user, `Recorded Payment ₹${amount} for ${member.name}`)
      
      setIsQuickRecordOpen(false);
      setRecordData({ 
        memberId: "", 
        amount: 0, 
        month: new Date().toLocaleString('default', { month: 'long', year: 'numeric' }), 
        method: "Cash" 
      });
      setMemberSearch("");
      toast({ title: "Payment Recorded", description: `Amount ₹${amount} saved for ${member.name}.` });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: "Failed to record payment." })
    } finally { 
      setIsActionPending(false);
    }
  }

  const handleDeletePayment = async () => {
    if (!db || !paymentToDelete || isActionPending) return;
    
    const [monthName, yearStr] = paymentToDelete.month.split(' ');
    const isLocked = monthLocks?.some(l => l.year === yearStr && l.monthName === monthName);
    
    if (isLocked) {
      toast({ variant: "destructive", title: "Locked", description: "Cannot delete record from a locked month." });
      return;
    }

    setIsActionPending(true)
    try {
      const member = members.find(m => m.id === paymentToDelete.memberId);
      if (member) {
        const memberRef = doc(db, 'members', member.id);
        await updateDoc(memberRef, { 
          totalPaid: Math.max(0, (member.totalPaid || 0) - (paymentToDelete.amountPaid || 0)) 
        });
      }
      
      await deleteDocumentNonBlocking(doc(db, 'payments', paymentToDelete.id));
      await createAuditLog(db, user, `Deleted payment record of ₹${paymentToDelete.amountPaid} for ${paymentToDelete.memberName}`)
      
      setIsDeletePaymentDialogOpen(false);
      setPaymentToDelete(null);
      toast({ title: "Record Deleted", description: "Payment removed successfully." });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: "Failed to delete record." });
    } finally { 
      setIsActionPending(false);
    }
  }

  const filteredPayments = useMemo(() => {
    let list = payments.filter(p => p.status === 'paid' || p.status === 'success');
    if (searchTerm) list = list.filter(p => p.memberName?.toLowerCase().includes(searchTerm.toLowerCase()));
    if (typeFilter !== "all") {
      list = list.filter(p => {
        const member = members.find(m => m.id === p.memberId);
        const round = rounds.find(r => r.name === member?.chitGroup);
        return (round?.collectionType || "Monthly").toLowerCase() === typeFilter;
      });
    }
    return list;
  }, [payments, searchTerm, typeFilter, members, rounds]);

  const memberSummaries = useMemo(() => {
    const now = new Date();
    const start = startOfMonth(now);
    const end = endOfMonth(now);
    return members.filter(m => m.status !== 'inactive').filter(m => {
        const matchesSearch = m.name.toLowerCase().includes(searchTerm.toLowerCase());
        if (!matchesSearch) return false;
        if (typeFilter !== "all") {
          const round = rounds.find(r => r.name === m.chitGroup);
          return (round?.collectionType || "Monthly").toLowerCase() === typeFilter;
        }
        return true;
      })
      .map(member => {
        const monthlyPayments = payments.filter(p => p.memberId === member.id && (p.status === 'paid' || p.status === 'success') && p.paymentDate && isWithinInterval(parseISO(p.paymentDate), { start, end }));
        const totalPaid = monthlyPayments.reduce((acc, p) => acc + (p.amountPaid || 0), 0);
        const target = member.monthlyAmount || 0;
        return { 
          id: member.id, 
          name: member.name, 
          chitName: member.chitGroup || "N/A", 
          totalAmount: target, 
          amountPaid: totalPaid, 
          pendingAmount: Math.max(0, target - totalPaid), 
          status: totalPaid >= target ? "Paid" : "Pending" 
        };
      });
  }, [members, payments, rounds, searchTerm, typeFilter]);

  const openAuditProfile = (memberId: string) => {
    const member = members.find(m => m.id === memberId);
    if (member) {
      setSelectedAuditMember(member);
      setIsAuditProfileOpen(true);
    }
  }

  if (isRoleLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-500 pb-10 overflow-x-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-2xl sm:text-3xl font-headline font-bold tracking-tight text-primary">Financial Ledger</h2>
          <p className="text-sm sm:text-base text-muted-foreground">Manage and track all seat reservation transactions.</p>
        </div>
        <Dialog open={isQuickRecordOpen} onOpenChange={(open) => { 
          if (!isActionPending) {
            setIsQuickRecordOpen(open); 
            if (!open) { 
              setMemberSearch(""); 
              setShowSuggestions(false); 
              setRecordData({ 
                memberId: "", 
                amount: 0, 
                month: new Date().toLocaleString('default', { month: 'long', year: 'numeric' }), 
                method: "Cash" 
              });
            }
          }
        }}>
          <DialogTrigger asChild>
            <Button className="h-10 sm:h-11 w-full sm:w-auto px-6 shadow-lg font-bold">
              <Plus className="mr-2 size-4 sm:size-5" /> Add Payment
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <form onSubmit={handleQuickRecord}>
              <DialogHeader><DialogTitle>Record Payment</DialogTitle><DialogDescription>Manual entry for active member contributions.</DialogDescription></DialogHeader>
              <div className="grid gap-4 py-6">
                {isCurrentMonthLocked && (
                  <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg flex items-center gap-2 text-amber-800 text-xs font-bold">
                    <Lock className="size-4" /> This month is locked for financial entry.
                  </div>
                )}
                <div className="grid gap-2 relative">
                  <Label>Search Active Member</Label>
                  <div className="relative" ref={suggestionsRef}>
                    <Input placeholder="Type member name..." value={memberSearch} onChange={(e) => { setMemberSearch(e.target.value); setShowSuggestions(true); }} autoComplete="off" disabled={isActionPending || isCurrentMonthLocked} />
                    {showSuggestions && memberSearch.length > 0 && (
                      <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg overflow-hidden">
                        <ScrollArea className="h-[150px]">
                          <div className="p-1">{filteredMembersForSelection.length > 0 ? filteredMembersForSelection.map((m) => (<Button key={m.id} type="button" variant="ghost" className="w-full justify-start font-normal h-9 px-3 text-xs" onClick={() => handleMemberSelect(m)}>{m.name} ({m.chitGroup})</Button>)) : <div className="p-3 text-center text-xs text-muted-foreground">No active member found.</div>}</div>
                        </ScrollArea>
                      </div>
                    )}
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>Contribution Amount (₹)</Label>
                  <Input value={recordData.amount || ""} readOnly className="bg-muted font-bold text-primary" />
                </div>
                <div className="grid gap-2">
                  <Label>Method</Label>
                  <Select disabled={isActionPending || isCurrentMonthLocked} value={recordData.method} onValueChange={(v) => setRecordData({...recordData, method: v})}>
                    <SelectTrigger><SelectValue placeholder="Select method" /></SelectTrigger>
                    <SelectContent><SelectItem value="Cash">Cash</SelectItem><SelectItem value="UPI">UPI</SelectItem><SelectItem value="Bank Transfer">Bank Transfer</SelectItem></SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter className="flex-col sm:flex-row gap-2">
                <Button type="button" variant="outline" onClick={() => setIsQuickRecordOpen(false)} className="w-full sm:w-auto">Cancel</Button>
                <Button type="submit" disabled={isActionPending || !recordData.memberId || isCurrentMonthLocked} className="w-full sm:w-auto font-bold">
                  {isActionPending && <Loader2 className="mr-2 size-4 animate-spin" />} Save Payment
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-col md:flex-row items-stretch md:items-center gap-4 bg-card p-3 sm:p-4 rounded-xl shadow-sm border border-border/50">
        <div className="flex items-center flex-1 gap-2">
          <Search className="size-4 sm:size-5 text-muted-foreground shrink-0" />
          <Input placeholder="Search member in history..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="border-none focus-visible:ring-0 shadow-none bg-transparent h-8 text-sm" />
        </div>
        <div className="flex items-center gap-2 border-t md:border-t-0 md:border-l pt-3 md:pt-0 md:pl-4">
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-full md:w-[110px] h-8 bg-muted/30 border-none text-xs font-bold uppercase tracking-tight"><SelectValue placeholder="Type" /></SelectTrigger>
            <SelectContent><SelectItem value="all">All Schemes</SelectItem><SelectItem value="daily">Daily</SelectItem><SelectItem value="monthly">Monthly</SelectItem></SelectContent>
          </Select>
        </div>
      </div>

      <Tabs defaultValue="history" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-[320px] h-9 p-1 bg-muted/50 border mb-6">
          <TabsTrigger value="history" className="text-[10px] sm:text-xs font-bold uppercase tracking-wider gap-2"><LayoutList className="size-3.5" />History</TabsTrigger>
          <TabsTrigger value="summary" className="text-[10px] sm:text-xs font-bold uppercase tracking-wider gap-2"><FileText className="size-3.5" />Summary</TabsTrigger>
        </TabsList>

        <TabsContent value="history" className="mt-0">
          <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead className="font-bold text-xs uppercase tracking-wider">Date</TableHead>
                    <TableHead className="font-bold text-xs uppercase tracking-wider">Member</TableHead>
                    <TableHead className="font-bold text-xs uppercase tracking-wider">Amount (₹)</TableHead>
                    <TableHead className="font-bold text-xs uppercase tracking-wider hidden md:table-cell">Method</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isPaymentsLoading ? (
                    <TableRow><TableCell colSpan={5} className="h-32 text-center text-muted-foreground animate-pulse">Loading history...</TableCell></TableRow>
                  ) : filteredPayments.length > 0 ? (
                    filteredPayments.map((p) => {
                      const [m, y] = p.month.split(' ');
                      const isLocked = monthLocks?.some(l => l.year === y && l.monthName === m);
                      return (
                        <TableRow key={p.id} className="hover:bg-muted/10 transition-colors">
                          <TableCell className="text-[10px] sm:text-xs font-medium tabular-nums text-muted-foreground">
                            <div className="flex items-center gap-1.5">
                              {isLocked && <Lock className="size-2.5 text-amber-600" title="Month Locked" />}
                              {p.paymentDate ? format(parseISO(p.paymentDate), 'MMM dd, yyyy') : "-"}
                            </div>
                          </TableCell>
                          <TableCell className="font-semibold text-xs sm:text-sm">
                            <button onClick={() => openAuditProfile(p.memberId)} className="hover:text-primary hover:underline transition-all text-left">
                              {p.memberName}
                            </button>
                          </TableCell>
                          <TableCell className="font-bold text-emerald-600 text-xs sm:text-sm tabular-nums">₹{p.amountPaid?.toLocaleString()}</TableCell>
                          <TableCell className="hidden md:table-cell text-[10px] font-bold text-muted-foreground uppercase">{p.method || "Cash"}</TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="size-4" /></Button></DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-44">
                                <DropdownMenuItem onSelect={() => { setHistoryMember(p); setIsHistoryOpen(true); }}><History className="mr-2 size-4" /> Full History</DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                  disabled={isLocked}
                                  className={cn("text-destructive focus:bg-destructive/10 focus:text-destructive", isLocked && "opacity-50 pointer-events-none")} 
                                  onSelect={() => { setPaymentToDelete(p); setIsDeletePaymentDialogOpen(true); }}
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
                    <TableRow><TableCell colSpan={5} className="h-32 text-center text-muted-foreground italic text-xs">No records matching search.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="summary" className="mt-0">
          <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead className="font-bold text-xs uppercase tracking-wider">Member</TableHead>
                    <TableHead className="font-bold text-xs uppercase tracking-wider text-right">Target</TableHead>
                    <TableHead className="font-bold text-xs uppercase tracking-wider text-right">Paid</TableHead>
                    <TableHead className="font-bold text-xs uppercase tracking-wider text-right">Due</TableHead>
                    <TableHead className="font-bold text-xs uppercase tracking-wider text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isMembersLoading ? (
                    <TableRow><TableCell colSpan={5} className="h-32 text-center text-muted-foreground animate-pulse">Calculating summary...</TableCell></TableRow>
                  ) : memberSummaries.length > 0 ? (
                    memberSummaries.map((s) => (
                      <TableRow key={s.id} className="hover:bg-muted/10 transition-colors">
                        <TableCell className="font-semibold text-xs sm:text-sm">{s.name}</TableCell>
                        <TableCell className="text-right text-xs font-medium tabular-nums">₹{s.totalAmount.toLocaleString()}</TableCell>
                        <TableCell className="text-right text-xs font-bold text-emerald-600 tabular-nums">₹{s.amountPaid.toLocaleString()}</TableCell>
                        <TableCell className="text-right text-xs font-bold text-amber-600 tabular-nums">₹{s.pendingAmount.toLocaleString()}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant={s.status === 'Paid' ? 'default' : 'secondary'} className={cn("text-[8px] sm:text-[9px] font-bold uppercase px-2", s.status === 'Paid' ? "bg-emerald-500" : "bg-amber-100 text-amber-700")}>{s.status}</Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow><TableCell colSpan={5} className="h-32 text-center text-muted-foreground italic text-xs">No active members found.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Member Audit Profile Modal */}
      <Dialog open={isAuditProfileOpen} onOpenChange={setIsAuditProfileOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><User className="size-5 text-primary" /> Member Audit Profile</DialogTitle></DialogHeader>
          {selectedAuditMember && (
            <div className="space-y-4 py-4">
              <div className="flex justify-between items-center p-3 bg-muted/30 rounded-lg"><span className="text-xs font-bold uppercase text-muted-foreground">Name</span><span className="font-bold text-sm">{selectedAuditMember.name}</span></div>
              <div className="flex justify-between items-center p-3 bg-muted/30 rounded-lg"><span className="text-xs font-bold uppercase text-muted-foreground">Status</span><Badge variant={selectedAuditMember.status === 'active' ? 'default' : 'secondary'} className="uppercase font-bold text-[9px]">{selectedAuditMember.status}</Badge></div>
              {selectedAuditMember.status === 'inactive' ? (
                <div className="p-4 border border-destructive/20 bg-destructive/5 rounded-lg space-y-2">
                  <span className="text-[10px] font-bold uppercase text-destructive tracking-widest block">Active Period</span>
                  <div className="flex items-center gap-2 font-bold text-sm text-foreground">{selectedAuditMember.joinDate ? format(parseISO(selectedAuditMember.joinDate), 'MMM dd, yyyy') : '-'}<span className="text-muted-foreground">→</span>{selectedAuditMember.deactivatedAt ? format(parseISO(selectedAuditMember.deactivatedAt), 'MMM dd, yyyy') : '-'}</div>
                </div>
              ) : (
                <div className="flex justify-between items-center p-3 bg-emerald-50 rounded-lg"><span className="text-xs font-bold uppercase text-emerald-600">Joined Date</span><span className="font-bold text-sm text-emerald-700">{selectedAuditMember.joinDate ? format(parseISO(selectedAuditMember.joinDate), 'MMM dd, yyyy') : '-'}</span></div>
              )}
            </div>
          )}
          <DialogFooter><Button onClick={() => setIsAuditProfileOpen(false)} className="w-full sm:w-auto font-bold uppercase text-[10px] tracking-widest">Close Audit</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isHistoryOpen} onOpenChange={(open) => { setIsHistoryOpen(open); if (!open) setHistoryMember(null) }}>
        <DialogContent className="sm:max-w-[500px]">
          {isHistoryOpen && (
            <>
              <DialogHeader><DialogTitle className="text-xl">History: {historyMember?.memberName}</DialogTitle></DialogHeader>
              <div className="py-4"><Table><TableHeader><TableRow><TableHead className="text-xs uppercase font-bold text-muted-foreground">Month</TableHead><TableHead className="text-xs uppercase font-bold text-muted-foreground">Paid</TableHead><TableHead className="text-right text-xs uppercase font-bold text-muted-foreground">Date</TableHead></TableRow></TableHeader><TableBody>{payments.filter(p => p.memberId === historyMember?.memberId && (p.status === 'paid' || p.status === 'success')).map((e, i) => (<TableRow key={i}><TableCell className="text-sm font-semibold">{e.month}</TableCell><TableCell className="text-sm font-bold text-emerald-600">₹{e.amountPaid?.toLocaleString()}</TableCell><TableCell className="text-right text-xs text-muted-foreground font-medium">{e.paymentDate ? format(parseISO(e.paymentDate), 'MMM dd, yyyy') : "-"}</TableCell></TableRow>))}</TableBody></Table></div>
              <DialogFooter><Button className="w-full sm:w-auto font-bold" onClick={() => setIsHistoryOpen(false)}>Close</Button></DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeletePaymentDialogOpen} onOpenChange={(open) => { if (!isActionPending) { setIsDeletePaymentDialogOpen(open); if (!open) setPaymentToDelete(null) } }}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle className="text-destructive">Delete Transaction?</AlertDialogTitle><AlertDialogDescription>Permanently remove this payment of <strong>₹{paymentToDelete?.amountPaid?.toLocaleString()}</strong>? This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel disabled={isActionPending}>Cancel</AlertDialogCancel><AlertDialogAction className="bg-destructive hover:bg-destructive/90 font-bold" onClick={handleDeletePayment} disabled={isActionPending}>{isActionPending && <Loader2 className="mr-2 size-4 animate-spin" />} Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
