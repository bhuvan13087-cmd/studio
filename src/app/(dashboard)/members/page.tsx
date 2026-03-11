"use client"

import { useState, useMemo, useEffect } from "react"
import { Search, UserPlus, Phone, Calendar, CheckCircle2, Clock, Pencil, Loader2, Trash2, MoreVertical, Ban, History as HistoryIcon } from "lucide-react"
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
import { addDocumentNonBlocking, updateDocumentNonBlocking } from "@/firebase/non-blocking-updates"
import { useRole } from "@/hooks/use-role"
import { format, parseISO, startOfMonth, endOfMonth, isWithinInterval } from "date-fns"
import { createAuditLog } from "@/firebase/logging"

const INITIAL_MEMBER_STATE = {
  name: "",
  phone: "",
  monthlyAmount: 0,
  joinDate: new Date().toISOString().split('T')[0],
  status: "active",
  chitGroup: ""
}

export default function MembersPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditMemberDialogOpen, setIsEditMemberDialogOpen] = useState(false)
  const [selectedMember, setSelectedMember] = useState<any>(null)
  const [isProfileDialogOpen, setIsProfileDialogOpen] = useState(false)
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false)
  const [isDeactivateMemberDialogOpen, setIsDeactivateMemberDialogOpen] = useState(false)
  const [memberToDeactivate, setMemberToDeactivate] = useState<any>(null)
  const [memberToEdit, setMemberToEdit] = useState<any>(null)
  const [historyMember, setHistoryMember] = useState<any>(null)
  const [isActionPending, setIsActionPending] = useState(false)
  const { toast } = useToast()
  
  const db = useFirestore()
  const { user } = useUser()
  const { isAdmin, isLoading: isRoleLoading } = useRole()

  // STABILIZED QUERIES TO PREVENT INFINITE LOOPS
  const membersQuery = useMemoFirebase(() => query(collection(db, 'members'), orderBy('name', 'asc')), [db]);
  const { data: members, isLoading: isMembersLoading } = useCollection(membersQuery);

  const paymentsQuery = useMemoFirebase(() => query(collection(db, 'payments'), orderBy('paymentDate', 'desc')), [db]);
  const { data: payments } = useCollection(paymentsQuery);

  const chitRoundsQuery = useMemoFirebase(() => query(collection(db, 'chitRounds'), orderBy('createdAt', 'desc')), [db]);
  const { data: chitRounds } = useCollection(chitRoundsQuery);

  const [newMember, setNewMember] = useState(INITIAL_MEMBER_STATE)

  // CRITICAL: CLEANUP INTERACTION LOCKS
  useEffect(() => {
    // Reset body styles on mount to recover from any previous crashes
    document.body.style.pointerEvents = 'auto'
    document.body.style.overflow = 'auto'
    
    return () => {
      document.body.style.pointerEvents = 'auto'
      document.body.style.overflow = 'auto'
    }
  }, [])

  // OPTIMIZED PAID STATUS CHECK (O(N) instead of O(N*M))
  const paidMemberStatus = useMemo(() => {
    if (!payments) return new Map<string, any>();
    const now = new Date();
    const start = startOfMonth(now);
    const end = endOfMonth(now);
    
    const paidMap = new Map<string, any>();
    payments.forEach(p => {
      if ((p.status === 'paid' || p.status === 'success') && p.paymentDate) {
        try {
          const d = parseISO(p.paymentDate);
          if (isWithinInterval(d, { start, end })) {
            paidMap.set(p.memberId, p);
          }
        } catch (e) {}
      }
    });
    return paidMap;
  }, [payments]);

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!db || isActionPending) return;
    
    setIsActionPending(true)
    try {
      addDocumentNonBlocking(collection(db, 'members'), {
        ...newMember,
        monthlyAmount: Number(newMember.monthlyAmount),
        createdAt: serverTimestamp(),
        paymentStatus: "pending",
        totalPaid: 0,
        pendingAmount: 0,
        status: "active"
      })
      
      createAuditLog(db, user, `Registered new member: ${newMember.name}`)
      
      setIsAddDialogOpen(false)
      setNewMember(INITIAL_MEMBER_STATE)
      toast({ title: "Member Added", description: `${newMember.name} registered successfully.` })
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: "Failed to add member." })
    } finally {
      setIsActionPending(false)
    }
  }

  const handleUpdateMember = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!db || !memberToEdit || isActionPending) return;
    
    setIsActionPending(true)
    try {
      const memberRef = doc(db, 'members', memberToEdit.id);
      updateDocumentNonBlocking(memberRef, {
        name: memberToEdit.name,
        phone: memberToEdit.phone,
        monthlyAmount: Number(memberToEdit.monthlyAmount),
        joinDate: memberToEdit.joinDate,
        status: memberToEdit.status,
        chitGroup: memberToEdit.chitGroup
      });
      
      createAuditLog(db, user, `Updated member details: ${memberToEdit.name}`)
      
      setIsEditMemberDialogOpen(false)
      setMemberToEdit(null)
      toast({ title: "Member Updated", description: "Details saved." })
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: "Failed to update member." })
    } finally {
      setIsActionPending(false)
    }
  }

  const confirmDeactivateMember = async () => {
    if (!db || !memberToDeactivate || isActionPending) return
    
    setIsActionPending(true)
    try {
      const memberRef = doc(db, 'members', memberToDeactivate.id)
      updateDocumentNonBlocking(memberRef, {
        status: "inactive",
        deactivatedAt: new Date().toISOString()
      });
      
      createAuditLog(db, user, `Deactivated member: ${memberToDeactivate.name}`)
      
      toast({ title: "Member Deactivated", description: "Member is now inactive." })
      setIsDeactivateMemberDialogOpen(false)
      setMemberToDeactivate(null)
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: "Failed to deactivate member." })
    } finally {
      setIsActionPending(false)
    }
  }

  const filteredMembers = useMemo(() => {
    if (!members) return []
    return members
      .filter(member => member.status !== "inactive")
      .filter(member => 
        member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        member.phone.includes(searchTerm)
      )
  }, [members, searchTerm])

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
          <p className="text-sm sm:text-base text-muted-foreground">Manage participants and seat reservations.</p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={(open) => { 
          if (!isActionPending) {
            setIsAddDialogOpen(open); 
            if (!open) setNewMember(INITIAL_MEMBER_STATE);
          }
        }}>
          <DialogTrigger asChild>
            <Button className="h-10 sm:h-11 w-full sm:w-auto px-6 shadow-lg hover:shadow-xl transition-all font-bold">
              <UserPlus className="mr-2 size-4 sm:size-5" />
              Add Member
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <form onSubmit={handleAddMember}>
              <DialogHeader><DialogTitle>Register Member</DialogTitle><DialogDescription>Enter member details and assign to a reservation scheme.</DialogDescription></DialogHeader>
              <div className="grid gap-4 py-6">
                <div className="grid gap-2"><Label htmlFor="name">Full Name</Label><Input id="name" value={newMember.name} onChange={e => setNewMember({...newMember, name: e.target.value})} required disabled={isActionPending} /></div>
                <div className="grid gap-2"><Label htmlFor="phone">Phone Number</Label><Input id="phone" value={newMember.phone} onChange={e => setNewMember({...newMember, phone: e.target.value})} required disabled={isActionPending} /></div>
                <div className="grid gap-2">
                  <Label htmlFor="chitGroup">Assigned Scheme</Label>
                  <Select 
                    disabled={isActionPending} 
                    value={newMember.chitGroup} 
                    onValueChange={(v) => {
                      const scheme = chitRounds?.find((r: any) => r.name === v);
                      setNewMember({
                        ...newMember, 
                        chitGroup: v,
                        monthlyAmount: scheme?.monthlyAmount || 0
                      });
                    }}
                  >
                    <SelectTrigger><SelectValue placeholder="Select scheme" /></SelectTrigger>
                    <SelectContent>{chitRounds?.map((round: any) => (<SelectItem key={round.id} value={round.name}>{round.name}</SelectItem>))}</SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Amount (₹)</Label>
                  <Input type="number" value={newMember.monthlyAmount || ""} readOnly className="bg-muted font-bold text-primary" required disabled={isActionPending} />
                </div>
                <div className="grid gap-2"><Label htmlFor="joinDate">Join Date</Label><Input id="joinDate" type="date" value={newMember.joinDate} onChange={e => setNewMember({...newMember, joinDate: e.target.value})} required disabled={isActionPending} /></div>
              </div>
              <DialogFooter className="flex-col sm:flex-row gap-2">
                <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)} disabled={isActionPending} className="w-full sm:w-auto">Cancel</Button>
                <Button type="submit" disabled={isActionPending} className="w-full sm:w-auto font-bold">
                  {isActionPending && <Loader2 className="mr-2 size-4 animate-spin" />}
                  Register Member
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center space-x-2 bg-card p-3 sm:p-4 rounded-xl shadow-sm border border-border/50">
        <Search className="size-4 sm:size-5 text-muted-foreground shrink-0" />
        <Input
          placeholder="Search active members..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
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
              ) : filteredMembers.length > 0 ? (
                filteredMembers.map((member) => {
                  const currentMonthPayment = paidMemberStatus.get(member.id);
                  const isPaid = !!currentMonthPayment;
                  return (
                    <TableRow key={member.id} className="hover:bg-muted/10 transition-colors">
                      <TableCell>
                        <div className="flex items-center gap-3 cursor-pointer group" onClick={() => { setSelectedMember(member); setIsProfileDialogOpen(true); }}>
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
                        {isPaid ? (
                          <Popover>
                            <PopoverTrigger asChild>
                              <button className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-all text-[10px] font-bold border border-emerald-200 uppercase tracking-tight shadow-sm">
                                <CheckCircle2 className="size-2.5" /> Success
                              </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-3 shadow-xl text-xs" align="start">
                               <div className="font-bold text-emerald-600 mb-1">Paid: ₹{currentMonthPayment?.amountPaid?.toLocaleString()}</div>
                               <div className="text-[10px] text-muted-foreground uppercase font-semibold">Date: {currentMonthPayment.paymentDate ? format(parseISO(currentMonthPayment.paymentDate), 'MMM dd, yyyy') : '-'}</div>
                            </PopoverContent>
                          </Popover>
                        ) : (
                          <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-amber-50 text-amber-700 text-[10px] font-bold border border-amber-200 uppercase tracking-tight shadow-sm w-fit">
                            <Clock className="size-2.5" /> Pending
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <div className="flex flex-col items-end gap-0.5">
                          <span className="text-sm font-bold text-emerald-600">₹{(member.totalPaid || 0).toLocaleString()}</span>
                          <span className="text-[10px] font-bold text-muted-foreground uppercase">Total Paid</span>
                        </div>
                      </TableCell>
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
              ) : (
                <TableRow><TableCell colSpan={5} className="h-32 text-center text-muted-foreground italic text-sm">No active members found.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Edit Member Dialog */}
      <Dialog open={isEditMemberDialogOpen} onOpenChange={(open) => { 
        if (!isActionPending) {
          setIsEditMemberDialogOpen(open); 
          if (!open) setMemberToEdit(null);
        }
      }}>
        <DialogContent className="sm:max-w-[425px]">
          {isEditMemberDialogOpen && (
            <form onSubmit={handleUpdateMember}>
              <DialogHeader><DialogTitle>Edit Member</DialogTitle><DialogDescription>Update details for {memberToEdit?.name}.</DialogDescription></DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2"><Label>Name</Label><Input value={memberToEdit?.name || ""} onChange={e => setMemberToEdit({...memberToEdit, name: e.target.value})} required disabled={isActionPending} /></div>
                <div className="grid gap-2"><Label>Phone</Label><Input value={memberToEdit?.phone || ""} onChange={e => setMemberToEdit({...memberToEdit, phone: e.target.value})} required disabled={isActionPending} /></div>
                <div className="grid gap-2">
                  <Label>Scheme</Label>
                  <Select 
                    disabled={isActionPending} 
                    value={memberToEdit?.chitGroup || ""} 
                    onValueChange={v => {
                      const scheme = chitRounds?.find((r: any) => r.name === v);
                      setMemberToEdit({
                        ...memberToEdit, 
                        chitGroup: v,
                        monthlyAmount: scheme?.monthlyAmount || memberToEdit.monthlyAmount
                      });
                    }}
                  >
                    <SelectTrigger><SelectValue placeholder="Select scheme" /></SelectTrigger>
                    <SelectContent>{chitRounds?.map((round: any) => (<SelectItem key={round.id} value={round.name}>{round.name}</SelectItem>))}</SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Amount (₹)</Label>
                  <Input type="number" value={memberToEdit?.monthlyAmount || ""} readOnly className="bg-muted font-bold" required disabled={isActionPending} />
                </div>
              </div>
              <DialogFooter className="gap-2">
                <Button type="button" variant="outline" onClick={() => setIsEditMemberDialogOpen(false)} disabled={isActionPending} className="w-full sm:w-auto">Cancel</Button>
                <Button type="submit" disabled={isActionPending} className="w-full sm:w-auto font-bold">
                  {isActionPending && <Loader2 className="mr-2 size-4 animate-spin" />}
                  Save Changes
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Profile Dialog */}
      <Dialog open={isProfileDialogOpen} onOpenChange={(open) => { 
        if (!isActionPending) { 
          setIsProfileDialogOpen(open); 
          if (!open) setSelectedMember(null) 
        } 
      }}>
        <DialogContent className="sm:max-w-[450px]">
          {isProfileDialogOpen && (
            <>
              <DialogHeader><DialogTitle className="flex items-center gap-2"><div className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">{selectedMember?.name?.split(' ').map((n: string) => n[0]).join('')}</div>Profile View</DialogTitle></DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="flex justify-between items-center p-3 bg-muted/30 rounded-lg text-sm"><span className="text-muted-foreground">Phone</span><span className="font-bold">{selectedMember?.phone}</span></div>
                <div className="flex justify-between items-center p-3 bg-muted/30 rounded-lg text-sm"><span className="text-muted-foreground">Joined</span><span className="font-bold">{selectedMember?.joinDate ? format(parseISO(selectedMember.joinDate), 'MMM dd, yyyy') : '-'}</span></div>
                <div className="flex justify-between items-center p-3 bg-muted/30 rounded-lg text-sm"><span className="text-muted-foreground">Amount</span><span className="font-bold text-primary">₹{selectedMember?.monthlyAmount?.toLocaleString()}</span></div>
                <div className="flex justify-between items-center p-3 bg-emerald-50 rounded-lg text-sm"><span className="text-emerald-600 font-bold uppercase text-[10px]">Total Paid</span><span className="font-bold text-emerald-600 text-base">₹{(selectedMember?.totalPaid || 0).toLocaleString()}</span></div>
              </div>
              <DialogFooter className="flex flex-col sm:flex-row gap-2">
                <Button 
                  variant="destructive" 
                  className="w-full sm:w-auto sm:mr-auto font-bold" 
                  disabled={isActionPending}
                  onClick={() => { 
                    setMemberToDeactivate(selectedMember); 
                    setIsDeactivateMemberDialogOpen(true); 
                    setIsProfileDialogOpen(false); 
                  }}
                >
                  <Ban className="mr-2 size-4" /> Deactivate
                </Button>
                <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
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
                      <TableHead className="text-xs uppercase font-bold text-muted-foreground">Month</TableHead>
                      <TableHead className="text-xs uppercase font-bold text-muted-foreground">Amount</TableHead>
                      <TableHead className="text-right text-xs uppercase font-bold text-muted-foreground">Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historyMember && (payments || []).filter(p => p.memberId === historyMember.id && (p.status === 'paid' || p.status === 'success')).map((p, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-sm font-semibold">{p.month}</TableCell>
                        <TableCell className="text-sm font-bold text-emerald-600">₹{p.amountPaid?.toLocaleString()}</TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground font-medium">{p.paymentDate ? format(parseISO(p.paymentDate), 'MMM dd, yyyy') : '-'}</TableCell>
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

      {/* Deactivate Confirmation */}
      <AlertDialog open={isDeactivateMemberDialogOpen} onOpenChange={(open) => { if (!isActionPending) { setIsDeactivateMemberDialogOpen(open); if (!open) setMemberToDeactivate(null) } }}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle className="text-destructive">Deactivate Member?</AlertDialogTitle><AlertDialogDescription>This will move <strong>{memberToDeactivate?.name}</strong> to inactive status. They will no longer appear in active lists, but their payment history will be preserved.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel disabled={isActionPending}>Cancel</AlertDialogCancel><AlertDialogAction className="bg-destructive hover:bg-destructive/90 font-bold" onClick={confirmDeactivateMember} disabled={isActionPending}>
            {isActionPending && <Loader2 className="mr-2 size-4 animate-spin" />}
            Deactivate
          </AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
