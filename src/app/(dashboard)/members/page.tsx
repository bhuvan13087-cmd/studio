"use client"

import { useState, useMemo, useEffect } from "react"
import { Search, Phone, Calendar, CheckCircle2, Clock, Pencil, Loader2, Trash2, MoreVertical, Ban, History as HistoryIcon, ChevronDown, ShieldCheck } from "lucide-react"
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
import { format, parseISO, startOfDay, eachDayOfInterval, isBefore, max } from "date-fns"
import { createAuditLog } from "@/firebase/logging"
import { withTimeout } from "@/lib/utils"

// STRICT SYSTEM START DATE
const CALCULATION_START_DATE = parseISO('2026-04-01');

const PAGE_SIZE = 50

export default function MembersPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [isEditMemberDialogOpen, setIsEditMemberDialogOpen] = useState(false)
  const [selectedMember, setSelectedMember] = useState<any>(null)
  const [isProfileDialogOpen, setIsProfileDialogOpen] = useState(false)
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false)
  const [isDeactivateMemberDialogOpen, setIsDeactivateMemberDialogOpen] = useState(false)
  const [memberToDeactivate, setMemberToDeactivate] = useState<any>(null)
  const [memberToEdit, setMemberToEdit] = useState<any>(null)
  const [historyMember, setHistoryMember] = useState<any>(null)
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

  const membersWithCalculatedStats = useMemo(() => {
    if (!members || !payments) return [];
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const today = startOfDay(new Date());
    const currentMonthStr = format(today, 'MMMM yyyy');
    const currentDayOfMonth = today.getDate();

    return members.map(m => {
      const mPayments = payments.filter(p => p.memberId === m.id && (p.status === 'success' || p.status === 'paid'));
      const scheme = (chitRounds || []).find(r => r.name === m.chitGroup);
      const resolvedType = (m.paymentType || scheme?.collectionType || "Daily");
      
      let memberStatus: 'paid' | 'pending' | 'waiting' = 'pending';

      if (resolvedType === 'Daily') {
        const isPaidToday = mPayments
          .filter(p => p.targetDate === todayStr)
          .reduce((acc, p) => acc + (p.amountPaid || 0), 0) >= (m.monthlyAmount || 800);
        memberStatus = isPaidToday ? 'paid' : 'pending';
      } else {
        const dueDate = scheme?.dueDate || 5;
        const hasPaidThisMonth = mPayments.some(p => p.month === currentMonthStr);
        if (hasPaidThisMonth) {
          memberStatus = 'paid';
        } else if (currentDayOfMonth < dueDate) {
          memberStatus = 'waiting';
        } else {
          memberStatus = 'pending';
        }
      }

      return {
        ...m,
        memberStatus: memberStatus,
        totalPaidSum: mPayments.reduce((acc, p) => acc + (p.amountPaid || 0), 0)
      };
    });
  }, [members, payments, chitRounds]);

  const handleUpdateMember = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!db || !memberToEdit || isActionPending) return;
    
    setIsActionPending(true)
    try {
      const memberRef = doc(db, 'members', memberToEdit.id);
      await withTimeout(updateDoc(memberRef, {
        name: memberToEdit.name,
        phone: memberToEdit.phone,
        joinDate: memberToEdit.joinDate,
        status: memberToEdit.status,
        chitGroup: memberToEdit.chitGroup
      }));
      
      await createAuditLog(db, user, `Updated member details: ${memberToEdit.name}`)
      setIsEditMemberDialogOpen(false)
      setMemberToEdit(null)
      toast({ title: "Member Updated", description: "Details saved." })
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message || "Failed to update member." })
    } finally {
      setIsActionPending(false)
    }
  }

  const confirmDeactivateMember = async () => {
    if (!db || !memberToDeactivate || isActionPending) return
    
    setIsActionPending(true)
    try {
      const memberRef = doc(db, 'members', memberToDeactivate.id)
      await withTimeout(updateDoc(memberRef, {
        status: "inactive",
        deactivatedAt: new Date().toISOString()
      }));
      
      await createAuditLog(db, user, `Deactivated member: ${memberToDeactivate.name}`)
      toast({ title: "Member Deactivated", description: "Member is now inactive." })
      setIsDeactivateMemberDialogOpen(false)
      setMemberToDeactivate(null)
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message || "Failed to deactivate member." })
    } finally {
      setIsActionPending(false)
    }
  }

  const filteredMembers = useMemo(() => {
    return membersWithCalculatedStats
      .filter(member => member.status !== "inactive")
      .filter(member => 
        member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        member.phone.includes(searchTerm)
      )
  }, [membersWithCalculatedStats, searchTerm])

  const visibleMembers = useMemo(() => filteredMembers.slice(0, displayLimit), [filteredMembers, displayLimit])

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
          <h2 className="text-2xl sm:text-3xl font-headline font-bold tracking-tight text-primary">Member Directory</h2>
          <p className="text-sm sm:text-base text-muted-foreground">Manage participants and dynamic seat status.</p>
        </div>
      </div>

      <div className="flex items-center space-x-2 bg-card p-3 sm:p-4 rounded-xl shadow-sm border border-border/50">
        <Search className="size-4 sm:size-5 text-muted-foreground shrink-0" />
        <Input
          placeholder="Search active members..."
          value={searchTerm}
          onChange={(e) => { setSearchTerm(e.target.value); setDisplayLimit(PAGE_SIZE); }}
          className="border-none focus-visible:ring-0 shadow-none bg-transparent h-8 text-sm"
        />
      </div>

      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="font-bold text-sm uppercase tracking-wider min-w-[200px]">Member</TableHead>
                <TableHead className="font-bold text-sm uppercase tracking-wider hidden md:table-cell">Phone</TableHead>
                <TableHead className="font-bold text-sm uppercase tracking-wider">Status</TableHead>
                <TableHead className="font-bold text-sm uppercase tracking-wider text-right">Ledger (₹)</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isMembersLoading ? (
                <TableRow><TableCell colSpan={5} className="h-32 text-center text-muted-foreground animate-pulse">Loading members...</TableCell></TableRow>
              ) : visibleMembers.length > 0 ? (
                visibleMembers.map((member) => {
                  const status = member.memberStatus;
                  return (
                    <TableRow key={member.id} className="hover:bg-muted/10 transition-colors">
                      <TableCell>
                        <div className="flex items-center gap-3 cursor-pointer group" onClick={() => { if(!isActionPending) { setSelectedMember(member); setIsProfileDialogOpen(true); } }}>
                          <div className="flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-full bg-secondary text-primary font-bold text-xs transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                            {member.name.split(' ').map((n: string) => n[0]).join('')}
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="font-semibold text-sm truncate group-hover:text-primary transition-colors">{member.name}</span>
                            <span className="text-[10px] text-primary font-bold uppercase tracking-tight truncate">{member.chitGroup}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-xs text-muted-foreground tabular-nums">{member.phone}</TableCell>
                      <TableCell>
                        {status === 'paid' ? (
                          <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200 uppercase tracking-tight shadow-sm w-fit">
                            <CheckCircle2 className="size-2.5" /> Success
                          </div>
                        ) : status === 'waiting' ? (
                          <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-blue-50 text-blue-700 text-[10px] font-bold border border-blue-200 uppercase tracking-tight shadow-sm w-fit">
                            <Clock className="size-2.5" /> Waiting
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-amber-50 text-amber-700 text-[10px] font-bold border border-amber-200 uppercase tracking-tight shadow-sm w-fit">
                            <Clock className="size-2.5" /> Pending
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <div className="flex flex-col items-end gap-0.5">
                          <span className="text-sm font-bold text-emerald-600">₹{member.totalPaidSum.toLocaleString()}</span>
                          <span className="text-[10px] font-bold text-muted-foreground uppercase">Total Paid</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8" disabled={isActionPending}>
                              <MoreVertical className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuItem onSelect={() => { 
                              if (!isActionPending) {
                                setMemberToEdit({...member}); 
                                setIsEditMemberDialogOpen(true); 
                              }
                            }}>
                              <Pencil className="mr-2 size-4" /> Edit Details
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              className="text-destructive focus:bg-destructive/10 focus:text-destructive" 
                              onSelect={() => { 
                                if (!isActionPending) {
                                  setMemberToDeactivate(member); 
                                  setIsDeactivateMemberDialogOpen(true); 
                                }
                              }}
                            >
                              <Ban className="mr-2 size-4" /> Deactivate
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  )
                })
              ) : (
                <TableRow><TableCell colSpan={5} className="h-32 text-center text-muted-foreground italic text-sm">No active members found.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        {filteredMembers.length > displayLimit && (
          <div className="p-4 border-t flex justify-center">
            <Button variant="ghost" size="sm" onClick={() => setDisplayLimit(prev => prev + PAGE_SIZE)} className="text-xs font-bold uppercase tracking-widest gap-2">
              <ChevronDown className="size-4" /> Load More Members
            </Button>
          </div>
        )}
      </div>

      {/* Profile Dialog */}
      <Dialog open={isProfileDialogOpen} onOpenChange={(open) => { if (!isActionPending) { setIsProfileDialogOpen(open); if (!open) setSelectedMember(null) } }}>
        <DialogContent className="sm:max-w-[450px]">
          {selectedMember && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <div className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs uppercase">
                    {selectedMember?.name?.split(' ').map((n: string) => n[0]).join('')}
                  </div>
                  Profile View
                </DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="flex justify-between items-center p-3 bg-muted/30 rounded-lg text-sm"><span className="text-muted-foreground">Phone</span><span className="font-bold">{selectedMember?.phone}</span></div>
                <div className="flex justify-between items-center p-3 bg-muted/30 rounded-lg text-sm"><span className="text-muted-foreground">Joined</span><span className="font-bold">{selectedMember?.joinDate ? format(parseISO(selectedMember.joinDate), 'MMM dd, yyyy') : '-'}</span></div>
                <div className="flex justify-between items-center p-3 bg-muted/30 rounded-lg text-sm"><span className="text-muted-foreground">Scheme Base</span><span className="font-bold text-primary">₹{selectedMember?.monthlyAmount?.toLocaleString()}</span></div>
                <div className="flex justify-between items-center p-3 bg-emerald-50 rounded-lg text-sm"><span className="text-emerald-600 font-bold uppercase text-[10px]">Total Paid</span><span className="font-bold text-emerald-600 text-base">₹{selectedMember.totalPaidSum.toLocaleString()}</span></div>
              </div>
              <DialogFooter className="flex flex-col sm:flex-row gap-2">
                <Button 
                  variant="destructive" 
                  className="w-full sm:w-auto font-bold" 
                  disabled={isActionPending}
                  onClick={() => { 
                    setMemberToDeactivate(selectedMember); 
                    setIsDeactivateMemberDialogOpen(true); 
                    setIsProfileDialogOpen(false); 
                  }}
                >
                  <Ban className="mr-2 size-4" /> Deactivate
                </Button>
                <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto ml-auto">
                  <Button variant="outline" className="w-full sm:w-auto font-bold" onClick={() => { 
                    const m = selectedMember;
                    setIsProfileDialogOpen(false); 
                    setTimeout(() => { 
                      setHistoryMember(m); 
                      setIsHistoryDialogOpen(true); 
                    }, 100); 
                  }}>
                    <HistoryIcon className="mr-2 size-4" /> History
                  </Button>
                  <Button className="w-full sm:w-auto font-bold" onClick={() => setIsProfileDialogOpen(false)}>Close</Button>
                </div>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* History Dialog */}
      <Dialog open={isHistoryDialogOpen} onOpenChange={(open) => { if (!isActionPending) { setIsHistoryDialogOpen(open); if (!open) setHistoryMember(null) } }}>
        <DialogContent className="sm:max-w-[550px]">
          {isHistoryDialogOpen && (
            <>
              <DialogHeader><DialogTitle className="text-xl">Payment History: {historyMember?.name}</DialogTitle></DialogHeader>
              <div className="py-4 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs uppercase font-bold text-muted-foreground">Target Date</TableHead>
                      <TableHead className="text-xs uppercase font-bold text-muted-foreground">Amount</TableHead>
                      <TableHead className="text-right text-xs uppercase font-bold text-muted-foreground">Recorded On</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historyMember && (payments || []).filter(p => p.memberId === historyMember.id && (p.status === 'paid' || p.status === 'success')).map((p, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-sm font-semibold">{p.targetDate || '-'}</TableCell>
                        <TableCell className="text-sm font-bold text-emerald-600">₹{p.amountPaid?.toLocaleString()}</TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground font-medium">{p.paymentDate ? format(p.paymentDate?.toDate ? p.paymentDate.toDate() : parseISO(p.paymentDate), 'dd MMM, hh:mm a') : '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <DialogFooter><Button className="w-full sm:w-auto font-bold" onClick={() => setIsHistoryDialogOpen(false)}>Close</Button></DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeactivateMemberDialogOpen} onOpenChange={(open) => { if (!isActionPending) { setIsDeactivateMemberDialogOpen(open); if (!open) setMemberToDeactivate(null) } }}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle className="text-destructive">Deactivate Member?</AlertDialogTitle><AlertDialogDescription>This will move <strong>{memberToDeactivate?.name}</strong> to inactive status. Date-based tracking will stop for this member.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel disabled={isActionPending}>Cancel</AlertDialogCancel><AlertDialogAction className="bg-destructive hover:bg-destructive/90 font-bold" onClick={confirmDeactivateMember} disabled={isActionPending}>
            {isActionPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            Deactivate
          </AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}