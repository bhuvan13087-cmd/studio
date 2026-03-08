
"use client"

import { useState } from "react"
import { Plus, Search, UserPlus, MoreVertical, Phone, Calendar, UserCheck, UserMinus } from "lucide-react"
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

const initialMembers = [
  { id: "1", name: "John Doe", phone: "+91 98765 43210", joinDate: "2023-01-15", monthlyAmount: 5000, status: "active" },
  { id: "2", name: "Sarah Smith", phone: "+91 98765 43211", joinDate: "2023-02-10", monthlyAmount: 5000, status: "active" },
  { id: "3", name: "Michael Chen", phone: "+91 98765 43212", joinDate: "2023-03-05", monthlyAmount: 5000, status: "inactive" },
  { id: "4", name: "Emma Watson", phone: "+91 98765 43213", joinDate: "2023-04-20", monthlyAmount: 5000, status: "active" },
  { id: "5", name: "Robert Wilson", phone: "+91 98765 43214", joinDate: "2023-05-12", monthlyAmount: 5000, status: "active" },
]

export default function MembersPage() {
  const [members, setMembers] = useState(initialMembers)
  const [searchTerm, setSearchTerm] = useState("")
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const { toast } = useToast()

  const [newMember, setNewMember] = useState({
    name: "",
    phone: "",
    monthlyAmount: 5000,
    joinDate: new Date().toISOString().split('T')[0],
    status: "active"
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
      status: "active"
    })
    toast({
      title: "Member Added",
      description: `${newMember.name} has been successfully registered.`,
    })
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
              <TableHead className="font-semibold">Join Date</TableHead>
              <TableHead className="font-semibold">Monthly Amount</TableHead>
              <TableHead className="font-semibold">Status</TableHead>
              <TableHead className="w-[100px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredMembers.length > 0 ? (
              filteredMembers.map((member) => (
                <TableRow key={member.id} className="hover:bg-muted/10 transition-colors">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary text-primary font-bold">
                        {member.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <span className="font-medium">{member.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Phone className="size-3.5" />
                      {member.phone}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Calendar className="size-3.5" />
                      {member.joinDate}
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">₹{member.monthlyAmount.toLocaleString()}</TableCell>
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
                        <DropdownMenuItem>View Profile</DropdownMenuItem>
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
                <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                  No members found matching your search.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
