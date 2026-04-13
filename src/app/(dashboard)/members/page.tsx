
"use client"

import { useState, useMemo, useEffect } from "react"
import { Search, Phone, Calendar, CheckCircle2, Clock, Pencil, Loader2, Trash2, MoreVertical, Ban, History as HistoryIcon, ChevronDown, ShieldCheck, AlertCircle, Save } from "lucide-react"
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { useToast } from "@/hooks/use-toast"
import { useFirestore, useCollection, useMemoFirebase, useUser } from "@/firebase"
import { collection, doc, serverTimestamp, query, orderBy, updateDoc } from "firebase/firestore"
import { useRole } from "@/hooks/use-role"
import { format, parseISO, startOfDay, eachDayOfInterval, isBefore, isAfter, max, isValid, isSameMonth, differenceInDays, addDays } from "date-fns"
import { createAuditLog } from "@/firebase/logging"
import { withTimeout } from "@/lib/utils"

const PAGE_SIZE = 50

const handlePopupBlur = (e: any) => {
  const ae = document.activeElement;
  if (ae instanceof HTMLInputElement || ae instanceof HTMLTextAreaElement || ae instanceof HTMLSelectElement) {
    ae.blur();
    e.preventDefault();
  }
};

export default function MembersPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [isEditMemberDialogOpen, setIsEditMemberDialogOpen] = useState(false)
  const [selectedMember, setSelectedMember] = useState<any>(null)
  const [isProfileDialogOpen, setIsProfileDialogOpen] = useState(false)
  const [isDeactivateMemberDialogOpen, setIsDeactivateMemberDialogOpen] = useState(false)
  const [memberToDeactivate, setMemberToDeactivate] = useState<any>(null)
  const [memberToEdit, setMemberToEdit] = useState<any>(null)
  const [isActionPending, setIsActionPending] = useState(false)
  const [displayLimit, setDisplayLimit] = useState(PAGE_SIZE)
  
  const { toast } = useToast()
  const db = useFirestore()
  const { user } = useUser()
  const { isAdmin, isLoading: isRoleLoading } = useRole()

  const membersQuery = useMemoFirebase(() => query(collection(db, 'members'), orderBy('name', 'asc')), [db]);
  const { data: members, isLoading: isMembersLoading } = useCollection(membersQuery);

  const paymentsQuery = useMemoFirebase(() => query(collection(db, 'payments'), orderBy('paymentDate', 'desc')), [db]);
  const { data: payments } = useCollection(paymentsQuery);

  const chitRoundsQuery = useMemoFirebase(() => query(collection(db, 'chitRounds'), orderBy('createdAt', 'desc')), [db]);
  const { data: chitRounds } = useCollection(chitRoundsQuery);

  const cyclesQuery = useMemoFirebase(() => query(collection(db, 'cycles'), orderBy('createdAt', 'desc')), [db]);
  const { data: allCycles } = useCollection(cyclesQuery);

  // Global UI Interaction Cleanup
  useEffect(() => {
    return () => {
      document.body.style.pointerEvents = 'auto';
      document.body.style.overflow = 'auto';
    };
  }, []);

  const membersWithCalculatedStats = useMemo(() => {
    if (!members || !payments || !chitRounds || !allCycles) return [];
    const now = startOfDay(new Date());
    const todayStr = format(now, 'yyyy-MM-dd');
    const today = now;

    return members.map(m => {
      const activeCycle = (allCycles || []).find(c => c.name === m.chitGroup && c.status === 'active');
      const mPayments = payments.filter(p => p.memberId === m.id && (p.status === 'success' || p.status === 'paid'));
      const scheme = (chitRounds || []).find(r => r.name === m.chitGroup);
      const resolvedType = (m.paymentType || scheme?.collectionType || "Daily");
      
      let memberStatus: 'paid' | 'pending' | 'waiting' = 'pending';

      if (!activeCycle) {
        return { ...m, memberStatus: 'paid' as const, totalPaidSum: 0 };
      }

      if (resolvedType === 'Daily') {
        const isPaidToday = mPayments.filter(p => p.targetDate === todayStr).reduce((acc, p) => acc + (p.amountPaid || 0), 0) >= (m.monthlyAmount || 800);
        memberStatus = isPaidToday ? 'paid' : 'pending';
      } else {
        const hasPaidThisCycle = mPayments.some(p => {
          const pDate = p.targetDate || (p.paymentDate?.toDate ? format(p.paymentDate.toDate(), 'yyyy-MM-dd') : null);
          return pDate && pDate >= activeCycle.startDate && pDate <= activeCycle.endDate;
        });
        if (hasPaidThisCycle) { memberStatus = 'paid'; } else {
          const cycleStart = parseISO(activeCycle.startDate);
          const numericDueDate = scheme?.dueDate || 5;
          let isPastDue = !isSameMonth(today, cycleStart) || today.getDate() > numericDueDate;
          if (!isPastDue) { memberStatus = 'waiting'; } else { memberStatus = 'pending'; }
        }
      }

      return { 
        ...m, 
        memberStatus: memberStatus, 
        totalPaidSum: mPayments
          .filter(p => {
            const pDate = p.targetDate || (p.paymentDate?.toDate ? format(p.paymentDate.toDate(), 'yyyy-MM-dd') : null);
            return pDate && pDate >= activeCycle.startDate && pDate <= activeCycle.endDate;
          })
          .reduce((acc, p) => acc + (p.amountPaid || 0), 0) 
      };
    });
  }, [members, payments, chitRounds, allCycles]);

  const filteredMembers = useMemo(() => {
    return membersWithCalculatedStats.filter(m => m.status !== "inactive").filter(m => m.name.toLowerCase().includes(searchTerm.toLowerCase()) || m.phone.includes(searchTerm));
  }, [membersWithCalculatedStats, searchTerm])

  const visibleMembers = useMemo(() => filteredMembers.slice(0, displayLimit), [filteredMembers, displayLimit])

  const handleUpdateMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !memberToEdit || isActionPending) return;
    setIsActionPending(true);
    try {
      await updateDoc(doc(db, 'members', memberToEdit.id), { 
        name: memberToEdit.name, 
        phone: memberToEdit.phone, 
        joinDate: memberToEdit.joinDate, 
        paymentType: memberToEdit.paymentType 
      });
      await createAuditLog(db, user, `Updated member profile: ${memberToEdit.name}`);
      setIsEditMemberDialogOpen(false);
      setMemberToEdit(null);
      toast({ title: "Profile Updated", description: "Details saved successfully." });
    } catch (e: any) { 
      toast({ variant: "destructive", title: "Error", description: e.message || "Failed to update member." }); 
    } finally { 
      setIsActionPending(false); 
      document.body.style.pointerEvents = 'auto';
    }
  }

  const handleDeactivateMember = async () => {
    if (!db || !memberToDeactivate || isActionPending) return;
    setIsActionPending(true);
    try {
      await updateDoc(doc(db, 'members', memberToDeactivate.id), { 
        status: "inactive",
        deactivatedAt: new Date().toISOString()
      });
      await createAuditLog(db, user, `Deactivated member: ${memberToDeactivate.name}`);
      setIsDeactivateMemberDialogOpen(false);
      setMemberToDeactivate(null);
      toast({ title: "Member Deactivated", description: "Seat is now marked as inactive." });
    } catch (e: any) { 
      toast({ variant: "destructive", title: "Error", description: e.message || "Failed to deactivate." }); 
    } finally { 
      setIsActionPending(false); 
      document.body.style.pointerEvents = 'auto';
    }
  }

  if (isRoleLoading) return (<div className="flex min-h-[400px] items-center justify-center"><Loader2 className="size-8 animate-spin text-primary" /></div>)

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-500 pb-10 overflow-x-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-2xl sm:text-3xl font-headline font-bold tracking-tight text-primary">Member Directory</h2>
          <p className="text-sm sm:text-base text-muted-foreground">Cycle-based seat status and contribution management.</p>
        </div>
      </div>

      <div className="flex items-center space-x-2 bg-card p-3 sm:p-4 rounded-xl shadow-sm border border-border/50">
        <Search className="size-4 sm:size-5 text-muted-foreground shrink-0" />
        <Input placeholder="Search active members..." value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setDisplayLimit(PAGE_SIZE); }} className="border-none focus-visible:ring-0 shadow-none bg-transparent h-8 text-sm" />
      </div>

      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="font-bold text-sm uppercase tracking-wider min-w-[200px]">Member</TableHead>
                <TableHead className="font-bold text-sm uppercase tracking-wider hidden md:table-cell">Phone</TableHead>
                <TableHead className="font-bold text-sm uppercase tracking-wider">Status</TableHead>
                <TableHead className="font-bold text-sm uppercase tracking-wider text-right">Cycle Ledger (₹)</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isMembersLoading ? (<TableRow><TableCell colSpan={5} className="h-32 text-center text-muted-foreground animate-pulse">Loading members...</TableCell></TableRow>) : visibleMembers.length > 0 ? (
                visibleMembers.map((member) => {
                  const status = member.memberStatus;
                  const isMonthly = (member.paymentType || (chitRounds || []).find(r => r.name === member.chitGroup)?.collectionType) === "Monthly";
                  return (
                    <TableRow key={member.id} className="hover:bg-muted/10 transition-colors">
                      <TableCell>
                        <div className="flex items-center gap-3 cursor-pointer group" onClick={() => { setSelectedMember(member); setIsProfileDialogOpen(true); }}>
                          <div className="flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-full bg-secondary text-primary font-bold text-xs transition-colors group-hover:bg-primary group-hover:text-primary-foreground">{member.name.split(' ').map((n: string) => n[0]).join('')}</div>
                          <div className="flex flex-col min-w-0">
                            <span className="font-semibold text-sm truncate group-hover:text-primary transition-colors">{member.name}</span>
                            <span className="text-[10px] text-primary font-bold uppercase tracking-tight truncate">{member.chitGroup} ({member.paymentType || "D"})</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-xs text-muted-foreground tabular-nums">{member.phone}</TableCell>
                      <TableCell>
                        {status === 'paid' ? (
                          <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200 uppercase tracking-tight shadow-sm w-fit"><CheckCircle2 className="size-2.5" /> SUCCESS</div>
                        ) : status === 'waiting' ? (
                          <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-blue-50 text-blue-700 text-[10px] font-bold border border-blue-200 uppercase tracking-tight shadow-sm w-fit"><Clock className="size-2.5" /> {isMonthly ? 'DUE' : 'WAITING'}</div>
                        ) : (
                          <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-amber-50 text-amber-700 text-[10px] font-bold border border-amber-200 uppercase tracking-tight shadow-sm w-fit"><AlertCircle className="size-2.5" /> {isMonthly ? 'OVERDUE' : 'PENDING'}</div>
                        )}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap"><div className="flex flex-col items-end gap-0.5"><span className="text-sm font-bold text-emerald-600">₹{member.totalPaidSum.toLocaleString()}</span><span className="text-[10px] font-bold text-muted-foreground uppercase">Current Cycle</span></div></TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="size-4" /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuItem onSelect={() => { setMemberToEdit({...member}); setIsEditMemberDialogOpen(true); }}><Pencil className="mr-2 size-4" /> Edit Details</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive focus:bg-destructive/10 focus:text-destructive" onSelect={() => { setMemberToDeactivate(member); setIsDeactivateMemberDialogOpen(true); }}><Ban className="mr-2 size-4" /> Deactivate</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  )
                })
              ) : (<TableRow><TableCell colSpan={5} className="h-32 text-center text-muted-foreground italic text-sm">No active members found.</TableCell></TableRow>)}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={isProfileDialogOpen} onOpenChange={(open) => { if (!open) { setSelectedMember(null); document.body.style.pointerEvents = 'auto'; } setIsProfileDialogOpen(open); }}>
        <DialogContent className="sm:max-w-[400px]">
          {selectedMember && (
            <div className="space-y-6">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2"><User className="size-5 text-primary" /> Member Profile</DialogTitle>
                <DialogDescription className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{selectedMember.name}</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="flex justify-between items-center p-3 bg-muted/30 rounded-lg"><span className="text-xs font-bold uppercase text-muted-foreground">Phone</span><span className="font-bold text-sm tabular-nums">{selectedMember.phone}</span></div>
                <div className="flex justify-between items-center p-3 bg-muted/30 rounded-lg"><span className="text-xs font-bold uppercase text-muted-foreground">Joined</span><span className="font-bold text-sm">{selectedMember.joinDate ? format(parseISO(selectedMember.joinDate), 'MMM dd, yyyy') : '-'}</span></div>
                <div className="flex justify-between items-center p-3 bg-muted/30 rounded-lg"><span className="text-xs font-bold uppercase text-muted-foreground">Group</span><span className="font-bold text-sm text-primary">{selectedMember.chitGroup}</span></div>
                <div className="flex justify-between items-center p-3 bg-emerald-50 rounded-lg"><span className="text-xs font-bold uppercase text-emerald-600">Cycle Paid</span><span className="font-bold text-sm text-emerald-700 tabular-nums">₹{selectedMember.totalPaidSum.toLocaleString()}</span></div>
              </div>
              <DialogFooter>
                <Button onClick={() => setIsProfileDialogOpen(false)} className="w-full font-black uppercase tracking-widest text-xs h-11 rounded-xl">Close Profile</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Member Dialog */}
      <Dialog open={isEditMemberDialogOpen} onOpenChange={(o) => { if(!o) { setMemberToEdit(null); document.body.style.pointerEvents = 'auto'; } setIsEditMemberDialogOpen(o); }}>
        <DialogContent 
          className="sm:max-w-[340px]"
          onOpenAutoFocus={(e) => e.preventDefault()}
          onInteractOutside={handlePopupBlur}
          onEscapeKeyDown={handlePopupBlur}
        >
          {memberToEdit && (
            <form onSubmit={handleUpdateMember} className="space-y-6">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2"><Pencil className="size-5 text-primary" /> Edit Registry</DialogTitle>
                <DialogDescription className="text-[10px] font-bold uppercase text-muted-foreground">Modify participant metadata.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-2">
                <div className="grid gap-1.5"><Label className="text-[9px] font-black uppercase text-muted-foreground">Full Name</Label><Input value={memberToEdit.name} onChange={e => setMemberToEdit({...memberToEdit, name: e.target.value})} required className="h-10 rounded-xl font-bold" /></div>
                <div className="grid gap-1.5"><Label className="text-[9px] font-black uppercase text-muted-foreground">Phone Number</Label><Input value={memberToEdit.phone} onChange={e => setMemberToEdit({...memberToEdit, phone: e.target.value})} required className="h-10 rounded-xl font-bold tabular-nums" /></div>
                <div className="grid gap-1.5"><Label className="text-[9px] font-black uppercase text-muted-foreground">Join Date</Label><Input type="date" value={memberToEdit.joinDate} onChange={e => setMemberToEdit({...memberToEdit, joinDate: e.target.value})} required className="h-10 rounded-xl font-bold" /></div>
                <div className="grid gap-1.5"><Label className="text-[9px] font-black uppercase text-muted-foreground">Mode</Label><Select value={memberToEdit.paymentType || "Daily"} onValueChange={v => setMemberToEdit({...memberToEdit, paymentType: v})}><SelectTrigger className="h-10 rounded-xl font-bold"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Daily">Daily</SelectItem><SelectItem value="Monthly">Monthly</SelectItem></SelectContent></Select></div>
              </div>
              <DialogFooter><Button type="submit" disabled={isActionPending} className="w-full h-11 font-black uppercase tracking-widest shadow-md">{isActionPending ? <Loader2 className="mr-2 size-3 animate-spin" /> : <Save className="size-3 mr-2" />} Save Profile</Button></DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Deactivate AlertDialog */}
      <AlertDialog open={isDeactivateMemberDialogOpen} onOpenChange={(o) => { if(!o) { setMemberToDeactivate(null); document.body.style.pointerEvents = 'auto'; } setIsDeactivateMemberDialogOpen(o); }}>
        <AlertDialogContent className="sm:max-w-[340px]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive font-headline uppercase">Deactivate Member?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs font-medium">This will move <strong>{memberToDeactivate?.name}</strong> to the inactive archive. Their seat will become vacant.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2">
            <AlertDialogAction onClick={handleDeactivateMember} disabled={isActionPending} className="bg-destructive hover:bg-destructive/90 h-11 font-black uppercase tracking-widest w-full">Confirm Deactivation</AlertDialogAction>
            <AlertDialogCancel className="h-10 font-bold uppercase text-[10px] w-full border-muted/60">Keep Active</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
