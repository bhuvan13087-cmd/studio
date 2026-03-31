"use client"

import { useState, useMemo, useEffect } from "react"
import { Search, CheckCircle2, Clock, MoreHorizontal, History, Plus, Loader2, Calendar, Trash2, X, LayoutList, FileText, User, Lock, ChevronDown, Edit3, ArrowRight, AlertCircle } from "lucide-react"
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
import { format, parseISO, startOfMonth, endOfMonth, isWithinInterval, isValid } from "date-fns"
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

  const [isCorrectionOpen, setIsCorrectionOpen] = useState(false)
  const [paymentToCorrect, setPaymentToCorrect] = useState<any>(null)
  const [correctionData, setCorrectionData] = useState({
    memberId: "",
    amount: 0,
    type: "wrong-amount"
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

  const cyclesQuery = useMemoFirebase(() => collection(db, 'cycles'), [db]);
  const { data: allCycles } = useCollection(cyclesQuery);

  const heartsQuery = useMemoFirebase(() => collection(db, 'monthLocks'), [db]);
  const { data: monthLocks } = useCollection(heartsQuery);

  const getPAmount = (p: any) => Number(p.amountPaid || p.amount || 0);
  const getPDateStr = (p: any) => {
    if (p.targetDate) return p.targetDate;
    const d = p.paymentDate?.toDate ? p.paymentDate.toDate() : (p.paymentDate ? new Date(p.paymentDate) : null);
    if (d && !isNaN(d.getTime())) return d.toISOString().split('T')[0];
    return null;
  }

  const totalPaidByMember = useMemo(() => {
    const map = new Map<string, number>();
    if (!allCycles || !members) return map;
    payments.forEach(p => {
      if (p.status === 'paid' || p.status === 'success' || !p.status) {
        const member = members.find(m => m.id === p.memberId);
        if (!member) return;
        const activeCycle = (allCycles || []).find(c => c.name === member.chitGroup && c.status === 'active');
        if (!activeCycle) return;
        const pDate = getPDateStr(p);
        if (pDate && pDate >= activeCycle.startDate && pDate <= activeCycle.endDate) {
          const current = map.get(p.memberId) || 0;
          map.set(p.memberId, current + getPAmount(p));
        }
      }
    });
    return map;
  }, [payments, members, allCycles]);

  const handleCorrectPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !paymentToCorrect || isActionPending) return;

    setIsActionPending(true);
    try {
      const batch = writeBatch(db);
      const originalPaymentRef = doc(db, 'payments', paymentToCorrect.id);
      const oldMember = members.find(m => m.id === paymentToCorrect.memberId);
      const oldAmount = getPAmount(paymentToCorrect);
      
      if (correctionData.type === 'wrong-amount') {
        const newAmount = Number(correctionData.amount);
        batch.update(originalPaymentRef, { amountPaid: newAmount });
        if (oldMember) {
          const diff = newAmount - oldAmount;
          batch.update(doc(db, 'members', oldMember.id), { 
            totalPaid: (oldMember.totalPaid || 0) + diff 
          });
        }
        await createAuditLog(db, user, `Correction (Wrong Amount): Updated ${paymentToCorrect.memberName} payment from ₹${oldAmount} to ₹${newAmount}`);
      } 
      else if (correctionData.type === 'wrong-member') {
        const newMember = members.find(m => m.id === correctionData.memberId);
        if (!newMember) throw new Error("Please select a valid member.");
        
        // Remove from old
        batch.delete(originalPaymentRef);
        if (oldMember) {
          batch.update(doc(db, 'members', oldMember.id), { 
            totalPaid: Math.max(0, (oldMember.totalPaid || 0) - oldAmount) 
          });
        }
        
        // Add to new
        const newPaymentRef = doc(collection(db, 'payments'));
        const pDateStr = getPDateStr(paymentToCorrect) || format(new Date(), 'yyyy-MM-dd');
        batch.set(newPaymentRef, {
          id: newPaymentRef.id,
          memberId: newMember.id,
          memberName: newMember.name,
          month: paymentToCorrect.month || format(parseISO(pDateStr), 'MMMM yyyy'),
          targetDate: pDateStr,
          amountPaid: oldAmount,
          paymentDate: paymentToCorrect.paymentDate || new Date().toISOString(),
          status: "success",
          method: paymentToCorrect.method || "Cash",
          createdAt: serverTimestamp()
        });
        batch.update(doc(db, 'members', newMember.id), {
          totalPaid: (newMember.totalPaid || 0) + oldAmount
        });
        await createAuditLog(db, user, `Correction (Wrong Member): Moved ₹${oldAmount} from ${paymentToCorrect.memberName} to ${newMember.name}`);
      } 
      else if (correctionData.type === 'duplicate') {
        batch.delete(originalPaymentRef);
        if (oldMember) {
          batch.update(doc(db, 'members', oldMember.id), { 
            totalPaid: Math.max(0, (oldMember.totalPaid || 0) - oldAmount) 
          });
        }
        await createAuditLog(db, user, `Correction (Duplicate): Deleted ₹${oldAmount} entry for ${paymentToCorrect.memberName}`);
      }

      await withTimeout(batch.commit());
      setIsCorrectionOpen(false); 
      setPaymentToCorrect(null); 
      toast({ title: "Payment Corrected", description: "Ledger updated successfully." });
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
    if (isLocked) { toast({ variant: "destructive", title: "Locked", description: "Cannot delete record from a locked month." }); return; }
    setIsActionPending(true)
    try {
      const member = members.find(m => m.id === paymentToDelete.memberId);
      if (member) { const memberRef = doc(db, 'members', member.id); await withTimeout(updateDoc(memberRef, { totalPaid: Math.max(0, (member.totalPaid || 0) - getPAmount(paymentToDelete)) })); }
      await withTimeout(deleteDoc(doc(db, 'payments', paymentToDelete.id)));
      await createAuditLog(db, user, `Deleted payment record of ₹${getPAmount(paymentToDelete)} for ${paymentToDelete.memberName}`);
      setIsDeletePaymentDialogOpen(false); setPaymentToDelete(null); toast({ title: "Record Deleted", description: "Payment removed successfully." });
    } catch (error: any) { toast({ variant: "destructive", title: "Error", description: error.message || "Failed to delete record." }); } finally { setIsActionPending(false); }
  }

  const filteredPayments = useMemo(() => {
    if (!allCycles || !members) return [];
    let list = payments.filter(p => p.status === 'paid' || p.status === 'success' || p.status === 'corrected' || !p.status);
    
    // CYCLE ISOLATION
    list = list.filter(p => {
      const member = members.find(m => m.id === p.memberId);
      if (!member) return false;
      const activeCycle = (allCycles || []).find(c => c.name === member.chitGroup && c.status === 'active');
      if (!activeCycle) return false;
      const pDate = getPDateStr(p);
      return pDate && pDate >= activeCycle.startDate && pDate <= activeCycle.endDate;
    });

    if (searchTerm) list = list.filter(p => p.memberName?.toLowerCase().includes(searchTerm.toLowerCase()));
    if (typeFilter !== "all") {
      list = list.filter(p => {
        const member = members.find(m => m.id === p.memberId);
        const round = rounds.find(r => r.name === member?.chitGroup);
        return (round?.collectionType || "Monthly").toLowerCase() === typeFilter;
      });
    }
    return list;
  }, [payments, searchTerm, typeFilter, members, rounds, allCycles]);

  const visiblePayments = useMemo(() => filteredPayments.slice(0, historyLimit), [filteredPayments, historyLimit]);

  const memberSummaries = useMemo(() => {
    if (!allCycles || !members) return [];
    const now = new Date();
    const todayStr = format(now, 'yyyy-MM-dd');

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
        const activeCycle = (allCycles || []).find(c => c.name === member.chitGroup && c.status === 'active');
        const memberPayments = payments.filter(p => p.memberId === member.id);
        
        const amountPaidInCycle = !activeCycle ? 0 : memberPayments
          .filter(p => {
            if (!(p.status === 'paid' || p.status === 'success' || !p.status)) return false;
            const pDate = getPDateStr(p);
            return pDate && pDate >= activeCycle.startDate && pDate <= activeCycle.endDate;
          })
          .reduce((acc, p) => acc + getPAmount(p), 0);

        const hasPaidToday = memberPayments.some(p => 
          (p.status === 'paid' || p.status === 'success' || !p.status) && 
          getPDateStr(p) === todayStr
        );
        
        return { id: member.id, name: member.name, chitName: member.chitGroup || "N/A", totalAmount: member.monthlyAmount || 0, amountPaid: amountPaidInCycle, status: hasPaidToday ? "Paid" : "Unpaid" };
      });
  }, [members, payments, rounds, searchTerm, typeFilter, allCycles]);

  const visibleSummaries = useMemo(() => memberSummaries.slice(0, summaryLimit), [memberSummaries, summaryLimit]);

  const openAuditProfile = (memberId: string) => { const member = members.find(m => m.id === memberId); if (member) { setSelectedAuditMember(member); setIsAuditProfileOpen(true); } }

  if (isRoleLoading) return (<div className="flex min-h-[400px] items-center justify-center"><Loader2 className="size-8 animate-spin text-primary" /></div>)

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-500 pb-10 overflow-x-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-2xl sm:text-3xl font-headline font-bold tracking-tight text-primary">Financial Ledger</h2>
          <p className="text-sm sm:text-base text-muted-foreground">Manage cycle-isolated reservation transactions.</p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row items-stretch md:items-center gap-4 bg-card p-3 sm:p-4 rounded-xl shadow-sm border border-border/50">
        <div className="flex items-center flex-1 gap-2"><Search className="size-4 sm:size-5 text-muted-foreground shrink-0" /><Input placeholder="Search member in active cycle..." value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setHistoryLimit(PAGE_SIZE); setSummaryLimit(PAGE_SIZE); }} className="border-none focus-visible:ring-0 shadow-none bg-transparent h-8 text-sm" /></div>
        <div className="flex items-center gap-2 border-t md:border-t-0 md:border-l pt-3 md:pt-0 md:pl-4"><Select value={typeFilter} onValueChange={setTypeFilter}><SelectTrigger className="w-full md:w-[110px] h-8 bg-muted/30 border-none text-xs font-bold uppercase tracking-tight"><SelectValue placeholder="Type" /></SelectTrigger><SelectContent><SelectItem value="all">All Schemes</SelectItem><SelectItem value="daily">Daily</SelectItem><SelectItem value="monthly">Monthly</SelectItem></SelectContent></Select></div>
      </div>

      <Tabs defaultValue="history" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-[320px] h-9 p-1 bg-muted/50 border mb-6"><TabsTrigger value="history" className="text-[10px] sm:text-xs font-bold uppercase tracking-wider gap-2"><LayoutList className="size-3.5" />History</TabsTrigger><TabsTrigger value="summary" className="text-[10px] sm:text-xs font-bold uppercase tracking-wider gap-2"><FileText className="size-3.5" />Summary</TabsTrigger></TabsList>
        <TabsContent value="history" className="mt-0">
          <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow><TableHead className="font-bold text-xs uppercase tracking-wider">Date</TableHead><TableHead className="font-bold text-xs uppercase tracking-wider">Member</TableHead><TableHead className="font-bold text-xs uppercase tracking-wider">Amount (₹)</TableHead><TableHead className="font-bold text-xs uppercase tracking-wider hidden md:table-cell">Status</TableHead><TableHead className="w-[50px]"></TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {isPaymentsLoading ? (
                    <TableRow><TableCell colSpan={5} className="h-32 text-center text-muted-foreground animate-pulse">Loading active history...</TableCell></TableRow>
                  ) : visiblePayments.length > 0 ? (
                    visiblePayments.map((p) => {
                      const pDateStr = getPDateStr(p) || "-";
                      const [m, y] = p.month ? p.month.split(' ') : [format(new Date(), 'MMMM'), format(new Date(), 'yyyy')];
                      const isLocked = monthLocks?.some(l => l.year === y && l.monthName === m);
                      const isCorrected = p.status === 'corrected';
                      const pAmt = getPAmount(p);
                      return (
                        <TableRow key={p.id} className={cn("hover:bg-muted/10 transition-colors", isCorrected && "opacity-60 bg-muted/5")}>
                          <TableCell className="text-[10px] sm:text-xs font-medium tabular-nums text-muted-foreground"><div className="flex items-center gap-1.5">{isLocked && <Lock className="size-2.5 text-amber-600" title="Month Locked" />}{pDateStr}</div></TableCell>
                          <TableCell className={cn("font-semibold text-xs sm:text-sm", isCorrected && "line-through")}><button onClick={() => openAuditProfile(p.memberId)} className="hover:text-primary hover:underline transition-all text-left">{p.memberName}</button></TableCell>
                          <TableCell className={cn("font-bold text-xs sm:text-sm tabular-nums", isCorrected ? "text-muted-foreground" : "text-emerald-600")}>₹{pAmt.toLocaleString()}</TableCell>
                          <TableCell className="hidden md:table-cell"><Badge variant={isCorrected ? "secondary" : "outline"} className={cn("text-[8px] uppercase font-bold", isCorrected ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700 border-emerald-200")}>{isCorrected ? "Corrected" : "Paid"}</Badge></TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7" disabled={isActionPending}><MoreHorizontal className="size-4" /></Button></DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-44">
                                <DropdownMenuItem onSelect={() => { if (!isActionPending) { setHistoryMember(p); setIsHistoryOpen(true); } }}><History className="mr-2 size-4" /> Cycle History</DropdownMenuItem>
                                {!isCorrected && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onSelect={() => { 
                                      if (!isActionPending) { 
                                        setPaymentToCorrect(p); 
                                        setCorrectionData({ 
                                          memberId: p.memberId, 
                                          amount: pAmt, 
                                          type: "wrong-amount" 
                                        }); 
                                        setIsCorrectionOpen(true); 
                                      } 
                                    }}>
                                      <Edit3 className="mr-2 size-4 text-primary" /> Correct Payment
                                    </DropdownMenuItem>
                                  </>
                                )}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem disabled={isLocked || isActionPending} className={cn("text-destructive focus:bg-destructive/10 focus:text-destructive", (isLocked || isCorrected) && "opacity-50 pointer-events-none")} onSelect={() => { if (!isActionPending) { setPaymentToDelete(p); setIsDeletePaymentDialogOpen(true); } }}><Trash2 className="mr-2 size-4" /> Delete Record</DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      )
                    })
                  ) : (<TableRow><TableCell colSpan={5} className="h-32 text-center text-muted-foreground italic text-xs">No active cycle records matching search.</TableCell></TableRow>)}
                </TableBody>
              </Table>
            </div>
            {filteredPayments.length > historyLimit && (<div className="p-4 border-t flex justify-center"><Button variant="ghost" size="sm" onClick={() => setHistoryLimit(prev => prev + PAGE_SIZE)} className="text-xs font-bold uppercase tracking-widest gap-2"><ChevronDown className="size-4" /> Load More History</Button></div>)}
          </div>
        </TabsContent>
        <TabsContent value="summary" className="mt-0">
          <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/30"><TableRow><TableHead className="font-bold text-xs uppercase tracking-wider">Member</TableHead><TableHead className="font-bold text-xs uppercase tracking-wider text-right">Paid (Cycle)</TableHead><TableHead className="font-bold text-xs uppercase tracking-wider text-center">Status (Today)</TableHead></TableRow></TableHeader>
                <TableBody>
                  {isMembersLoading ? (
                    <TableRow><TableCell colSpan={5} className="h-32 text-center text-muted-foreground animate-pulse">Calculating summary...</TableCell></TableRow>
                  ) : visibleSummaries.length > 0 ? (
                    visibleSummaries.map((s) => (
                      <TableRow key={s.id} className="hover:bg-muted/10 transition-colors">
                        <TableCell className="font-semibold text-xs sm:text-sm">{s.name}</TableCell>
                        <TableCell className="text-right text-xs font-bold text-emerald-600 tabular-nums">₹{s.amountPaid.toLocaleString()}</TableCell>
                        <TableCell className="text-center"><Badge variant={s.status === 'Paid' ? 'default' : 'secondary'} className={cn("text-[8px] sm:text-[9px] font-bold uppercase px-2", s.status === 'Paid' ? "bg-emerald-500" : "bg-amber-100 text-amber-700")}>{s.status}</Badge></TableCell>
                      </TableRow>
                    ))
                  ) : (<TableRow><TableCell colSpan={4} className="h-32 text-center text-muted-foreground italic text-xs">No active members found.</TableCell></TableRow>)}
                </TableBody>
              </Table>
            </div>
            {memberSummaries.length > summaryLimit && (<div className="p-4 border-t flex justify-center"><Button variant="ghost" size="sm" onClick={() => setSummaryLimit(prev => prev + PAGE_SIZE)} className="text-xs font-bold uppercase tracking-widest gap-2"><ChevronDown className="size-4" /> Load More Summaries</Button></div>)}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={isCorrectionOpen} onOpenChange={(o) => { if(!isActionPending) { setIsCorrectionOpen(o); if(!o) setPaymentToCorrect(null); } }}>
        <DialogContent className="sm:max-w-[450px]">
          {paymentToCorrect && (
            <form onSubmit={handleCorrectPayment} className="space-y-6">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2"><Edit3 className="size-5 text-primary" /> Payment Correction</DialogTitle>
                <DialogDescription>Select the correction type and update the details.</DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4">
                <div className="p-3 bg-muted/30 rounded-lg space-y-2">
                  <Label className="text-[10px] font-bold uppercase text-muted-foreground">Original Record</Label>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold">{paymentToCorrect.memberName}</span>
                    <span className="font-bold text-emerald-600">₹{getPAmount(paymentToCorrect).toLocaleString()}</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground">{getPDateStr(paymentToCorrect) || "No target date"}</div>
                </div>

                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <Label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">Correction Type</Label>
                    <Select 
                      value={correctionData.type} 
                      onValueChange={(v) => setCorrectionData({...correctionData, type: v})}
                      disabled={isActionPending}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="wrong-amount">Wrong Amount</SelectItem>
                        <SelectItem value="wrong-member">Wrong Member</SelectItem>
                        <SelectItem value="duplicate">Duplicate Entry</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {correctionData.type === 'wrong-amount' && (
                    <div className="grid gap-2 animate-in fade-in slide-in-from-top-1">
                      <Label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">Correct Amount (₹)</Label>
                      <Input 
                        type="number" 
                        value={correctionData.amount || ""} 
                        onChange={e => setCorrectionData({...correctionData, amount: Number(e.target.value)})} 
                        required 
                        disabled={isActionPending} 
                      />
                    </div>
                  )}

                  {correctionData.type === 'wrong-member' && (
                    <div className="grid gap-2 animate-in fade-in slide-in-from-top-1">
                      <Label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">Correct Member</Label>
                      <Select 
                        value={correctionData.memberId} 
                        onValueChange={(v) => setCorrectionData({...correctionData, memberId: v})} 
                        disabled={isActionPending}
                      >
                        <SelectTrigger><SelectValue placeholder="Select member" /></SelectTrigger>
                        <SelectContent>
                          {members.filter(m => m.status !== 'inactive').map(m => (
                            <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {correctionData.type === 'duplicate' && (
                    <div className="p-4 bg-destructive/5 border border-destructive/20 rounded-xl flex items-start gap-3 animate-in fade-in slide-in-from-top-1">
                      <AlertCircle className="size-5 text-destructive shrink-0 mt-0.5" />
                      <p className="text-xs text-destructive font-medium leading-relaxed">
                        Choosing "Duplicate Entry" will permanently delete this payment record and update the member's balance. This action is not reversible.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <DialogFooter className="gap-2">
                <Button variant="outline" type="button" onClick={() => setIsCorrectionOpen(false)} disabled={isActionPending} className="w-full sm:w-auto">Cancel</Button>
                <Button 
                  type="submit" 
                  disabled={isActionPending} 
                  className={cn(
                    "w-full sm:w-auto font-bold gap-2",
                    correctionData.type === 'duplicate' ? "bg-destructive hover:bg-destructive/90" : ""
                  )}
                >
                  {isActionPending ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                  {correctionData.type === 'duplicate' ? 'Confirm Deletion' : 'Apply Correction'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isAuditProfileOpen} onOpenChange={setIsAuditProfileOpen}>
        <DialogContent className="sm:max-w-[400px]"><DialogHeader><DialogTitle className="flex items-center gap-2"><User className="size-5 text-primary" /> Member Profile</DialogTitle></DialogHeader>{selectedAuditMember && (<div className="space-y-4 py-4"><div className="flex justify-between items-center p-3 bg-muted/30 rounded-lg"><span className="text-xs font-bold uppercase text-muted-foreground">Name</span><span className="font-bold text-sm">{selectedAuditMember.name}</span></div><div className="flex justify-between items-center p-3 bg-muted/30 rounded-lg"><span className="text-xs font-bold uppercase text-muted-foreground">Status</span><Badge variant={selectedAuditMember.status === 'active' ? 'default' : 'secondary'} className="uppercase font-bold text-[9px]">{selectedAuditMember.status}</Badge></div><div className="flex justify-between items-center p-3 bg-emerald-50 rounded-lg"><span className="text-xs font-bold uppercase text-emerald-600">Cycle Contribution</span><span className="font-bold text-sm text-emerald-700">₹{(totalPaidByMember.get(selectedAuditMember.id) || 0).toLocaleString()}</span></div>{selectedAuditMember.status === 'inactive' ? (<div className="p-4 border border-destructive/20 bg-destructive/5 rounded-lg space-y-2"><span className="text-[10px] font-bold uppercase text-destructive tracking-widest block">Active Period</span><div className="flex items-center gap-2 font-bold text-sm text-foreground">{selectedAuditMember.joinDate ? format(parseISO(selectedAuditMember.joinDate), 'MMM dd, yyyy') : '-'}<span className="text-muted-foreground">→</span>{selectedAuditMember.deactivatedAt ? format(parseISO(selectedAuditMember.deactivatedAt), 'MMM dd, yyyy') : '-'}</div></div>) : (<div className="flex justify-between items-center p-3 bg-muted/30 rounded-lg"><span className="text-xs font-bold uppercase text-muted-foreground">Joined Date</span><span className="font-bold text-sm">{selectedAuditMember.joinDate ? format(parseISO(selectedAuditMember.joinDate), 'MMM dd, yyyy') : '-'}</span></div>)}</div>)}<DialogFooter><Button onClick={() => setIsAuditProfileOpen(false)} className="w-full sm:w-auto font-bold uppercase text-[10px] tracking-widest">Close</Button></DialogFooter></DialogContent>
      </Dialog>

      <Dialog open={isHistoryOpen} onOpenChange={(open) => { setIsHistoryOpen(open); if (!open) setHistoryMember(null) }}>
        <DialogContent className="sm:max-w-[500px]">
          {isHistoryOpen && (
            <>
              <DialogHeader><DialogTitle className="text-xl">Cycle History: {historyMember?.memberName}</DialogTitle></DialogHeader>
              <div className="py-4">
                <Table>
                  <TableHeader><TableRow><TableHead className="text-xs uppercase font-bold text-muted-foreground">Period</TableHead><TableHead className="text-xs uppercase font-bold text-muted-foreground">Paid</TableHead><TableHead className="text-right text-xs uppercase font-bold text-muted-foreground">Date</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {payments.filter(p => {
                      if (p.memberId !== historyMember?.memberId || !(p.status === 'paid' || p.status === 'success' || !p.status)) return false;
                      const member = members.find(m => m.id === p.memberId);
                      if (!member) return false;
                      const activeCycle = (allCycles || []).find(c => c.name === member.chitGroup && c.status === 'active');
                      if (!activeCycle) return false;
                      const pDate = getPDateStr(p);
                      return pDate && pDate >= activeCycle.startDate && pDate <= activeCycle.endDate;
                    }).map((e, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-sm font-semibold">{e.month || 'Current Cycle'}</TableCell>
                        <TableCell className="text-sm font-bold text-emerald-600">₹{getPAmount(e).toLocaleString()}</TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground font-medium">{getPDateStr(e) || "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <DialogFooter><Button className="w-full sm:w-auto font-bold" onClick={() => setIsHistoryOpen(false)}>Close</Button></DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeletePaymentDialogOpen} onOpenChange={(open) => { if (!isActionPending) { setIsDeletePaymentDialogOpen(open); if (!open) setPaymentToDelete(null) } }}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle className="text-destructive">Delete Transaction?</AlertDialogTitle><AlertDialogDescription>Permanently remove this payment of <strong>₹{getPAmount(paymentToDelete || {}).toLocaleString()}</strong>? This cannot be undone.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={isActionPending}>Cancel</AlertDialogCancel><AlertDialogAction className="bg-destructive hover:bg-destructive/90 font-bold" onClick={handleDeletePayment} disabled={isActionPending}>{isActionPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
