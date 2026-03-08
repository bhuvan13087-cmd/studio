
"use client"

import { useState } from "react"
import { Plus, Search, UserPlus, MoreVertical, Phone, Calendar, UserCheck, UserMinus, Download, FileText, CheckCircle2, AlertCircle, Info, History, Clock } from "lucide-react"
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
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { useToast } from "@/hooks/use-toast"
import { Card, CardContent } from "@/components/ui/card"

const initialMembers = [
  { id: "1", name: "John Doe", phone: "+91 98765 43210", joinDate: "2023-01-15", monthlyAmount: 5000, status: "active", paymentStatus: "paid", totalPaid: 45000, pendingAmount: 0 },
  { id: "2", name: "Sarah Smith", phone: "+91 98765 43211", joinDate: "2023-02-10", monthlyAmount: 5000, status: "active", paymentStatus: "paid", totalPaid: 40000, pendingAmount: 0 },
  { id: "3", name: "Michael Chen", phone: "+91 98765 43212", joinDate: "2023-03-05", monthlyAmount: 5000, status: "inactive", paymentStatus: "pending", totalPaid: 30000, pendingAmount: 5000 },
  { id: "4", name: "Emma Watson", phone: "+91 98765 43213", joinDate: "2023-04-20", monthlyAmount: 5000, status: "active", paymentStatus: "pending", totalPaid: 25000, pendingAmount: 5000 },
  { id: "5", name: "Robert Wilson", phone: "+91 98765 43214", joinDate: "2023-05-12", monthlyAmount: 5000, status: "active", paymentStatus: "paid", totalPaid: 20000, pendingAmount: 0 },
]

// Mock data for payment history based on memberId
const memberPaymentHistory: Record<string, any[]> = {
  "1": [
    { month: "September 2023", amount: 5000, status: "paid", date: "2023-09-05" },
    { month: "August 2023", amount: 5000, status: "paid", date: "2023-08-04" },
    { month: "July 2023", amount: 5000, status: "paid", date: "2023-07-06" },
  ],
  "2": [
    { month: "September 2023", amount: 5000, status: "paid", date: "2023-09-07" },
    { month: "August 2023", amount: 5000, status: "paid", date: "2023-08-08" },
  ],
  "3": [
    { month: "September 2023", amount: 5000, status: "pending", date: "-" },
    { month: "August 2023", amount: 5000, status: "paid", date: "2023-08-15" },
  ],
  "4": [
    { month: "September 2023", amount: 5000, status: "pending", date: "-" },
  ],
  "5": [
    { month: "September 2023", amount: 5000, status: "paid", date: "2023-09-15" },
  ],
}

export default function MembersPage() {
  const [members, setMembers] = useState(initialMembers)
  const [searchTerm, setSearchTerm] = useState("")
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [selectedMember, setSelectedMember] = useState<typeof initialMembers[0] | null>(null)
  const [isProfileDialogOpen, setIsProfileDialogOpen] = useState(false)
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false)
  const [historyMember, setHistoryMember] = useState<typeof initialMembers[0] | null>(null)
  const { toast } = useToast()

  const [newMember, setNewMember] = useState({
    name: "",
    phone: "",
    monthlyAmount: 5000,
    joinDate: new Date().toISOString().split('T')[0],
    status: "active",
    paymentStatus: "pending",
    totalPaid: 0,
    pendingAmount: 0
  })

  const handleAddMember = (e: React.FormEvent) => {
    e.preventDefault()
    const id = (members.length + 1).toString()
    setMembers([...members, { id, ...newMember }])
    setIsAddDialogOpen(false)
    setNewMember({
      name: "",
      phone: "",
      monthlyAmount: 5000,
      joinDate: new Date().toISOString().split('T')[0],
      status: "active",
      paymentStatus: "pending",
      totalPaid: 0,
      pendingAmount: 0
    })
    toast({
      title: "Member Added",
      description: `${newMember.name} has been successfully registered.`,
    })
  }

  const exportMembersToCSV = () => {
    const headers = ["Name", "Phone", "Join Date", "Monthly Amount", "Status", "Total Paid", "Pending Amount"]
    const csvContent = [
      headers.join(","),
      ...members.map(m => [
        m.name,
        m.phone,
        m.joinDate,
        m.monthlyAmount,
        m.status,
        m.totalPaid,
        m.pendingAmount
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

  const handleMemberClick = (member: typeof initialMembers[0]) => {
    setSelectedMember(member)
    setIsProfileDialogOpen(true)
  }

  const handleHistoryClick = (member: typeof initialMembers[0]) => {
    setHistoryMember(member)
    setIsHistoryDialogOpen(true)
  }

  const filteredMembers = members.filter(member => 
    member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    member.phone.includes(searchTerm)
  )

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
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
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
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="amount">Monthly Contribution (₹)</Label>
                    <Input 
                      id="amount" 
                      type="number" 
                      value={newMember.monthlyAmount}
                      onChange={e => setNewMember({...newMember, monthlyAmount: Number(e.target.value)})}
                      required 
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
            {filteredMembers.length > 0 ? (
              filteredMembers.map((member) => (
                <TableRow key={member.id} className="hover:bg-muted/10 transition-colors">
                  <TableCell>
                    <div 
                      className="flex items-center gap-3 cursor-pointer group"
                      onClick={() => handleMemberClick(member)}
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary text-primary font-bold group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                        {member.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div className="flex flex-col">
                        <span className="font-medium group-hover:text-primary transition-colors">{member.name}</span>
                        <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Click to view profile</span>
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
                      <span className="text-xs font-semibold text-emerald-600">Paid: ₹{member.totalPaid.toLocaleString()}</span>
                      <span className="text-xs font-semibold text-amber-600">Due: ₹{member.pendingAmount.toLocaleString()}</span>
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
                        <DropdownMenuItem onClick={() => handleHistoryClick(member)}>
                           <History className="mr-2 size-4" /> Payment History
                        </DropdownMenuItem>
                        <DropdownMenuItem>Edit Details</DropdownMenuItem>
                        <DropdownMenuItem className={member.status === 'active' ? "text-destructive" : "text-emerald-600"}>
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
      <Dialog open={isProfileDialogOpen} onOpenChange={setIsProfileDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold">
                {selectedMember?.name.split(' ').map(n => n[0]).join('')}
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
                  <FileText className="size-4" /> Monthly Contribution
                </div>
                <span className="font-bold">₹{selectedMember?.monthlyAmount.toLocaleString()}</span>
              </div>
              
              <div className="flex items-center justify-between border-b pb-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle2 className="size-4 text-emerald-500" /> Total Paid to Date
                </div>
                <span className="font-bold text-emerald-600">₹{selectedMember?.totalPaid.toLocaleString()}</span>
              </div>

              <div className="flex items-center justify-between border-b pb-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <AlertCircle className="size-4 text-amber-500" /> Pending Balance
                </div>
                <span className="font-bold text-amber-600">₹{selectedMember?.pendingAmount.toLocaleString()}</span>
              </div>

              <div className="flex items-center justify-between border-b pb-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Info className="size-4" /> Current Month Status
                </div>
                <Badge variant={selectedMember?.paymentStatus === 'paid' ? 'default' : 'destructive'} className={selectedMember?.paymentStatus === 'paid' ? 'bg-emerald-500' : ''}>
                  {selectedMember?.paymentStatus?.toUpperCase()}
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
      <Dialog open={isHistoryDialogOpen} onOpenChange={setIsHistoryDialogOpen}>
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
                  {historyMember && memberPaymentHistory[historyMember.id]?.length > 0 ? (
                    memberPaymentHistory[historyMember.id].map((payment, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{payment.month}</TableCell>
                        <TableCell>₹{payment.amount.toLocaleString()}</TableCell>
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
                           {payment.date === '-' ? (
                             <span className="flex items-center justify-end gap-1 text-amber-600">
                               <Clock className="size-3" /> Awaiting
                             </span>
                           ) : payment.date}
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
