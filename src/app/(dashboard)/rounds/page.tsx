
"use client"

import { useState } from "react"
import { Trophy, History, Plus, Award, Calendar, IndianRupee, Users, CheckCircle2, MoreVertical, Search, UserCheck, ChevronLeft, LayoutGrid, ArrowRight, Loader2, AlertCircle, Database, FileText, Clock, Pencil, Trash2, Phone } from "lucide-react"
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
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, query, doc, serverTimestamp, orderBy, addDoc, updateDoc, deleteDoc } from "firebase/firestore"
import { useRole } from "@/hooks/use-role"
import { format, parseISO } from "date-fns"

export default function RoundsPage() {
  const [selectedChitId, setSelectedChitId] = useState<string | null>(null)
  const [isAddChitDialogOpen, setIsAddChitDialogOpen] = useState(false)
  const [isEditChitDialogOpen, setIsEditChitDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false)
  const [isRemoveMemberDialogOpen, setIsRemoveMemberDialogOpen] = useState(false)
  const [isActionPending, setIsActionPending] = useState(false)
  
  const [editingChit, setEditingChit] = useState<any>(null)
  const [chitToDelete, setChitToDelete] = useState<any>(null)
  const [historyMember, setHistoryMember] = useState<any>(null)
  const [memberToRemove, setMemberToRemove] = useState<any>(null)
  
  const { toast } = useToast()
  const db = useFirestore()
  const { isAdmin, isLoading: isRoleLoading } = useRole()

  const roundsQuery = useMemoFirebase(() => query(collection(db, 'chitRounds'), orderBy('createdAt', 'desc')), [db]);
  const { data: roundsData, isLoading: isRoundsLoading } = useCollection(roundsQuery);
  const chitSchemes = roundsData || [];

  const membersQuery = useMemoFirebase(() => collection(db, 'members'), [db]);
  const { data: members } = useCollection(membersQuery);

  const paymentsQuery = useMemoFirebase(() => query(collection(db, 'payments'), orderBy('paymentDate', 'desc')), [db]);
  const { data: payments } = useCollection(paymentsQuery);

  const [newChit, setNewChit] = useState({
    name: "",
    monthlyAmount: 5000,
    totalMembers: 20,
    duration: 20,
    startDate: new Date().toISOString().split('T')[0],
    description: ""
  })

  // Robust interaction restoration
  const restoreInteraction = (open: boolean) => {
    if (!open) {
      setTimeout(() => {
        document.body.style.pointerEvents = 'auto'
        document.body.style.overflow = 'auto'
        const html = document.documentElement;
        if (html) {
          html.style.pointerEvents = 'auto';
          html.style.overflow = 'auto';
        }
        document.querySelectorAll('[data-radix-portal]').forEach(el => {
          if (el.innerHTML === '') el.remove();
        });
      }, 200)
    }
  }

  const handleAddChit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!db || isActionPending) return

    setIsActionPending(true)
    try {
      await addDoc(collection(db, 'chitRounds'), {
        ...newChit,
        createdAt: serverTimestamp()
      })
      setIsAddChitDialogOpen(false)
      restoreInteraction(false)
      setNewChit({ name: "", monthlyAmount: 5000, totalMembers: 20, duration: 20, startDate: new Date().toISOString().split('T')[0], description: "" })
      toast({ title: "Chit Round Created", description: "Your new chit scheme is now active." })
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message || "Failed to create round." })
    } finally {
      setIsActionPending(false)
    }
  }

  const handleEditChit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!db || !editingChit || isActionPending) return

    setIsActionPending(true)
    try {
      await updateDoc(doc(db, 'chitRounds', editingChit.id), {
        name: editingChit.name,
        monthlyAmount: Number(editingChit.monthlyAmount),
        totalMembers: Number(editingChit.totalMembers),
        duration: Number(editingChit.duration),
        startDate: editingChit.startDate,
        description: editingChit.description || ""
      })
      setIsEditChitDialogOpen(false)
      restoreInteraction(false)
      setEditingChit(null)
      toast({ title: "Chit Updated", description: "Changes saved successfully." })
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message || "Failed to update round." })
    } finally {
      setIsActionPending(false)
    }
  }

  const confirmDelete = async () => {
    if (!db || !chitToDelete || isActionPending) return;
    setIsActionPending(true)
    try {
      await deleteDoc(doc(db, 'chitRounds', chitToDelete.id));
      toast({ title: "Chit Deleted", description: `${chitToDelete.name} removed.` })
      setIsDeleteDialogOpen(false)
      restoreInteraction(false)
      setChitToDelete(null)
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message || "Failed to delete round." })
    } finally {
      setIsActionPending(false)
    }
  }

  const confirmRemoveMember = async () => {
    if (!db || !memberToRemove || isActionPending) return;
    setIsActionPending(true)
    try {
      await updateDoc(doc(db, 'members', memberToRemove.id), {
        chitGroup: ""
      })
      toast({ title: "Member Removed", description: `${memberToRemove.name} removed from this round.` })
      setIsRemoveMemberDialogOpen(false)
      restoreInteraction(false)
      setMemberToRemove(null)
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message || "Failed to remove member." })
    } finally {
      setIsActionPending(false)
    }
  }

  const currentRound = chitSchemes.find(r => r.id === selectedChitId)
  const assignedMembers = (members || []).filter(m => m.chitGroup === currentRound?.name)

  const getLastPayment = (memberId: string) => {
    if (!payments) return null;
    const memberPaidPayments = payments
      .filter(p => p.memberId === memberId && (p.status === 'paid' || p.status === 'success'))
      .sort((a, b) => {
        const dateA = a.paymentDate ? new Date(a.paymentDate).getTime() : 0;
        const dateB = b.paymentDate ? new Date(b.paymentDate).getTime() : 0;
        return dateB - dateA;
      });
    return memberPaidPayments.length > 0 ? memberPaidPayments[0] : null;
  }

  if (isRoleLoading || isRoundsLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!selectedChitId) {
    return (
      <div className="space-y-8 animate-in fade-in duration-500 pb-10">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-headline font-bold">Chit Rounds</h2>
            <p className="text-muted-foreground">Manage your active and historical chit schemes.</p>
          </div>
          <Button className="h-11 shadow-lg" onClick={() => setIsAddChitDialogOpen(true)}><Plus className="mr-2 size-5" /> Add Chit Round</Button>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {chitSchemes.map((group) => (
            <Card key={group.id} className="hover:shadow-lg transition-all border-border/50 overflow-hidden">
              <CardHeader className="bg-muted/30">
                <div className="flex justify-between">
                  <Badge variant="outline">{group.duration} Mo</Badge>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreVertical className="size-4" /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={(e) => { 
                        e.preventDefault(); 
                        setEditingChit({...group}); 
                        setIsEditChitDialogOpen(true); 
                      }}>
                        <Pencil className="mr-2 size-4" /> Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive" onSelect={(e) => { 
                        e.preventDefault(); 
                        setChitToDelete(group); 
                        setIsDeleteDialogOpen(true); 
                      }}>
                        <Trash2 className="mr-2 size-4" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <CardTitle className="text-xl mt-2">{group.name}</CardTitle>
                <CardDescription>Starts: {group.startDate}</CardDescription>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-emerald-600">Dues: ₹{group.monthlyAmount?.toLocaleString()}</span>
                  <span className="text-muted-foreground">Members: {(members || []).filter(m => m.chitGroup === group.name).length} / {group.totalMembers}</span>
                </div>
              </CardContent>
              <CardFooter className="bg-muted/10 border-t p-0">
                <Button variant="ghost" className="w-full h-12 rounded-none hover:bg-primary hover:text-primary-foreground transition-colors" onClick={() => setSelectedChitId(group.id)}>View Round Details</Button>
              </CardFooter>
            </Card>
          ))}
        </div>

        {/* Add Dialog */}
        <Dialog open={isAddChitDialogOpen} onOpenChange={(open) => {
          setIsAddChitDialogOpen(open)
          restoreInteraction(open)
        }}>
          <DialogContent className="sm:max-w-[425px] max-h-[90vh] overflow-y-auto focus:outline-none">
            {isAddChitDialogOpen && (
              <form onSubmit={handleAddChit}>
                <DialogHeader><DialogTitle>Add Chit Round</DialogTitle></DialogHeader>
                <div className="grid gap-4 py-6">
                  <div className="grid gap-2">
                    <Label htmlFor="name">Chit Name</Label>
                    <Input disabled={isActionPending} id="name" value={newChit.name} onChange={e => setNewChit({...newChit, name: e.target.value})} required />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label>Monthly Amount (₹)</Label>
                      <Input disabled={isActionPending} type="number" value={newChit.monthlyAmount} onChange={e => setNewChit({...newChit, monthlyAmount: Number(e.target.value)})} required />
                    </div>
                    <div className="grid gap-2">
                      <Label>Total Members</Label>
                      <Input disabled={isActionPending} type="number" value={newChit.totalMembers} onChange={e => setNewChit({...newChit, totalMembers: Number(e.target.value)})} required />
                    </div>
                  </div>
                </div>
                <DialogFooter className="sticky bottom-0 bg-background pt-2">
                  <Button type="button" variant="outline" onClick={() => { setIsAddChitDialogOpen(false); restoreInteraction(false); }} disabled={isActionPending}>Cancel</Button>
                  <Button type="submit" disabled={isActionPending}>
                    {isActionPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                    Create
                  </Button>
                </DialogFooter>
              </form>
            )}
          </DialogContent>
        </Dialog>

        {/* Edit Dialog */}
        <Dialog open={isEditChitDialogOpen} onOpenChange={(open) => {
          setIsEditChitDialogOpen(open)
          restoreInteraction(open)
          if (!open) setEditingChit(null)
        }}>
          <DialogContent className="sm:max-w-[425px] max-h-[90vh] overflow-y-auto focus:outline-none">
            {isEditChitDialogOpen && (
              <form onSubmit={handleEditChit}>
                <DialogHeader><DialogTitle>Edit Scheme</DialogTitle></DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label>Name</Label>
                    <Input disabled={isActionPending} value={editingChit?.name} onChange={e => setEditingChit({...editingChit, name: e.target.value})} required />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label>Monthly Amount (₹)</Label>
                      <Input disabled={isActionPending} type="number" value={editingChit?.monthlyAmount} onChange={e => setEditingChit({...editingChit, monthlyAmount: Number(e.target.value)})} required />
                    </div>
                    <div className="grid gap-2">
                      <Label>Total Members</Label>
                      <Input disabled={isActionPending} type="number" value={editingChit?.totalMembers} onChange={e => setEditingChit({...editingChit, totalMembers: Number(e.target.value)})} required />
                    </div>
                  </div>
                </div>
                <DialogFooter className="sticky bottom-0 bg-background pt-2">
                  <Button type="button" variant="outline" onClick={() => { setIsEditChitDialogOpen(false); restoreInteraction(false); }} disabled={isActionPending}>Cancel</Button>
                  <Button type="submit" disabled={isActionPending}>
                    {isActionPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                    Save Changes
                  </Button>
                </DialogFooter>
              </form>
            )}
          </DialogContent>
        </Dialog>

        {/* Delete Dialog */}
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={(open) => {
          setIsDeleteDialogOpen(open)
          restoreInteraction(open)
          if (!open) setChitToDelete(null)
        }}>
          <AlertDialogContent className="focus:outline-none">
            {isDeleteDialogOpen && (
              <>
                <AlertDialogHeader><AlertDialogTitle>Delete Chit Round?</AlertDialogTitle><AlertDialogDescription>This will permanently remove the scheme.</AlertDialogDescription></AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel onClick={() => { setIsDeleteDialogOpen(false); restoreInteraction(false); }} disabled={isActionPending}>Cancel</AlertDialogCancel>
                  <AlertDialogAction 
                    className="bg-destructive hover:bg-destructive/90" 
                    disabled={isActionPending}
                    onClick={(e) => {
                      e.preventDefault()
                      confirmDelete()
                    }}
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

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-10">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => setSelectedChitId(null)} className="rounded-full h-10 w-10">
          <ChevronLeft className="size-6" />
        </Button>
        <div>
          <h2 className="text-2xl font-bold font-headline">{currentRound?.name}</h2>
          <p className="text-sm text-muted-foreground">Chit Scheme Detail Dashboard</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="border-l-4 border-l-primary shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Assigned Members</CardTitle></CardHeader>
          <CardContent>
            <div className="text-3xl font-bold flex items-center gap-2">
              <Users className="size-5 text-primary" />
              {assignedMembers.length}
            </div>
            <p className="text-[10px] uppercase font-bold text-muted-foreground mt-1">Capacity: {currentRound?.totalMembers}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-emerald-500 shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Monthly Contribution</CardTitle></CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-emerald-600">₹{currentRound?.monthlyAmount?.toLocaleString()}</div>
            <p className="text-[10px] uppercase font-bold text-muted-foreground mt-1">Per Member</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-amber-500 shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Scheme Duration</CardTitle></CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{currentRound?.duration} Months</div>
            <p className="text-[10px] uppercase font-bold text-muted-foreground mt-1">Start: {currentRound?.startDate}</p>
          </CardContent>
        </Card>
      </div>

      <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
        <div className="p-6 border-b bg-muted/30 flex justify-between items-center">
          <h3 className="font-bold flex items-center gap-2">
            <Users className="size-5 text-primary" />
            Active Participants
          </h3>
          <Badge variant="secondary" className="font-bold">{assignedMembers.length} Members</Badge>
        </div>
        <Table>
          <TableHeader className="bg-muted/10">
            <TableRow>
              <TableHead className="font-semibold">Member</TableHead>
              <TableHead className="font-semibold">Phone</TableHead>
              <TableHead className="font-semibold">Last Paid</TableHead>
              <TableHead className="font-semibold">Total Paid</TableHead>
              <TableHead className="font-semibold">Status</TableHead>
              <TableHead className="w-[80px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {assignedMembers.length > 0 ? assignedMembers.map((member) => {
              const lastPayment = getLastPayment(member.id);
              return (
                <TableRow key={member.id} className="hover:bg-muted/5 transition-colors">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                        {member.name.split(' ').map((n: string) => n[0]).join('')}
                      </div>
                      <span className="font-medium text-sm">{member.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <Phone className="size-3.5" />
                      {member.phone}
                    </div>
                  </TableCell>
                  <TableCell>
                    {lastPayment ? (
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-emerald-600">₹{lastPayment.amountPaid?.toLocaleString()}</span>
                        <span className="text-[10px] text-muted-foreground">{format(parseISO(lastPayment.paymentDate), 'MMM dd')}</span>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground italic">None</span>
                    )}
                  </TableCell>
                  <TableCell className="font-bold text-sm text-primary">₹{(member.totalPaid || 0).toLocaleString()}</TableCell>
                  <TableCell>
                    <Badge variant={member.paymentStatus === 'paid' || member.paymentStatus === 'success' ? 'default' : 'secondary'} className={member.paymentStatus === 'paid' || member.paymentStatus === 'success' ? 'bg-emerald-500' : ''}>
                      {member.paymentStatus === 'paid' || member.paymentStatus === 'success' ? 'Success' : 'Pending'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="size-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={(e) => { 
                          e.preventDefault(); 
                          setHistoryMember(member); 
                          setIsHistoryDialogOpen(true); 
                        }}>
                          <History className="mr-2 size-4" /> Payment History
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={(e) => { 
                          e.preventDefault(); 
                          toast({ title: "Edit Member", description: "Use the main Members list to edit details." }) 
                        }}>
                          <Pencil className="mr-2 size-4" /> Edit Details
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive" onSelect={(e) => { 
                          e.preventDefault(); 
                          setMemberToRemove(member); 
                          setIsRemoveMemberDialogOpen(true); 
                        }}>
                          <Trash2 className="mr-2 size-4" /> Remove from Round
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              )
            }) : (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center text-muted-foreground italic">
                  No members assigned to this round yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* History Dialog */}
      <Dialog open={isHistoryDialogOpen} onOpenChange={(open) => {
        setIsHistoryDialogOpen(open)
        restoreInteraction(open)
        if (!open) setHistoryMember(null)
      }}>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto focus:outline-none">
          {isHistoryDialogOpen && (
            <>
              <DialogHeader><DialogTitle>Payment History: {historyMember?.name}</DialogTitle></DialogHeader>
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
                    {historyMember && (payments || []).filter(p => p.memberId === historyMember.id && (p.status === 'paid' || p.status === 'success')).map((p, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-sm">{p.month}</TableCell>
                        <TableCell className="text-sm font-bold text-emerald-600">₹{p.amountPaid?.toLocaleString()}</TableCell>
                        <TableCell className="text-sm text-right text-muted-foreground">{p.paymentDate ? format(parseISO(p.paymentDate), 'MMM dd') : '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <DialogFooter className="sticky bottom-0 bg-background pt-2 border-t">
                <Button onClick={() => { setIsHistoryDialogOpen(false); restoreInteraction(false); }}>Close</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Remove Member Dialog */}
      <AlertDialog open={isRemoveMemberDialogOpen} onOpenChange={(open) => {
        setIsRemoveMemberDialogOpen(open)
        restoreInteraction(open)
        if (!open) setMemberToRemove(null)
      }}>
        <AlertDialogContent className="focus:outline-none">
          {isRemoveMemberDialogOpen && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Remove from Scheme?</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to remove {memberToRemove?.name} from {currentRound?.name}? This will clear their assignment but preserve historical data.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => { setIsRemoveMemberDialogOpen(false); restoreInteraction(false); }} disabled={isActionPending}>Cancel</AlertDialogCancel>
                <AlertDialogAction 
                  className="bg-destructive hover:bg-destructive/90" 
                  disabled={isActionPending}
                  onClick={(e) => {
                    e.preventDefault()
                    confirmRemoveMember()
                  }}
                >
                  {isActionPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                  Confirm Remove
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
