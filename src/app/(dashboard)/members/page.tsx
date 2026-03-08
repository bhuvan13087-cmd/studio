
"use client"

import { useState } from "react"
import { Plus, Search, UserPlus, MoreVertical, Phone, Calendar, UserCheck, UserMinus, Download, FileText, CheckCircle2, AlertCircle, Info, History, Clock, Pencil, Loader2, Trash2, IndianRupee } from "lucide-react"
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
import { Card, CardContent } from "@/components/ui/card"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, doc, serverTimestamp, query, orderBy, addDoc, updateDoc, deleteDoc } from "firebase/firestore"
import { useRole } from "@/hooks/use-role"
import { format, parseISO, isSameMonth } from "date-fns"

export default function MembersPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [selectedMember, setSelectedMember] = useState<any>(null)
  const [isProfileDialogOpen, setIsProfileDialogOpen] = useState(false)
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false)
  const [isDeleteMemberDialogOpen, setIsDeleteMemberDialogOpen] = useState(false)
  const [memberToDelete, setMemberToDelete] = useState<any>(null)
  const [historyMember, setHistoryMember] = useState<any>(null)
  const [isActionPending, setIsActionPending] = useState(false)
  const { toast } = useToast()
  
  const db = useFirestore()
  const { isAdmin, isLoading: isRoleLoading } = useRole()

  const membersQuery = useMemoFirebase(() => collection(db, 'members'), [db]);
  const { data: members, isLoading: isMembersLoading } = useCollection(membersQuery);

  const paymentsQuery = useMemoFirebase(() => query(collection(db, 'payments'), orderBy('paymentDate', 'desc')), [db]);
  const { data: payments } = useCollection(paymentsQuery);

  const chitRoundsQuery = useMemoFirebase(() => query(collection(db, 'chitRounds'), orderBy('createdAt', 'desc')), [db]);
  const { data: chitRounds } = useCollection(chitRoundsQuery);

  const [newMember, setNewMember] = useState({
    name: "",
    phone: "",
    monthlyAmount: 5000,
    joinDate: new Date().toISOString().split('T')[0],
    status: "active",
    paymentStatus: "pending",
    totalPaid: 0,
    pendingAmount: 0,
    chitGroup: ""
  })

  const restoreInteraction = (open: boolean) => {
    if (!open) {
      setTimeout(() => {
        document.body.style.pointerEvents = 'auto'
      }, 100)
    }
  }

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!db || isActionPending) return;

    setIsActionPending(true)
    try {
      await addDoc(collection(db, 'members'), {
        ...newMember,
        createdAt: serverTimestamp()
      })

      setIsAddDialogOpen(false)
      setNewMember({
        name: "",
        phone: "",
        monthlyAmount: 5000,
        joinDate: new Date().toISOString().split('T')[0],
        status: "active",
        paymentStatus: "pending",
        totalPaid: 0,
        pendingAmount: 0,
        chitGroup: ""
      })
      toast({
        title: "Member Added",
        description: `${newMember.name} has been successfully registered.`,
      })
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to add member.",
      })
    } finally {
      setIsActionPending(false)
    }
  }

  const confirmDeleteMember = async () => {
    if (!db || !memberToDelete || isActionPending) return
    
    setIsActionPending(true)
    try {
      await deleteDoc(doc(db, 'members', memberToDelete.id))
      toast({
        title: "Member Deleted",
        description: `${memberToDelete.name} has been removed from the system.`,
      })
      setIsDeleteMemberDialogOpen(false)
      setMemberToDelete(null)
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to delete member.",
      })
    } finally {
      setIsActionPending(false)
    }
  }

  const filteredMembers = (members || []).filter(member => 
    member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    member.phone.includes(searchTerm)
  )

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

  if (isRoleLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-headline font-bold tracking-tight">Members</h2>
          <p className="text-muted-foreground">Manage your chit fund community members.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
            setIsAddDialogOpen(open)
            restoreInteraction(open)
          }}>
            <DialogTrigger asChild>
              <Button className="h-11 px-6 shadow-lg hover:shadow-xl transition-all">
                <UserPlus className="mr-2 size-5" />
                Add New Member
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <form onSubmit={handleAddMember}>
                <DialogHeader>
                  <DialogTitle>Register Member</DialogTitle>
                  <DialogDescription>
                    Enter the details for the new chit fund participant.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-6">
                  <div className="grid gap-2">
                    <Label htmlFor="name">Full Name</Label>
                    <Input 
                      id="name" 
                      placeholder="Enter name" 
                      value={newMember.name}
                      onChange={e => setNewMember({...newMember, name: e.target.value})}
                      required 
                      disabled={isActionPending}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input 
                      id="phone" 
                      placeholder="+91 00000 00000" 
                      value={newMember.phone}
                      onChange={e => setNewMember({...newMember, phone: e.target.value})}
                      required 
                      disabled={isActionPending}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="chitGroup">Chit Group</Label>
                    <Select 
                      disabled={isActionPending}
                      value={newMember.chitGroup} 
                      onValueChange={v => setNewMember({...newMember, chitGroup: v})}
                    >
                      <SelectTrigger id="chitGroup">
                        <SelectValue placeholder="Select a chit group" />
                      </SelectTrigger>
                      <SelectContent>
                        {chitRounds?.map((round: any) => (
                          <SelectItem key={round.id} value={round.name}>
                            {round.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="amount">Monthly Contribution (₹)</Label>
                    <Input 
                      id="amount" 
                      type="number" 
                      value={newMember.monthlyAmount}
                      onChange={e => setNewMember({...newMember, monthlyAmount: Number(e.target.value)})}
                      required 
                      disabled={isActionPending}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="joinDate">Join Date</Label>
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
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)} disabled={isActionPending}>Cancel</Button>
                  <Button type="submit" disabled={isActionPending}>
                    {isActionPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                    Add Member
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="flex items-center space-x-2 bg-card p-4 rounded-xl shadow-sm border border-border/50">
        <Search className="size-5 text-muted-foreground" />
        <Input
          placeholder="Search by name or phone..."
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
              <TableHead className="font-semibold">Phone</TableHead>
              <TableHead className="font-semibold">Payment Status</TableHead>
              <TableHead className="font-semibold">Monthly Amount</TableHead>
              <TableHead className="font-semibold">Balance Summary</TableHead>
              <TableHead className="font-semibold">Status</TableHead>
              <TableHead className="w-[100px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isMembersLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center text-muted-foreground animate-pulse">
                  Loading members...
                </TableCell>
              </TableRow>
            ) : filteredMembers.length > 0 ? (
              filteredMembers.map((member) => {
                const lastPayment = getLastPayment(member.id);
                // Source of truth: Determine if paid based on existence of recent payment or direct status
                const isPaid = member.paymentStatus === 'paid' || member.paymentStatus === 'success' || !!lastPayment;
                
                return (
                  <TableRow key={member.id} className="hover:bg-muted/10 transition-colors">
                    <TableCell>
                      <div 
                        className="flex items-center gap-3 cursor-pointer group"
                        onClick={() => {
                          setSelectedMember(member)
                          setIsProfileDialogOpen(true)
                        }}
                      >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary text-primary font-bold group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                          {member.name.split(' ').map((n: string) => n[0]).join('')}
                        </div>
                        <div className="flex flex-col">
                          <span className="font-medium group-hover:text-primary transition-colors">{member.name}</span>
                          <span className="text-[10px] text-primary font-bold tracking-wider">{member.chitGroup}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Phone className="size-3.5" />
                        {member.phone}
                      </div>
                    </TableCell>
                    <TableCell>
                      {isPaid ? (
                        <Popover>
                          <PopoverTrigger asChild>
                            <button className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-all text-[10px] font-bold border border-emerald-200 uppercase tracking-wider shadow-sm">
                              <CheckCircle2 className="size-3" />
                              Success
                            </button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-4 shadow-xl border-border/50" align="start">
                            <div className="space-y-2">
                               <div className="flex items-center gap-2 text-emerald-600 font-bold text-sm">
                                <CheckCircle2 className="size-4" />
                                <span>Amount: ₹{lastPayment?.amountPaid?.toLocaleString() || 'Record Found'}</span>
                              </div>
                              <div className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">
                                Last Date: {lastPayment ? format(parseISO(lastPayment.paymentDate), 'MMM dd, yyyy') : 'Recently recorded'}
                              </div>
                              <div className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">
                                Period: {lastPayment?.month || 'Current Cycle'}
                              </div>
                            </div>
                          </PopoverContent>
                        </Popover>
                      ) : (
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-50 text-amber-700 text-[10px] font-bold border border-amber-200 uppercase tracking-wider shadow-sm w-fit">
                          <Clock className="size-3" />
                          Pending
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">₹{member.monthlyAmount.toLocaleString()}</TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs font-semibold text-emerald-600">Paid: ₹{(member.totalPaid || 0).toLocaleString()}</span>
                        <span className="text-xs font-semibold text-amber-600">Due: ₹{(member.pendingAmount || 0).toLocaleString()}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant={member.status === 'active' ? 'default' : 'secondary'}
                        className={member.status === 'active' ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-muted text-muted-foreground'}
                      >
                        {member.status.charAt(0).toUpperCase() + member.status.slice(1)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onSelect={(e) => {
                            e.preventDefault()
                            setHistoryMember(member)
                            setIsHistoryDialogOpen(true)
                          }}>
                             <History className="mr-2 size-4" /> Payment History
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={(e) => {
                            e.preventDefault()
                            toast({ title: "Edit Member", description: "Editing enabled in next update." })
                          }}>
                             <Pencil className="mr-2 size-4" /> Edit Details
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            className="text-destructive" 
                            onSelect={(e) => {
                              e.preventDefault()
                              setMemberToDelete(member)
                              setIsDeleteMemberDialogOpen(true)
                            }}
                          >
                            <Trash2 className="mr-2 size-4" /> Delete Member
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                )
              })
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                  No members found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Member Profile Dialog */}
      <Dialog open={isProfileDialogOpen} onOpenChange={(open) => {
        setIsProfileDialogOpen(open)
        restoreInteraction(open)
        if (!open) setSelectedMember(null)
      }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold">
                {selectedMember?.name?.split(' ').map((n: string) => n[0]).join('')}
              </div>
              Member Profile
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-6 py-4">
            <div className="grid grid-cols-2 gap-4">
              <Card className="bg-muted/30 border-none">
                <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                  <Phone className="size-4 text-primary mb-1" />
                  <span className="text-[10px] text-muted-foreground uppercase font-bold">Phone</span>
                  <span className="font-semibold text-sm">{selectedMember?.phone}</span>
                </CardContent>
              </Card>
              <Card className="bg-muted/30 border-none">
                <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                  <Calendar className="size-4 text-primary mb-1" />
                  <span className="text-[10px] text-muted-foreground uppercase font-bold">Joined</span>
                  <span className="font-semibold text-sm">
                    {selectedMember?.joinDate ? format(parseISO(selectedMember.joinDate), 'MMM dd, yyyy') : '-'}
                  </span>
                </CardContent>
              </Card>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between border-b pb-2 text-sm">
                <span className="text-muted-foreground">Chit Group</span>
                <span className="font-bold">{selectedMember?.chitGroup}</span>
              </div>
              <div className="flex justify-between border-b pb-2 text-sm">
                <span className="text-muted-foreground">Total Paid</span>
                <span className="font-bold text-emerald-600">₹{(selectedMember?.totalPaid || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between border-b pb-2 text-sm">
                <span className="text-muted-foreground">Last Payment</span>
                <span className="font-bold text-emerald-600">
                  {selectedMember && getLastPayment(selectedMember.id) 
                    ? format(parseISO(getLastPayment(selectedMember.id).paymentDate), 'MMM dd, yyyy') 
                    : 'No record'}
                </span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsProfileDialogOpen(false)
              setHistoryMember(selectedMember)
              setIsHistoryDialogOpen(true)
            }}>View History</Button>
            <Button onClick={() => setIsProfileDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* History Dialog */}
      <Dialog open={isHistoryDialogOpen} onOpenChange={(open) => {
        setIsHistoryDialogOpen(open)
        restoreInteraction(open)
        if (!open) setHistoryMember(null)
      }}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Payment History: {historyMember?.name}</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Month</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {historyMember && (payments || []).filter(p => p.memberId === historyMember.id && (p.status === 'paid' || p.status === 'success')).map((payment, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{payment.month}</TableCell>
                    <TableCell>₹{payment.amountPaid?.toLocaleString()}</TableCell>
                    <TableCell><Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Success</Badge></TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {payment.paymentDate ? format(parseISO(payment.paymentDate), 'MMM dd, yyyy') : '-'}
                    </TableCell>
                  </TableRow>
                ))}
                {(!historyMember || (payments || []).filter(p => p.memberId === historyMember.id && (p.status === 'paid' || p.status === 'success')).length === 0) && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground italic py-8">
                      No successful payments recorded.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={isDeleteMemberDialogOpen} onOpenChange={(open) => {
        setIsDeleteMemberDialogOpen(open)
        restoreInteraction(open)
        if (!open) setMemberToDelete(null)
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Member?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently remove {memberToDelete?.name} and all associated data.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setIsDeleteMemberDialogOpen(false)} disabled={isActionPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              className="bg-destructive hover:bg-destructive/90" 
              onClick={(e) => {
                e.preventDefault()
                confirmDeleteMember()
              }}
              disabled={isActionPending}
            >
              {isActionPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
