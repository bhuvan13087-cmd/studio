"use client"

import { useState, useMemo, useEffect } from "react"
import { Search, CheckCircle2, Clock, MoreHorizontal, History, Plus, Loader2, Calendar, Trash2, X, LayoutList, FileText, User, Lock, ChevronDown, Edit3, ArrowRight } from "lucide-react"
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
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { useFirestore, useCollection, useMemoFirebase, useUser } from "@/firebase"
import { collection, query, doc, serverTimestamp, orderBy, updateDoc, deleteDoc, writeBatch } from "firebase/firestore"
import { useRole } from "@/hooks/use-role"
import { format, parseISO, startOfMonth, endOfMonth, isWithinInterval } from "date-fns"
import { cn, withTimeout } from "@/lib/utils"
import { createAuditLog } from "@/firebase/logging"

const PAGE_SIZE = 50

export default function PaymentsPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [typeFilter, setTypeFilter] = useState("all")
  const [historyMember, setHistoryMember] = useState<any>(null)
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)
  const [isDeletePaymentDialogOpen, setIsDeletePaymentDialogOpen] = useState(false)
  const [paymentToDelete, setPaymentToDelete] = useState<any>(null)
  const [isActionPending, setIsActionPending] = useState(false)
  const [historyLimit, setHistoryLimit] = useState(PAGE_SIZE)
  const [summaryLimit, setSummaryLimit] = useState(PAGE_SIZE)
  
  const [selectedAuditMember, setSelectedAuditMember] = useState<any>(null)
  const [isAuditProfileOpen, setIsAuditProfileOpen] = useState(false)

  // Correction State
  const [isCorrectionOpen, setIsCorrectionOpen] = useState(false)
  const [paymentToCorrect, setPaymentToCorrect] = useState<any>(null)
  const [correctionData, setCorrectionData] = useState({
    memberId: "",
    amount: 0,
    date: ""
  })

  const { toast } = useToast()
  const db = useFirestore()
  const { user } = useUser()
  const { isAdmin, isLoading: isRoleLoading } = useRole()

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

  useEffect(() => {
    const recoveryInterval = setInterval(() => {
      if (document.body.style.pointerEvents === 'none') {
        document.body.style.pointerEvents = 'auto'
        document.body.style.overflow = 'auto'
      }
    }, 1000)
    return () => clearInterval(recoveryInterval)
  }, []);

  const handleCorrectPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !paymentToCorrect || isActionPending) return;

    const newMember = members.find(m => m.id === correctionData.memberId);
    if (!newMember) {
      toast({ variant: "destructive", title: "Member Required", description: "Please select a valid member." });
      return;
    }

    setIsActionPending(true);
    try {
      const batch = writeBatch(db);
      const originalPaymentRef = doc(db, 'payments', paymentToCorrect.id);
      const newPaymentRef = doc(collection(db, 'payments'));
      
      const [monthName, yearStr] = format(parseISO(correctionData.date), 'MMMM yyyy').split(' ');
      const isLocked = monthLocks?.some(l => l.year === yearStr && l.monthName === monthName);
      if (isLocked) throw new Error("Target month is locked.");

      // 1. Mark original as corrected
      batch.update(originalPaymentRef, {
        status: 'corrected',
        correctedAt: new Date().toISOString(),
        correctedToId: newPaymentRef.id
      });

      // 2. Adjust original member's balance (subtract old amount)
      const oldMember = members.find(m => m.id === paymentToCorrect.memberId);
      if (oldMember) {
        const oldMemberRef = doc(db, 'members', oldMember.id);
        batch.update(oldMemberRef, {
          totalPaid: Math.max(0, (oldMember.totalPaid || 0) - (paymentToCorrect.amountPaid || 0))
        });
      }

      // 3. Create new correct payment record
      batch.set(newPaymentRef, {
        id: newPaymentRef.id,
        memberId: newMember.id,
        memberName: newMember.name,
        month: format(parseISO(correctionData.date), 'MMMM yyyy'),
        targetDate: correctionData.date,
        amountPaid: Number(correctionData.amount),
        paymentDate: new Date().toISOString(),
        status: "success",
        method: paymentToCorrect.method || "Cash",
        originalPaymentId: paymentToCorrect.id,
        createdAt: serverTimestamp()
      });

      // 4. Adjust new member's balance (add new amount)
      const newMemberRef = doc(db, 'members', newMember.id);
      batch.update(newMemberRef, {
        totalPaid: (newMember.id === oldMember?.id 
          ? Math.max(0, (oldMember.totalPaid || 0) - (paymentToCorrect.amountPaid || 0)) 
          : (newMember.totalPaid || 0)) + Number(correctionData.amount)
      });

      await withTimeout(batch.commit());
      await createAuditLog(db, user, `Corrected payment for ${paymentToCorrect.memberName} (₹${paymentToCorrect.amountPaid}) to ${newMember.name} (₹${correctionData.amount})`);

      setIsCorrectionOpen(false);
      setPaymentToCorrect(null);
      toast({ title: "Payment Corrected", description: "Record updated and balances re-calculated." });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Correction Failed", description: error.message || "An error occurred." });
    } finally {
      setIsActionPending(false);
    }
  };

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
        await withTimeout(updateDoc(memberRef, { 
          totalPaid: Math.max(0, (member.totalPaid || 0) - (paymentToDelete.amountPaid || 0)) 
        }));
      }
      
      await withTimeout(deleteDoc(doc(db, 'payments', paymentToDelete.id)));
      await createAuditLog(db, user, `Deleted payment record of ₹${paymentToDelete.amountPaid} for ${paymentToDelete.memberName}`);
      
      setIsDeletePaymentDialogOpen(false);
      setPaymentToDelete(null);
      toast({ title: "Record Deleted", description: "Payment removed successfully." });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message || "Failed to delete record." });
    } finally { 
      setIsActionPending(false);
    }
  }

  const filteredPayments = useMemo(() => {
    let list = payments.filter(p => p.status === 'paid' || p.status === 'success' || p.status === 'corrected');
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

  const visiblePayments = useMemo(() => filteredPayments.slice(0, historyLimit), [filteredPayments, historyLimit]);

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
          status: totalPaid >= target ? "Paid" : "Unpaid" 
        };
      });
  }, [members, payments, rounds, searchTerm, typeFilter]);

  const visibleSummaries = useMemo(() => memberSummaries.slice(0, summaryLimit), [memberSummaries, summaryLimit]);

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
      </div>

      <div className="flex flex-col md:flex-row items-stretch md:items-center gap-4 bg-card p-3 sm:p-4 rounded-xl shadow-sm border border-border/50">
        <div className="flex items-center flex-1 gap-2">
          <Search className="size-4 sm:size-5 text-muted-foreground shrink-0" />
          <Input placeholder="Search member in history..." value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setHistoryLimit(PAGE_SIZE); setSummaryLimit(PAGE_SIZE); }} className="border-none focus-visible:ring-0 shadow-none bg-transparent h-8 text-sm" />
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
                    <TableHead className="font-bold text-xs uppercase tracking-wider hidden md:table-cell">Status</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isPaymentsLoading ? (
                    <TableRow><TableCell colSpan={5} className="h-32 text-center text-muted-foreground animate-pulse">Loading history...</TableCell></TableRow>
                  ) : visiblePayments.length > 0 ? (
                    visiblePayments.map((p) => {
                      const [m, y] = p.month.split(' ');
                      const isLocked = monthLocks?.some(l => l.year === y && l.monthName === m);
                      const isCorrected = p.status === 'corrected';
                      return (
                        <TableRow key={p.id} className={cn("hover:bg-muted/10 transition-colors", isCorrected && "opacity-60 bg-muted/5")}>
                          <TableCell className="text-[10px] sm:text-xs font-medium tabular-nums text-muted-foreground">
                            <div className="flex items-center gap-1.5">
                              {isLocked && <Lock className="size-2.5 text-amber-600" title="Month Locked" />}
                              {p.targetDate || (p.paymentDate ? format(parseISO(p.paymentDate), 'yyyy-MM-dd') : "-")}
                            </div>
                          </TableCell>
                          <TableCell className={cn("font-semibold text-xs sm:text-sm", isCorrected && "line-through")}>
                            <button onClick={() => openAuditProfile(p.memberId)} className="hover:text-primary hover:underline transition-all text-left">
                              {p.memberName}
                            </button>
                          </TableCell>
                          <TableCell className={cn("font-bold text-xs sm:text-sm tabular-nums", isCorrected ? "text-muted-foreground" : "text-emerald-600")}>₹{p.amountPaid?.toLocaleString()}</TableCell>
                          <TableCell className="hidden md:table-cell">
                            <Badge variant={isCorrected ? "secondary" : "outline"} className={cn("text-[8px] uppercase font-bold", isCorrected && "bg-amber-50 text-amber-700")}>
                              {isCorrected ? "Corrected" : "Success"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7" disabled={isActionPending}>
                                  <MoreHorizontal className="size-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-44">
                                <DropdownMenuItem onSelect={() => { 
                                  if (!isActionPending) {
                                    setHistoryMember(p); 
                                    setIsHistoryOpen(true); 
                                  }
                                }}>
                                  <History className="mr-2 size-4" /> Full History
                                </DropdownMenuItem>
                                {!isCorrected && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onSelect={() => {
                                      if (!isActionPending) {
                                        setPaymentToCorrect(p);
                                        setCorrectionData({
                                          memberId: p.memberId,
                                          amount: p.amountPaid,
                                          date: p.targetDate || format(new Date(), 'yyyy-MM-dd')
                                        });
                                        setIsCorrectionOpen(true);
                                      }
                                    }}>
                                      <Edit3 className="mr-2 size-4 text-primary" /> Correct Payment
                                    </DropdownMenuItem>
                                  </>
                                )}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                  disabled={isLocked || isActionPending}
                                  className={cn("text-destructive focus:bg-destructive/10 focus:text-destructive", (isLocked || isCorrected) && "opacity-50 pointer-events-none")} 
                                  onSelect={() => { 
                                    if (!isActionPending) {
                                      setPaymentToDelete(p); 
                                      setIsDeletePaymentDialogOpen(true); 
                                    }
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
                    <TableRow><TableCell colSpan={5} className="h-32 text-center text-muted-foreground italic text-xs">No records matching search.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            {filteredPayments.length > historyLimit && (
              <div className="p-4 border-t flex justify-center">
                <Button variant="ghost" size="sm" onClick={() => setHistoryLimit(prev => prev + PAGE_SIZE)} className="text-xs font-bold uppercase tracking-widest gap-2">
                  <ChevronDown className="size-4" /> Load More History
                </Button>
              </div>
            )}
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
                    <TableHead className="font-bold text-xs uppercase tracking-wider text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isMembersLoading ? (
                    <TableRow><TableCell colSpan={5} className="h-32 text-center text-muted-foreground animate-pulse">Calculating summary...</TableCell></TableRow>
                  ) : visibleSummaries.length > 0 ? (
                    visibleSummaries.map((s) => (
                      <TableRow key={s.id} className="hover:bg-muted/10 transition-colors">
                        <TableCell className="font-semibold text-xs sm:text-sm">{s.name}</TableCell>
                        <TableCell className="text-right text-xs font-medium tabular-nums">₹{s.totalAmount.toLocaleString()}</TableCell>
                        <TableCell className="text-right text-xs font-bold text-emerald-600 tabular-nums">₹{s.amountPaid.toLocaleString()}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant={s.status === 'Paid' ? 'default' : 'secondary'} className={cn("text-[8px] sm:text-[9px] font-bold uppercase px-2", s.status === 'Paid' ? "bg-emerald-500" : "bg-amber-100 text-amber-700")}>{s.status}</Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow><TableCell colSpan={4} className="h-32 text-center text-muted-foreground italic text-xs">No active members found.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            {memberSummaries.length > summaryLimit && (
              <div className="p-4 border-t flex justify-center">
                <Button variant="ghost" size="sm" onClick={() => setSummaryLimit(prev => prev + PAGE_SIZE)} className="text-xs font-bold uppercase tracking-widest gap-2">
                  <ChevronDown className="size-4" /> Load More Summaries
                </Button>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Correction Dialog */}
      <Dialog open={isCorrectionOpen} onOpenChange={(o) => { if(!isActionPending) { setIsCorrectionOpen(o); if(!o) setPaymentToCorrect(null); } }}>
        <DialogContent className="sm:max-w-[450px]">
          {paymentToCorrect && (
            <form onSubmit={handleCorrectPayment} className="space-y-6">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Edit3 className="size-5 text-primary" /> Payment Correction
                </DialogTitle>
                <DialogDescription>Rectify mistakes in member, amount, or date. Original data remains as an audit record.</DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="p-3 bg-muted/30 rounded-lg space-y-2">
                  <Label className="text-[10px] font-bold uppercase text-muted-foreground">Original Record</Label>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold">{paymentToCorrect.memberName}</span>
                    <span className="font-bold text-emerald-600">₹{paymentToCorrect.amountPaid?.toLocaleString()}</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground">{paymentToCorrect.targetDate || "No target date"}</div>
                </div>

                <div className="flex justify-center"><ArrowRight className="size-5 text-primary/30" /></div>

                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <Label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">Correct Member</Label>
                    <Select value={correctionData.memberId} onValueChange={(v) => setCorrectionData({...correctionData, memberId: v})} disabled={isActionPending}>
                      <SelectTrigger><SelectValue placeholder="Select member" /></SelectTrigger>
                      <SelectContent>
                        {members.filter(m => m.status !== 'inactive').map(m => (
                          <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">Correct Amount (₹)</Label>
                    <Input type="number" value={correctionData.amount || ""} onChange={e => setCorrectionData({...correctionData, amount: Number(e.target.value)})} required disabled={isActionPending} />
                  </div>
                  <div className="grid gap-2">
                    <Label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">Correct Date</Label>
                    <Input type="date" value={correctionData.date} onChange={e => setCorrectionData({...correctionData, date: e.target.value})} required disabled={isActionPending} />
                  </div>
                </div>
              </div>

              <DialogFooter className="gap-2">
                <Button variant="outline" type="button" onClick={() => setIsCorrectionOpen(false)} disabled={isActionPending} className="w-full sm:w-auto">Cancel</Button>
                <Button type="submit" disabled={isActionPending} className="w-full sm:w-auto font-bold gap-2">
                  {isActionPending ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                  Apply Correction
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

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
          <AlertDialogFooter><AlertDialogCancel disabled={isActionPending}>Cancel</AlertDialogCancel><AlertDialogAction className="bg-destructive hover:bg-destructive/90 font-bold" onClick={handleDeletePayment} disabled={isActionPending}>{isActionPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
