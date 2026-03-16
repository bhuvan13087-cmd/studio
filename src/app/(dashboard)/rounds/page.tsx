
"use client"

import { useState, useEffect, useMemo } from "react"
import { History, Plus, Users, MoreVertical, ChevronLeft, Loader2, Pencil, Trash2, IndianRupee, CalendarDays, UserPlus, CheckCircle2, User, Info, Save, X, Clock, AlertCircle, PlusCircle, Calendar } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { useFirestore, useCollection, useMemoFirebase, useUser } from "@/firebase"
import { collection, query, doc, serverTimestamp, orderBy, updateDoc, deleteDoc, writeBatch } from "firebase/firestore"
import { addDocumentNonBlocking } from "@/firebase/non-blocking-updates"
import { useRole } from "@/hooks/use-role"
import { format, parseISO, isSameMonth, startOfDay } from "date-fns"
import { cn, withTimeout } from "@/lib/utils"
import { createAuditLog } from "@/firebase/logging"

const INITIAL_CHIT_STATE = { 
  name: "", 
  monthlyAmount: 0, 
  totalMembers: 0, 
  startDate: new Date().toISOString().split('T')[0], 
  collectionType: "" 
}

const INITIAL_MEMBER_STATE = {
  name: "",
  phone: "",
  joinDate: new Date().toISOString().split('T')[0],
  paymentType: ""
}

const INITIAL_PAYMENT_STATE = {
  method: "Cash",
  amount: 0
}

const INITIAL_PENDING_STATE = {
  date: new Date().toISOString().split('T')[0],
  amount: 0
}

export default function RoundsPage() {
  const [selectedChitId, setSelectedChitId] = useState<string | null>(null)
  const [isAddChitDialogOpen, setIsAddChitDialogOpen] = useState(false)
  const [isEditChitDialogOpen, setIsEditChitDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false)
  const [isAddMemberDialogOpen, setIsAddMemberDialogOpen] = useState(false)
  const [isQuickPaymentDialogOpen, setIsQuickPaymentDialogOpen] = useState(false)
  const [isMemberProfileDialogOpen, setIsMemberProfileDialogOpen] = useState(false)
  const [isEditingProfile, setIsEditingProfile] = useState(false)
  const [isActionPending, setIsActionPending] = useState(false)
  const [isAddPendingMode, setIsAddPendingMode] = useState(false)
  
  const [editingChit, setEditingChit] = useState<any>(null)
  const [chitToDelete, setChitToDelete] = useState<any>(null)
  const [historyMember, setHistoryMember] = useState<any>(null)
  const [selectedMemberForPayment, setSelectedMemberForPayment] = useState<any>(null)
  const [selectedProfileMember, setSelectedProfileMember] = useState<any>(null)
  const [editFormData, setEditFormData] = useState<any>(null)
  const [newMember, setNewMember] = useState(INITIAL_MEMBER_STATE)
  const [paymentData, setPaymentData] = useState(INITIAL_PAYMENT_STATE)
  const [pendingFormData, setPendingFormData] = useState(INITIAL_PENDING_STATE)
  
  const { toast } = useToast()
  const db = useFirestore()
  const { user } = useUser()
  const { isAdmin, isLoading: isRoleLoading } = useRole()

  const roundsQuery = useMemoFirebase(() => query(collection(db, 'chitRounds'), orderBy('createdAt', 'desc')), [db]);
  const { data: roundsData, isLoading: isRoundsLoading } = useCollection(roundsQuery);
  const chitSchemes = roundsData || [];

  const membersQuery = useMemoFirebase(() => query(collection(db, 'members'), orderBy('name', 'asc')), [db]);
  const { data: members } = useCollection(membersQuery);

  const paymentsQuery = useMemoFirebase(() => query(collection(db, 'payments'), orderBy('paymentDate', 'desc')), [db]);
  const { data: allPayments } = useCollection(paymentsQuery);

  const [newChit, setNewChit] = useState(INITIAL_CHIT_STATE)

  useEffect(() => {
    const recoveryInterval = setInterval(() => {
      if (document.body.style.pointerEvents === 'none') {
        document.body.style.pointerEvents = 'auto'
        document.body.style.overflow = 'auto'
      }
    }, 1000)
    return () => clearInterval(recoveryInterval)
  }, [])

  const currentRound = useMemo(() => chitSchemes.find(r => r.id === selectedChitId), [chitSchemes, selectedChitId])
  const assignedMembers = useMemo(() => (members || []).filter(m => m.status !== 'inactive' && m.chitGroup === currentRound?.name), [members, currentRound])

  const analyzePaymentStatus = (member: any) => {
    if (!member || !allPayments) return { amount: 0, paid: false, pendingTotal: 0, pendingRecords: [] };
    
    const todayStr = format(new Date(), 'yyyy-MM-dd');

    const memberPayments = (allPayments || []).filter(p => p.memberId === member.id);
    
    const paidToday = memberPayments.some(p => 
      (p.status === 'success' || p.status === 'paid') &&
      p.paymentDate &&
      format(parseISO(p.paymentDate), 'yyyy-MM-dd') === todayStr
    );

    const pendingRecords = memberPayments.filter(p => p.status === 'pending');
    const pendingTotal = pendingRecords.reduce((acc, p) => acc + (p.amountPaid || 0), 0);

    return { 
      amount: 0, 
      paid: paidToday,
      pendingTotal,
      pendingRecords
    };
  };

  useEffect(() => {
    if (isAddMemberDialogOpen && currentRound) {
      setNewMember(prev => ({ ...prev, paymentType: currentRound.collectionType }));
    }
  }, [isAddMemberDialogOpen, currentRound]);

  const handleAddChit = async (e: React.FormEvent) => {
    e.preventDefault(); 
    if (!db || isActionPending) return;
    
    if (!newChit.collectionType) {
      toast({ variant: "destructive", title: "Selection Required", description: "Please select a collection type." });
      return;
    }

    setIsActionPending(true);
    try {
      await withTimeout(addDocumentNonBlocking(collection(db, 'chitRounds'), {
        ...newChit,
        monthlyAmount: Number(newChit.monthlyAmount),
        totalMembers: Number(newChit.totalMembers),
        createdAt: serverTimestamp()
      }));
      await createAuditLog(db, user, `Created new scheme: ${newChit.name}`)
      setIsAddChitDialogOpen(false); 
      setNewChit(INITIAL_CHIT_STATE);
      toast({ title: "Scheme Created", description: "The scheme has been added to the registry." });
    } catch (e: any) { 
      toast({ variant: "destructive", title: "Error", description: e.message || "Failed to create scheme." }); 
    } finally { 
      setIsActionPending(false); 
    }
  }

  const handleAddMemberToScheme = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !currentRound || isActionPending) return;

    setIsActionPending(true);
    try {
      await withTimeout(addDocumentNonBlocking(collection(db, 'members'), {
        ...newMember,
        chitGroup: currentRound.name,
        monthlyAmount: currentRound.monthlyAmount,
        status: "active",
        totalPaid: 0,
        createdAt: serverTimestamp(),
      }));
      
      await createAuditLog(db, user, `Registered ${newMember.name} to scheme ${currentRound.name}`);
      
      setIsAddMemberDialogOpen(false);
      setNewMember(INITIAL_MEMBER_STATE);
      toast({ title: "Member Registered", description: `${newMember.name} joined ${currentRound.name}.` });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message || "Failed to register member." });
    } finally {
      setIsActionPending(false);
    }
  }

  const handleSaveMemberEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !selectedProfileMember || !editFormData || isActionPending) return;

    setIsActionPending(true);
    try {
      const memberRef = doc(db, 'members', selectedProfileMember.id);
      await withTimeout(updateDoc(memberRef, {
        name: editFormData.name,
        phone: editFormData.phone,
        paymentType: editFormData.paymentType,
        joinDate: editFormData.joinDate
      }));

      await createAuditLog(db, user, `Updated profile for member: ${editFormData.name}`);
      
      toast({ title: "Profile Updated", description: "Member details have been saved." });
      setIsEditingProfile(false);
      setSelectedProfileMember({ ...selectedProfileMember, ...editFormData });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message || "Failed to update profile." });
    } finally {
      setIsActionPending(false);
    }
  }

  const handleQuickPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !selectedMemberForPayment || !currentRound || isActionPending) return;

    const amountToSave = Number(paymentData.amount);
    setIsActionPending(true);
    const currentMonth = format(new Date(), 'MMMM yyyy');
    const todayStr = format(new Date(), 'yyyy-MM-dd');

    try {
      const batch = writeBatch(db);
      
      // 1. Record the success payment
      const paymentRef = doc(collection(db, 'payments'));
      batch.set(paymentRef, {
        id: paymentRef.id,
        memberId: selectedMemberForPayment.id,
        memberName: selectedMemberForPayment.name,
        month: currentMonth,
        targetDate: todayStr,
        amountPaid: amountToSave,
        paymentDate: new Date().toISOString(),
        status: "success",
        method: paymentData.method,
        createdAt: serverTimestamp()
      });

      // 2. Clear all pending entries for this member automatically
      const { pendingRecords } = analyzePaymentStatus(selectedMemberForPayment);
      pendingRecords.forEach(p => {
        const pRef = doc(db, 'payments', p.id);
        batch.update(pRef, { status: "paid" });
      });

      // 3. Update member's total paid
      const memberRef = doc(db, 'members', selectedMemberForPayment.id);
      batch.update(memberRef, {
        totalPaid: (selectedMemberForPayment.totalPaid || 0) + amountToSave
      });

      await withTimeout(batch.commit());
      await createAuditLog(db, user, `Recorded Payment ₹${amountToSave} and cleared pending for ${selectedMemberForPayment.name}`);

      setIsQuickPaymentDialogOpen(false);
      setSelectedMemberForPayment(null);
      setPaymentData(INITIAL_PAYMENT_STATE);
      toast({ title: "Payment Recorded", description: "Ledger updated and pending cleared." });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message || "Failed to record payment." });
    } finally {
      setIsActionPending(false);
    }
  }

  const handleAddPending = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !selectedMemberForPayment || isActionPending) return;

    setIsActionPending(true);
    const amount = Number(pendingFormData.amount);
    const month = format(parseISO(pendingFormData.date), 'MMMM yyyy');

    try {
      const paymentRef = doc(collection(db, 'payments'));
      await withTimeout(addDocumentNonBlocking(collection(db, 'payments'), {
        id: paymentRef.id,
        memberId: selectedMemberForPayment.id,
        memberName: selectedMemberForPayment.name,
        month: month,
        targetDate: pendingFormData.date,
        amountPaid: amount,
        paymentDate: new Date().toISOString(),
        status: "pending",
        method: "Manual Entry",
        createdAt: serverTimestamp()
      }));

      await createAuditLog(db, user, `Added Manual Pending ₹${amount} for ${selectedMemberForPayment.name} on ${pendingFormData.date}`);
      
      setIsAddPendingMode(false);
      setPendingFormData(INITIAL_PENDING_STATE);
      toast({ title: "Pending Added", description: "Record stored in system database." });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message || "Failed to add pending." });
    } finally {
      setIsActionPending(false);
    }
  }

  const handleEditChit = async (e: React.FormEvent) => {
    e.preventDefault(); 
    if (!db || !editingChit || isActionPending) return;
    
    setIsActionPending(true);
    try {
      const chitRef = doc(db, 'chitRounds', editingChit.id);
      await withTimeout(updateDoc(chitRef, {
        name: editingChit.name,
        monthlyAmount: Number(editingChit.monthlyAmount),
        totalMembers: Number(editingChit.totalMembers),
        collectionType: editingChit.collectionType,
        startDate: editingChit.startDate
      }));
      await createAuditLog(db, user, `Updated scheme details: ${editingChit.name}`)
      setIsEditChitDialogOpen(false);
      setEditingChit(null)
      toast({ title: "Scheme Updated", description: "Details saved successfully." });
    } catch (e: any) { 
      toast({ variant: "destructive", title: "Error", description: e.message || "Failed to update scheme." }); 
    } finally { 
      setIsActionPending(false); 
    }
  }

  const confirmDelete = async () => {
    if (!db || !chitToDelete || isActionPending) return;
    
    setIsActionPending(true);
    try { 
      await withTimeout(deleteDoc(doc(db, 'chitRounds', chitToDelete.id))); 
      await createAuditLog(db, user, `Deleted scheme: ${chitToDelete.name}`)
      toast({ title: "Scheme Deleted", description: "The scheme record has been removed." }); 
      setIsDeleteDialogOpen(false); 
      setChitToDelete(null)
    } catch (e: any) { 
      toast({ variant: "destructive", title: "Error", description: e.message || "Failed to delete scheme." }); 
    } finally { 
      setIsActionPending(false); 
    }
  }

  const getMonthlyCollectionForScheme = useMemo(() => (schemeName: string) => {
    if (!allPayments || !members) return 0;
    const now = new Date();
    const schemeMembers = members.filter(m => m.chitGroup === schemeName);
    const memberIds = new Set(schemeMembers.map(m => m.id));
    
    return allPayments
      .filter(p => 
        memberIds.has(p.memberId) && 
        (p.status === 'paid' || p.status === 'success') &&
        p.paymentDate && 
        isSameMonth(parseISO(p.paymentDate), now)
      )
      .reduce((acc, p) => acc + (p.amountPaid || 0), 0);
  }, [allPayments, members]);

  const todayCollection = useMemo(() => {
    if (!allPayments || !assignedMembers.length) return 0;
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const assignedMemberIds = new Set(assignedMembers.map(m => m.id));

    return allPayments
      .filter(p => 
        assignedMemberIds.has(p.memberId) && 
        (p.status === 'paid' || p.status === 'success') &&
        p.paymentDate && 
        format(parseISO(p.paymentDate), 'yyyy-MM-dd') === todayStr
      )
      .reduce((acc, p) => acc + (p.amountPaid || 0), 0);
  }, [allPayments, assignedMembers]);

  if (isRoleLoading || isRoundsLoading) return (<div className="flex h-[60vh] items-center justify-center"><Loader2 className="size-8 animate-spin text-primary" /></div>)

  if (!selectedChitId) {
    return (
      <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-500 pb-10 overflow-x-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-2xl sm:text-3xl font-headline font-bold tracking-tight text-primary">Seat Reservations</h2>
            <p className="text-sm text-muted-foreground">Manage active fund schemes and seat availability.</p>
          </div>
          <Button className="h-10 sm:h-11 shadow-lg w-full sm:w-auto font-bold" onClick={() => setIsAddChitDialogOpen(true)} disabled={isActionPending}>
            <Plus className="mr-2 size-5" /> Add Scheme
          </Button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {chitSchemes.map((group) => {
            const monthlyColl = getMonthlyCollectionForScheme(group.name);
            const pendingCount = (members || []).filter(m => {
              if (m.status === 'inactive' || m.chitGroup !== group.name) return false;
              const { paid } = analyzePaymentStatus(m);
              return !paid;
            }).length;

            return (
              <Card key={group.id} className="hover:shadow-md transition-all border-border/50 overflow-hidden flex flex-col">
                <CardHeader className="bg-muted/20 p-4 space-y-2">
                  <div className="flex justify-between items-start">
                    <Badge variant="outline" className="text-[10px] font-bold uppercase">{group.collectionType}</Badge>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7" disabled={isActionPending}>
                          <MoreVertical className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuItem onSelect={() => { if(!isActionPending) { setEditingChit({...group}); setIsEditChitDialogOpen(true); } }}>
                          <Pencil className="mr-2 size-3.5" /> Edit Details
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive focus:bg-destructive/10 focus:text-destructive" onSelect={() => { if(!isActionPending) { setChitToDelete(group); setIsDeleteDialogOpen(true); } }}>
                          <Trash2 className="mr-2 size-3.5" /> Delete Scheme
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <CardTitle className="text-lg truncate font-bold">{group.name}</CardTitle>
                  <CardDescription className="text-xs">Capacity: {group.totalMembers} Seats</CardDescription>
                </CardHeader>
                <CardContent className="p-4 flex-1 space-y-3">
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-primary/70">Scheme Amount:</span>
                    <span className="text-primary font-bold">₹{(group.monthlyAmount || 800).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-primary/70">Occupancy:</span>
                    <span className="text-foreground">{(members || []).filter(m => m.status !== 'inactive' && m.chitGroup === group.name).length} / {group.totalMembers}</span>
                  </div>
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-amber-600">Pending Members:</span>
                    <span className="text-amber-700 font-extrabold">{pendingCount}</span>
                  </div>
                  <div className="pt-2 border-t flex justify-between items-center">
                    <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Monthly Collection</span>
                    <span className="text-sm font-bold text-emerald-600">₹{monthlyColl.toLocaleString()}</span>
                  </div>
                </CardContent>
                <CardFooter className="p-0 border-t">
                  <Button variant="ghost" className="w-full h-10 rounded-none text-xs font-bold" onClick={() => setSelectedChitId(group.id)}>View Reservation Board</Button>
                </CardFooter>
              </Card>
            )
          })}
        </div>

        <Dialog open={isAddChitDialogOpen} onOpenChange={(o) => { if (!isActionPending) { setIsAddChitDialogOpen(o); if (!o) setNewChit(INITIAL_CHIT_STATE); } }}>
          <DialogContent className="sm:max-w-[425px]">
            <form onSubmit={handleAddChit}>
              <DialogHeader><DialogTitle>New Scheme</DialogTitle><DialogDescription>Define a new chit fund reservation cycle.</DialogDescription></DialogHeader>
              <div className="grid gap-4 py-6">
                <div className="grid gap-2"><Label htmlFor="schemeName">Name</Label><Input id="schemeName" value={newChit.name} onChange={e => setNewChit({...newChit, name: e.target.value})} required disabled={isActionPending} placeholder="e.g. Daily Silver" /></div>
                <div className="grid gap-2">
                  <Label>Collection Type</Label>
                  <Select value={newChit.collectionType} onValueChange={v => setNewChit({...newChit, collectionType: v})} disabled={isActionPending}>
                    <SelectTrigger><SelectValue placeholder="Select Daily/Monthly" /></SelectTrigger>
                    <SelectContent><SelectItem value="Monthly">Monthly</SelectItem><SelectItem value="Daily">Daily</SelectItem></SelectContent>
                  </Select>
                </div>
                {newChit.collectionType && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2"><Label>Amount (₹)</Label><Input type="number" value={newChit.monthlyAmount || ""} onChange={e => setNewChit({...newChit, monthlyAmount: Number(e.target.value)})} required disabled={isActionPending} placeholder="Enter amount" /></div>
                    <div className="grid gap-2"><Label htmlFor="totalMembers">Seats</Label><Input id="totalMembers" type="number" value={newChit.totalMembers || ""} onChange={e => setNewChit({...newChit, totalMembers: Number(e.target.value)})} required disabled={isActionPending} /></div>
                  </div>
                )}
              </div>
              <DialogFooter className="gap-2">
                <Button variant="outline" type="button" onClick={() => setIsAddChitDialogOpen(false)} disabled={isActionPending} className="w-full sm:w-auto">Cancel</Button>
                <Button type="submit" disabled={isActionPending} className="w-full sm:w-auto font-bold">
                  {isActionPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Create Scheme
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={isEditChitDialogOpen} onOpenChange={(o) => { if (!isActionPending) { setIsEditChitDialogOpen(o); if(!o) setEditingChit(null); } }}>
          <DialogContent className="sm:max-w-[425px]">
            {editingChit && (
              <form onSubmit={handleEditChit}>
                <DialogHeader><DialogTitle>Edit Scheme</DialogTitle><DialogDescription>Update the parameters for {editingChit.name}.</DialogDescription></DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2"><Label>Name</Label><Input value={editingChit.name} onChange={e => setEditingChit({...editingChit, name: e.target.value})} required disabled={isActionPending} /></div>
                  <div className="grid gap-2">
                    <Label>Collection Type</Label>
                    <Select value={editingChit.collectionType} onValueChange={v => setEditingChit({...editingChit, collectionType: v})} disabled={isActionPending}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="Monthly">Monthly</SelectItem><SelectItem value="Daily">Daily</SelectItem></SelectContent>
                    </Select>
                  </div>
                  {editingChit.collectionType && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2"><Label>Amount (₹)</Label><Input type="number" value={editingChit.monthlyAmount || ""} onChange={e => setEditingChit({...editingChit, monthlyAmount: Number(e.target.value)})} required disabled={isActionPending} /></div>
                      <div className="grid gap-2"><Label>Seats</Label><Input type="number" value={editingChit.totalMembers || ""} onChange={e => setEditingChit({...editingChit, totalMembers: Number(e.target.value)})} required disabled={isActionPending} /></div>
                    </div>
                  )}
                </div>
                <DialogFooter className="gap-2">
                  <Button variant="outline" type="button" onClick={() => setIsEditChitDialogOpen(false)} disabled={isActionPending} className="w-full sm:w-auto">Cancel</Button>
                  <Button type="submit" disabled={isActionPending} className="w-full sm:w-auto font-bold">
                    {isActionPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null} Update Changes
                  </Button>
                </DialogFooter>
              </form>
            )}
          </DialogContent>
        </Dialog>

        <AlertDialog open={isDeleteDialogOpen} onOpenChange={(o) => { if (!isActionPending) { setIsDeleteDialogOpen(o); if(!o) setChitToDelete(null); } }}>
          <AlertDialogContent>
            <AlertDialogHeader><AlertDialogTitle className="text-destructive">Delete Scheme?</AlertDialogTitle><AlertDialogDescription>This will permanently remove the scheme <strong>{chitToDelete?.name}</strong>. This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isActionPending}>Cancel</AlertDialogCancel>
              <AlertDialogAction className="bg-destructive hover:bg-destructive/90 font-bold" onClick={confirmDelete} disabled={isActionPending}>
                {isActionPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Delete Permanently
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    )
  }

  const pendingMembersInCurrentGroup = assignedMembers.filter(m => !analyzePaymentStatus(m).paid).length;

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-500 pb-10 overflow-x-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setSelectedChitId(null)} className="rounded-full h-9 w-9" disabled={isActionPending}><ChevronLeft className="size-5" /></Button>
          <div className="min-w-0">
            <h2 className="text-xl sm:text-2xl font-bold truncate tracking-tight text-primary">{currentRound?.name}</h2>
            <p className="text-[10px] sm:text-xs text-muted-foreground uppercase font-bold tracking-tight">Reservation Dashboard</p>
          </div>
        </div>
        <Dialog open={isAddMemberDialogOpen} onOpenChange={(open) => { if(!isActionPending) setIsAddMemberDialogOpen(open); if(!open) setNewMember(INITIAL_MEMBER_STATE); }}>
          <DialogTrigger asChild>
            <Button className="h-10 sm:h-11 shadow-lg px-6 font-bold gap-2" disabled={isActionPending}>
              <UserPlus className="size-5" />
              Add Member
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <form onSubmit={handleAddMemberToScheme}>
              <DialogHeader>
                <DialogTitle>Register to {currentRound?.name}</DialogTitle>
                <DialogDescription>Add a new participant directly to this group.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-6">
                <div className="grid gap-2">
                  <Label htmlFor="memberName">Member Name</Label>
                  <Input 
                    id="memberName" 
                    value={newMember.name} 
                    onChange={e => setNewMember({...newMember, name: e.target.value})} 
                    required 
                    disabled={isActionPending} 
                    placeholder="Enter full name"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="memberPhone">Phone Number</Label>
                  <Input 
                    id="memberPhone" 
                    value={newMember.phone} 
                    onChange={e => setNewMember({...newMember, phone: e.target.value})} 
                    required 
                    disabled={isActionPending} 
                    placeholder="Enter phone"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Group</Label>
                  <Input value={currentRound?.name || ""} readOnly className="bg-muted font-bold text-primary" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="paymentType">Payment Type</Label>
                  <Select 
                    value={newMember.paymentType} 
                    onValueChange={v => setNewMember({ ...newMember, paymentType: v })}
                    disabled={isActionPending}
                  >
                    <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Daily">Daily</SelectItem>
                      <SelectItem value="Monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="joinDate">Date of Joining</Label>
                  <Input 
                    id="joinDate" 
                    type="date" 
                    value={newMember.joinDate} 
                    onChange={e => setNewMember({...newMember, joinDate: e.target.value})} 
                    required 
                    disabled={isActionPending} 
                  />
                </div>
              </div>
              <DialogFooter className="gap-2">
                <Button variant="outline" type="button" onClick={() => setIsAddMemberDialogOpen(false)} disabled={isActionPending} className="w-full sm:w-auto">Cancel</Button>
                <Button type="submit" disabled={isActionPending} className="w-full sm:w-auto font-bold">
                  {isActionPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Register Member
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card className="shadow-sm border-l-4 border-l-primary/40"><CardHeader className="p-3 pb-1"><CardTitle className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Type</CardTitle></CardHeader><CardContent className="p-3 pt-0"><div className="text-lg font-bold">{currentRound?.collectionType}</div></CardContent></Card>
        <Card className="shadow-sm border-l-4 border-l-primary"><CardHeader className="p-3 pb-1"><CardTitle className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Seats Filled</CardTitle></CardHeader><CardContent className="p-3 pt-0"><div className="text-lg font-bold">{assignedMembers.length} / {currentRound?.totalMembers}</div></CardContent></Card>
        <Card className="shadow-sm border-l-4 border-l-amber-500 bg-white">
          <CardHeader className="p-3 pb-1 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-[10px] uppercase font-bold text-amber-700 tracking-wider">Pending Today</CardTitle>
            <Clock className="size-3 text-amber-600 opacity-60" />
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-lg font-bold text-amber-600">{pendingMembersInCurrentGroup} Members</div>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-l-4 border-l-emerald-500 bg-white">
          <CardHeader className="p-3 pb-1 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-[10px] uppercase font-bold text-emerald-700 tracking-wider">Today Collection</CardTitle>
            <CalendarDays className="size-3 text-emerald-600 opacity-60" />
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-lg font-bold text-emerald-600">₹{todayCollection.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-l-4 border-l-amber-500"><CardHeader className="p-3 pb-1"><CardTitle className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Scheme Amount</CardTitle></CardHeader><CardContent className="p-3 pt-0"><div className="text-lg font-bold text-amber-600">₹{(currentRound?.monthlyAmount || 800).toLocaleString()}</div></CardContent></Card>
      </div>

      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <div className="p-4 border-b bg-muted/20 flex justify-between items-center"><h3 className="text-sm font-bold flex items-center gap-2 tracking-tight"><Users className="size-4 text-primary" /> Active Board</h3><Badge variant="secondary" className="text-[10px] tabular-nums font-bold uppercase tracking-tight">{assignedMembers.length} Joined</Badge></div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="text-[10px] uppercase font-bold tracking-wider pl-6">Member</TableHead>
                <TableHead className="text-[10px] uppercase font-bold tracking-wider">Status</TableHead>
                <TableHead className="w-[120px] pr-6"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assignedMembers.length > 0 ? assignedMembers.map((m) => {
                const { paid, pendingTotal } = analyzePaymentStatus(m);
                const displayStatus = paid ? 'success' : 'pending';
                
                return (
                  <TableRow key={m.id} className="hover:bg-muted/5 transition-colors">
                    <TableCell className="pl-6">
                      <div 
                        className="flex items-center gap-2 cursor-pointer group" 
                        onClick={() => { 
                          if(!isActionPending) { 
                            setSelectedProfileMember(m); 
                            setIsEditingProfile(false);
                            setIsMemberProfileDialogOpen(true); 
                          } 
                        }}
                      >
                        <div className="h-7 w-7 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-[10px] group-hover:bg-primary group-hover:text-white transition-colors">
                          {m.name.split(' ').map((n: string) => n[0]).join('')}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-xs font-semibold truncate max-w-[120px] group-hover:text-primary transition-colors">{m.name}</span>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[8px] font-bold text-muted-foreground uppercase">{m.phone}</span>
                            <span className="text-[7px] font-extrabold text-primary/60 border border-primary/20 px-1 rounded bg-primary/5 uppercase tracking-tighter">
                              {m.paymentType || currentRound?.collectionType}
                            </span>
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <Badge variant={displayStatus === 'success' ? 'default' : 'secondary'} className={cn("text-[8px] sm:text-[9px] font-bold uppercase px-1.5 w-fit", displayStatus === 'success' ? "bg-emerald-500" : "")}>{displayStatus}</Badge>
                        {pendingTotal > 0 && (
                          <span className="text-[9px] font-bold text-amber-600">Pending: ₹{pendingTotal.toLocaleString()}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right pr-6">
                      <div className="flex items-center justify-end gap-1">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50" 
                          onClick={() => { if(!isActionPending) { setSelectedMemberForPayment(m); setPaymentData({ ...paymentData, amount: (currentRound?.monthlyAmount || 0) + pendingTotal }); setIsQuickPaymentDialogOpen(true); setIsAddPendingMode(false); } }} 
                          disabled={isActionPending || paid}
                          title="Record Payment"
                        >
                          <IndianRupee className="size-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-muted-foreground hover:text-primary" 
                          onClick={() => { if(!isActionPending) { setHistoryMember(m); setIsHistoryDialogOpen(true); } }} 
                          disabled={isActionPending}
                          title="View History"
                        >
                          <History className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              }) : <TableRow><TableCell colSpan={3} className="h-32 text-center text-xs text-muted-foreground italic">No participants registered in this scheme.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={isMemberProfileDialogOpen} onOpenChange={(open) => { 
        if(!isActionPending) {
          setIsMemberProfileDialogOpen(open); 
          if(!open) {
            setSelectedProfileMember(null);
            setIsEditingProfile(false);
            setEditFormData(null);
          }
        }
      }}>
        <DialogContent className="sm:max-w-[450px] p-0 overflow-hidden border-none shadow-2xl">
          <DialogHeader className="p-6 bg-gradient-to-br from-primary/10 to-transparent border-b">
            <DialogTitle className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm shadow-md ring-2 ring-white/20">
                {selectedProfileMember?.name?.split(' ').map((n: string) => n[0]).join('')}
              </div>
              <div className="flex flex-col">
                <span className="font-headline tracking-tight text-xl">
                  {isEditingProfile ? "Update Profile" : "Member Profile"}
                </span>
                {!isEditingProfile && <span className="text-[10px] uppercase font-bold tracking-widest text-primary/70">Registry #M-{selectedProfileMember?.id?.slice(0, 4)}</span>}
              </div>
            </DialogTitle>
          </DialogHeader>

          {selectedProfileMember && !isEditingProfile ? (
            <div className="px-6 py-2">
              <div className="flex justify-between items-center py-4 border-b">
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Full Name</span>
                <span className="font-bold text-sm text-foreground">{selectedProfileMember.name}</span>
              </div>
              <div className="flex justify-between items-center py-4 border-b">
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Phone Number</span>
                <span className="font-bold text-sm text-foreground tabular-nums">{selectedProfileMember.phone}</span>
              </div>
              <div className="flex justify-between items-center py-4 border-b">
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Assigned Group</span>
                <span className="font-bold text-sm text-primary">{currentRound?.name}</span>
              </div>
              <div className="flex justify-between items-center py-4 border-b">
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Payment Mode</span>
                <Badge variant="secondary" className="font-bold text-[10px] uppercase bg-primary/5 text-primary border-primary/20">
                  {selectedProfileMember.paymentType || currentRound?.collectionType}
                </Badge>
              </div>
              <div className="flex justify-between items-center py-4 border-b">
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Registration Date</span>
                <span className="font-bold text-sm text-foreground">
                  {selectedProfileMember.joinDate ? format(parseISO(selectedProfileMember.joinDate), 'MMM dd, yyyy') : '-'}
                </span>
              </div>
              <div className="mt-6 flex justify-between items-center p-3 bg-emerald-50 rounded-lg border border-emerald-100">
                <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-600">Total Contribution</span>
                <span className="font-bold text-sm text-emerald-700 tabular-nums">₹{(selectedProfileMember.totalPaid || 0).toLocaleString()}</span>
              </div>
            </div>
          ) : selectedProfileMember && isEditingProfile ? (
            <form onSubmit={handleSaveMemberEdit} className="px-6 py-6 space-y-5">
              <div className="grid gap-2">
                <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Member Name</Label>
                <Input 
                  value={editFormData?.name || ""} 
                  onChange={e => setEditFormData({ ...editFormData, name: e.target.value })} 
                  required 
                  disabled={isActionPending}
                  className="h-10 focus-visible:ring-primary/20"
                />
              </div>
              <div className="grid gap-2">
                <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Phone Number</Label>
                <Input 
                  value={editFormData?.phone || ""} 
                  onChange={e => setEditFormData({ ...editFormData, phone: e.target.value })} 
                  required 
                  disabled={isActionPending}
                  className="h-10 focus-visible:ring-primary/20"
                />
              </div>
              <div className="grid gap-2">
                <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Payment Type</Label>
                <Select 
                  value={editFormData?.paymentType || ""} 
                  onValueChange={v => setEditFormData({ ...editFormData, paymentType: v })}
                  disabled={isActionPending}
                >
                  <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Daily">Daily</SelectItem>
                    <SelectItem value="Monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Joining Date</Label>
                <Input 
                  type="date" 
                  value={editFormData?.joinDate || ""} 
                  onChange={e => setEditFormData({ ...editFormData, joinDate: e.target.value })} 
                  required 
                  disabled={isActionPending}
                  className="h-10 focus-visible:ring-primary/20"
                />
              </div>
            </form>
          ) : null}

          <DialogFooter className="p-6 bg-muted/30 flex flex-col sm:flex-row gap-3">
            {!isEditingProfile ? (
              <>
                <Button 
                  variant="outline" 
                  className="w-full sm:w-auto font-bold gap-2 h-10 px-8 uppercase text-[10px] tracking-widest shadow-sm" 
                  onClick={() => {
                    setEditFormData({
                      name: selectedProfileMember.name,
                      phone: selectedProfileMember.phone,
                      paymentType: selectedProfileMember.paymentType || currentRound?.collectionType,
                      joinDate: selectedProfileMember.joinDate
                    });
                    setIsEditingProfile(true);
                  }}
                  disabled={isActionPending}
                >
                  <Pencil className="size-4" /> Edit Profile
                </Button>
                <Button 
                  className="w-full sm:w-auto font-bold h-10 px-8 uppercase text-[10px] tracking-widest shadow-sm" 
                  onClick={() => setIsMemberProfileDialogOpen(false)}
                  disabled={isActionPending}
                >
                  Close Profile
                </Button>
              </>
            ) : (
              <>
                <Button 
                  variant="outline" 
                  className="w-full sm:w-auto font-bold gap-2 h-10 px-8 uppercase text-[10px] tracking-widest" 
                  onClick={() => setIsEditingProfile(false)}
                  disabled={isActionPending}
                >
                  <X className="size-4" /> Cancel
                </Button>
                <Button 
                  className="w-full sm:w-auto font-bold gap-2 h-10 px-8 uppercase text-[10px] tracking-widest shadow-md" 
                  onClick={handleSaveMemberEdit}
                  disabled={isActionPending}
                >
                  {isActionPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                  Save Profile
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isQuickPaymentDialogOpen} onOpenChange={(open) => { if (!isActionPending) { setIsQuickPaymentDialogOpen(open); if (!open) { setSelectedMemberForPayment(null); setPaymentData(INITIAL_PAYMENT_STATE); setIsAddPendingMode(false); } } }}>
        <DialogContent className="sm:max-w-[450px]">
          {selectedMemberForPayment && (
            <div className="space-y-6">
              <DialogHeader>
                <DialogTitle className="flex items-center justify-between">
                  <span>Member Payment</span>
                  {!isAddPendingMode && (
                    <Button variant="outline" size="sm" className="h-8 text-[10px] font-bold uppercase tracking-widest gap-2" onClick={() => setIsAddPendingMode(true)}>
                      <PlusCircle className="size-3.5" /> Add Pending
                    </Button>
                  )}
                </DialogTitle>
                <DialogDescription>Process transaction or record manual pending for {selectedMemberForPayment.name}.</DialogDescription>
              </DialogHeader>

              {isAddPendingMode ? (
                <form onSubmit={handleAddPending} className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="p-4 bg-amber-50 rounded-lg border border-amber-200 space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold uppercase text-amber-700">New Pending Entry</h4>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-amber-600 hover:bg-amber-100" onClick={() => setIsAddPendingMode(false)}><X className="size-4" /></Button>
                    </div>
                    <div className="grid gap-2">
                      <Label className="text-[10px] font-bold uppercase text-amber-600 ml-1">Target Date</Label>
                      <Input 
                        type="date" 
                        value={pendingFormData.date} 
                        onChange={e => setPendingFormData({ ...pendingFormData, date: e.target.value })}
                        className="bg-white border-amber-200"
                        required
                        disabled={isActionPending}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label className="text-[10px] font-bold uppercase text-amber-600 ml-1">Pending Amount (₹)</Label>
                      <Input 
                        type="number" 
                        value={pendingFormData.amount || ""} 
                        onChange={e => setPendingFormData({ ...pendingFormData, amount: Number(e.target.value) })}
                        className="bg-white border-amber-200 font-bold"
                        placeholder="e.g. 800"
                        required
                        disabled={isActionPending}
                      />
                    </div>
                    <Button type="submit" className="w-full bg-amber-600 hover:bg-amber-700 font-bold text-xs uppercase h-10" disabled={isActionPending}>
                      {isActionPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}
                      Save Pending Entry
                    </Button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleQuickPayment} className="space-y-4">
                  <div className="grid gap-4">
                    {analyzePaymentStatus(selectedMemberForPayment).pendingTotal > 0 && (
                      <div className="flex items-center justify-between p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs font-bold">
                        <span className="text-amber-700 flex items-center gap-2"><Clock className="size-3.5" /> Accumulated Pending:</span>
                        <span className="text-amber-700">₹{analyzePaymentStatus(selectedMemberForPayment).pendingTotal.toLocaleString()}</span>
                      </div>
                    )}
                    <div className="grid gap-2">
                      <Label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">Member Name</Label>
                      <Input value={selectedMemberForPayment.name} readOnly className="bg-muted font-bold" />
                    </div>
                    <div className="grid gap-2">
                      <Label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">Total To Pay (₹)</Label>
                      <Input 
                        type="number"
                        value={paymentData.amount || ""} 
                        onChange={e => setPaymentData({ ...paymentData, amount: Number(e.target.value) })}
                        className="font-bold text-emerald-600 h-12 text-xl" 
                        placeholder="Enter amount"
                        disabled={isActionPending}
                        required
                      />
                      <p className="text-[10px] text-muted-foreground ml-1 italic">Includes scheme amount + all previous pending.</p>
                    </div>
                    <div className="grid gap-2">
                      <Label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">Payment Method</Label>
                      <Select 
                        value={paymentData.method} 
                        onValueChange={(v) => setPaymentData({ ...paymentData, method: v })}
                        disabled={isActionPending}
                      >
                        <SelectTrigger className="h-10"><SelectValue placeholder="Select method" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Cash">Cash</SelectItem>
                          <SelectItem value="UPI">UPI</SelectItem>
                          <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex gap-3 pt-4 border-t">
                    <Button variant="outline" type="button" onClick={() => setIsQuickPaymentDialogOpen(false)} disabled={isActionPending} className="flex-1 font-bold h-11">Cancel</Button>
                    <Button type="submit" disabled={isActionPending} className="flex-1 font-bold gap-2 h-11 bg-emerald-600 hover:bg-emerald-700">
                      {isActionPending ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                      Record Success
                    </Button>
                  </div>
                </form>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isHistoryDialogOpen} onOpenChange={(open) => { if (!isActionPending) { setIsHistoryDialogOpen(open); if (!open) setHistoryMember(null) } }}>
        <DialogContent className="sm:max-w-[600px]">
          {isHistoryDialogOpen && (
            <>
              <DialogHeader><DialogTitle className="text-xl">Transaction Audit: {historyMember?.name}</DialogTitle></DialogHeader>
              <div className="py-4 overflow-x-auto">
                <Table>
                  <TableHeader><TableRow className="bg-muted/30"><TableHead className="text-[10px] uppercase font-bold text-muted-foreground pl-4">Date</TableHead><TableHead className="text-[10px] uppercase font-bold text-muted-foreground">Amount</TableHead><TableHead className="text-[10px] uppercase font-bold text-muted-foreground">Status</TableHead><TableHead className="text-right text-[10px] uppercase font-bold text-muted-foreground pr-4">Recorded On</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {historyMember && (allPayments || []).filter(p => p.memberId === historyMember.id).map((p, i) => (
                      <TableRow key={i} className="hover:bg-muted/5 transition-colors">
                        <TableCell className="text-xs font-semibold pl-4">{p.targetDate || p.month}</TableCell>
                        <TableCell className={cn("text-xs font-bold", p.status === 'pending' ? 'text-amber-600' : 'text-emerald-600')}>₹{p.amountPaid?.toLocaleString()}</TableCell>
                        <TableCell>
                          <Badge variant={p.status === 'pending' ? 'secondary' : 'default'} className={cn("text-[8px] font-bold uppercase", p.status === 'pending' ? 'bg-amber-100 text-amber-700' : (p.status === 'success' || p.status === 'paid' ? 'bg-emerald-500' : 'bg-muted text-muted-foreground'))}>
                            {p.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right text-[10px] text-muted-foreground font-medium pr-4">{p.paymentDate ? format(parseISO(p.paymentDate), 'MMM dd, yyyy HH:mm') : '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <DialogFooter><Button className="w-full sm:w-auto font-bold" onClick={() => setIsHistoryDialogOpen(false)}>Close Audit</Button></DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
