"use client"

import { useState } from "react"
import { Plus, Search, UserPlus, MoreVertical, Phone, Calendar, UserCheck, UserMinus, Download, FileText, CheckCircle2, AlertCircle, Info, History, Clock, Pencil, Loader2 } from "lucide-react"
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { useToast } from "@/hooks/use-toast"
import { Card, CardContent } from "@/components/ui/card"
import { useFirestore, useCollection, useMemoFirebase, addDocumentNonBlocking, updateDocumentNonBlocking } from "@/firebase"
import { collection, query, doc, serverTimestamp } from "firebase/firestore"
import { useRole } from "@/hooks/use-role"

export default function MembersPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [selectedMember, setSelectedMember] = useState<any>(null)
  const [isProfileDialogOpen, setIsProfileDialogOpen] = useState(false)
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false)
  const [historyMember, setHistoryMember] = useState<any>(null)
  const { toast } = useToast()
  
  const db = useFirestore()
  const { isAdmin, isLoading: isRoleLoading } = useRole()

  const membersQuery = useMemoFirebase(() => {
    if (!db || !isAdmin) return null;
    return collection(db, 'members');
  }, [db, isAdmin]);

  const { data: members, isLoading: isMembersLoading } = useCollection(membersQuery);

  const paymentsQuery = useMemoFirebase(() => {
    if (!db || !isAdmin) return null;
    return collection(db, 'payments');
  }, [db, isAdmin]);

  const { data: payments } = useCollection(paymentsQuery);

  const chitRoundsQuery = useMemoFirebase(() => {
    if (!db || !isAdmin) return null;
    return collection(db, 'chitRounds');
  }, [db, isAdmin]);

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

  const handleAddMember = (e: React.FormEvent) => {
    e.preventDefault()
    if (!db) return;

    const memberId = Math.random().toString(36).substr(2, 9)
    addDocumentNonBlocking(collection(db, 'members'), {
      ...newMember,
      id: memberId,
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
  }

  const exportMembersToCSV = () => {
    if (!members) return;
    const headers = ["Name", "Phone", "Join Date", "Monthly Amount", "Status", "Total Paid", "Pending Amount", "Chit Group"]
    const csvContent = [
      headers.join(","),
      ...members.map(m => [
        m.name,
        m.phone,
        m.joinDate,
        m.monthlyAmount,
        m.status,
        m.totalPaid,
        m.pendingAmount,
        m.chitGroup
      ].join(","))
    ].join("\n")

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement("a")
    const url = URL.createObjectURL(blob)
    link.setAttribute("href", url)
    link.setAttribute("download", "members_list.csv")
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    
    toast({
      title: "Export Successful",
      description: "Member list has been downloaded as CSV.",
    })
  }

  const handleMemberClick = (member: any) => {
    setSelectedMember(member)
    setIsProfileDialogOpen(true)
  }

  const handleHistoryClick = (member: any) => {
    setHistoryMember(member)
    setIsHistoryDialogOpen(true)
  }

  const toggleStatus = (member: any) => {
    if (!db) return;
    const newStatus = member.status === 'active' ? 'inactive' : 'active'
    updateDocumentNonBlocking(doc(db, 'members', member.id), { status: newStatus })
    toast({
      title: "Status Updated",
      description: `${member.name} is now ${newStatus}.`
    })
  }

  const filteredMembers = (members || []).filter(member => 
    member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    member.phone.includes(searchTerm)
  )

  if (isRoleLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4 text-center">
        <AlertCircle className="size-12 text-amber-500" />
        <h2 className="text-xl font-bold">Administrative Access Required</h2>
        <p className="text-muted-foreground max-w-md">
          This page is restricted to administrators.
        </p>
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
          <Button variant="outline" onClick={exportMembersToCSV} className="h-11">
            <Download className="mr-2 size-4" />
            Export CSV
          </Button>
          <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
            setIsAddDialogOpen(open)
            if (!open) {
              document.body.style.pointerEvents = 'auto';
            }
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
                    <input 
                      id="name" 
                      placeholder="Enter name" 
                      value={newMember.name}
                      onChange={e => setNewMember({...newMember, name: e.target.value})}
                      required 
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <input 
                      id="phone" 
                      placeholder="+91 00000 00000" 
                      value={newMember.phone}
                      onChange={e => setNewMember({...newMember, phone: e.target.value})}
                      required 
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="chitGroup">Chit Group</Label>
                    <Select 
                      value={newMember.chitGroup} 
                      onValueChange={v => setNewMember({...newMember, chitGroup: v})}
                    >
                      <SelectTrigger id="chitGroup">
                        <SelectValue placeholder="Select a chit group" />
                      </SelectTrigger>
                      <SelectContent>
                        {chitRounds?.filter((r: any) => r.name).map((round: any) => (
                          <SelectItem key={round.id} value={round.name}>
                            {round.name}
                          </SelectItem>
                        ))}
                        {(!chitRounds || chitRounds.length === 0) && (
                          <SelectItem value="none" disabled>No chit groups found</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="amount">Monthly Contribution (₹)</Label>
                    <input 
                      id="amount" 
                      type="number" 
                      value={newMember.monthlyAmount}
                      onChange={e => setNewMember({...newMember, monthlyAmount: Number(e.target.value)})}
                      required 
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="joinDate">Join Date</Label>
                    <input 
                      id="joinDate" 
                      type="date" 
                      value={newMember.joinDate}
                      onChange={e => setNewMember({...newMember, joinDate: e.target.value})}
                      required 
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
                  <Button type="submit">Add Member</Button>
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
              filteredMembers.map((member) => (
                <TableRow key={member.id} className="hover:bg-muted/10 transition-colors">
                  <TableCell>
                    <div 
                      className="flex items-center gap-3 cursor-pointer group"
                      onClick={() => handleMemberClick(member)}
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
                    {member.paymentStatus === 'paid' ? (
                      <Badge variant="outline" className="border-emerald-500 text-emerald-600 bg-emerald-50 gap-1">
                        <CheckCircle2 className="size-3" /> Paid
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="border-amber-500 text-amber-600 bg-amber-50 gap-1">
                        <AlertCircle className="size-3" /> Pending
                      </Badge>
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
                          handleHistoryClick(member)
                        }}>
                           <History className="mr-2 size-4" /> Payment History
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                           <Pencil className="mr-2 size-4" /> Edit Details
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          className={member.status === 'active' ? "text-destructive" : "text-emerald-600"} 
                          onSelect={(e) => {
                            e.preventDefault()
                            toggleStatus(member)
                          }}
                        >
                          {member.status === 'active' ? (
                            <><UserMinus className="mr-2 size-4" /> Deactivate</>
                          ) : (
                            <><UserCheck className="mr-2 size-4" /> Activate</>
                          )}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                  No members found matching your search.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Member Profile Dialog */}
      <Dialog open={isProfileDialogOpen} onOpenChange={(open) => {
        setIsProfileDialogOpen(open)
        if (!open) {
          setSelectedMember(null)
          document.body.style.pointerEvents = 'auto';
        }
      }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold">
                {selectedMember?.name?.split(' ').map((n: string) => n[0]).join('')}
              </div>
              Member Profile
            </DialogTitle>
            <DialogDescription>Detailed overview for {selectedMember?.name}</DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-6 py-4">
            <div className="grid grid-cols-2 gap-4">
              <Card className="bg-muted/30 border-none shadow-none">
                <CardContent className="p-4 flex flex-col items-center justify-center gap-1 text-center">
                  <Phone className="size-4 text-primary mb-1" />
                  <span className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Phone</span>
                  <span className="font-semibold">{selectedMember?.phone}</span>
                </CardContent>
              </Card>
              <Card className="bg-muted/30 border-none shadow-none">
                <CardContent className="p-4 flex flex-col items-center justify-center gap-1 text-center">
                  <Calendar className="size-4 text-primary mb-1" />
                  <span className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Joined</span>
                  <span className="font-semibold">{selectedMember?.joinDate}</span>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between border-b pb-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Info className="size-4" /> Associated Group
                </div>
                <span className="font-bold">{selectedMember?.chitGroup}</span>
              </div>
              
              <div className="flex items-center justify-between border-b pb-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <FileText className="size-4" /> Monthly Contribution
                </div>
                <span className="font-bold">₹{selectedMember?.monthlyAmount?.toLocaleString()}</span>
              </div>
              
              <div className="flex items-center justify-between border-b pb-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle2 className="size-4 text-emerald-500" /> Total Paid to Date
                </div>
                <span className="font-bold text-emerald-600">₹{(selectedMember?.totalPaid || 0).toLocaleString()}</span>
              </div>

              <div className="flex items-center justify-between border-b pb-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <AlertCircle className="size-4 text-amber-500" /> Pending Balance
                </div>
                <span className="font-bold text-amber-600">₹{(selectedMember?.pendingAmount || 0).toLocaleString()}</span>
              </div>

              <div className="flex items-center justify-between border-b pb-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Info className="size-4" /> Current Month Status
                </div>
                <Badge variant={selectedMember?.paymentStatus === 'paid' ? 'default' : 'destructive'} className={selectedMember?.paymentStatus === 'paid' ? 'bg-emerald-500' : ''}>
                  {selectedMember?.paymentStatus?.toUpperCase() || 'PENDING'}
                </Badge>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={() => setIsProfileDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Member Payment History Dialog */}
      <Dialog open={isHistoryDialogOpen} onOpenChange={(open) => {
        setIsHistoryDialogOpen(open)
        if (!open) {
          setHistoryMember(null)
          document.body.style.pointerEvents = 'auto';
        }
      }}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="size-5 text-primary" />
              Payment History: {historyMember?.name}
            </DialogTitle>
            <DialogDescription>Viewing all contribution records for this member.</DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead>Month</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Payment Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historyMember && (payments || []).filter(p => p.memberId === historyMember.id).length > 0 ? (
                    (payments || []).filter(p => p.memberId === historyMember.id).map((payment, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{payment.month}</TableCell>
                        <TableCell>₹{payment.amountPaid?.toLocaleString()}</TableCell>
                        <TableCell>
                          {payment.status === 'paid' ? (
                            <Badge variant="outline" className="border-emerald-500 text-emerald-600 bg-emerald-50">
                              Paid
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="border-amber-500 text-amber-600 bg-amber-50">
                              Pending
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground text-sm">
                           {!payment.paymentDate ? (
                             <span className="flex items-center justify-end gap-1 text-amber-600">
                               <Clock className="size-3" /> Awaiting
                             </span>
                           ) : new Date(payment.paymentDate).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} className="h-24 text-center text-muted-foreground italic">
                        No payment records found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsHistoryDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
