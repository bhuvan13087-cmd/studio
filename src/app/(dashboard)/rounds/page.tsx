"use client"

import { useState } from "react"
import { Trophy, History, Plus, Award, Calendar, IndianRupee, Users, CheckCircle2, MoreVertical, Search, UserCheck, ChevronLeft, LayoutGrid, ArrowRight, Loader2, AlertCircle, Database, FileText, Clock, Pencil, Trash2 } from "lucide-react"
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
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { useFirestore, useCollection, useMemoFirebase, addDocumentNonBlocking, updateDocumentNonBlocking, deleteDocumentNonBlocking } from "@/firebase"
import { collection, query, doc, serverTimestamp, orderBy } from "firebase/firestore"
import { useRole } from "@/hooks/use-role"

export default function RoundsPage() {
  const [selectedChitId, setSelectedChitId] = useState<string | null>(null)
  const [isAddChitDialogOpen, setIsAddChitDialogOpen] = useState(false)
  const [isEditChitDialogOpen, setIsEditChitDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [editingChit, setEditingChit] = useState<any>(null)
  const [chitToDelete, setChitToDelete] = useState<any>(null)
  
  const { toast } = useToast()
  const db = useFirestore()
  const { isAdmin, isLoading: isRoleLoading } = useRole()

  const roundsQuery = useMemoFirebase(() => query(collection(db, 'chitRounds'), orderBy('createdAt', 'desc')), [db]);
  const { data: roundsData, isLoading: isRoundsLoading } = useCollection(roundsQuery);
  const chitSchemes = roundsData || [];

  const membersQuery = useMemoFirebase(() => collection(db, 'members'), [db]);
  const { data: membersData, isLoading: isMembersLoading } = useCollection(membersQuery);

  const [newChit, setNewChit] = useState({
    name: "",
    monthlyAmount: 5000,
    totalMembers: 20,
    duration: 20,
    startDate: new Date().toISOString().split('T')[0],
    description: ""
  })

  const handleAddChit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!db) return

    addDocumentNonBlocking(collection(db, 'chitRounds'), {
      ...newChit,
      type: 'scheme',
      createdAt: serverTimestamp()
    })

    setIsAddChitDialogOpen(false)
    setNewChit({
      name: "",
      monthlyAmount: 5000,
      totalMembers: 20,
      duration: 20,
      startDate: new Date().toISOString().split('T')[0],
      description: ""
    })
    
    toast({
      title: "Chit Round Created Successfully",
      description: "Your new chit scheme is now active and ready for rounds.",
    })
  }

  const handleEditChit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!db || !editingChit) return

    updateDocumentNonBlocking(doc(db, 'chitRounds', editingChit.id), {
      name: editingChit.name,
      monthlyAmount: Number(editingChit.monthlyAmount),
      totalMembers: Number(editingChit.totalMembers),
      duration: Number(editingChit.duration),
      startDate: editingChit.startDate,
      description: editingChit.description || ""
    })

    setIsEditChitDialogOpen(false)
    setEditingChit(null)
    
    toast({
      title: "Chit Scheme Updated",
      description: "Changes have been saved successfully.",
    })
  }

  const handleDeleteClick = (chit: any) => {
    setChitToDelete(chit)
    setIsDeleteDialogOpen(true)
  }

  const confirmDelete = () => {
    if (!db || !chitToDelete) return;
    
    deleteDocumentNonBlocking(doc(db, 'chitRounds', chitToDelete.id));
    
    toast({
      title: "Chit Round Deleted Successfully",
      description: `${chitToDelete.name} has been removed.`,
    })
    setIsDeleteDialogOpen(false)
    setChitToDelete(null)
  }

  const openEditDialog = (chit: any) => {
    setEditingChit({ ...chit })
    setIsEditChitDialogOpen(true)
  }

  if (isRoleLoading || isRoundsLoading || isMembersLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    )
  }

  const activeSchemes = chitSchemes.filter(r => r.type === 'scheme' || (r.name && r.monthlyAmount));

  if (activeSchemes.length === 0 && !selectedChitId) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] space-y-6 animate-in fade-in duration-700">
        <Database className="size-20 text-muted-foreground/20" />
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold">No chit rounds available.</h2>
          <p className="text-muted-foreground max-w-sm">Click 'Add Chit Round' to create one and start managing your auctions.</p>
        </div>
        <Dialog open={isAddChitDialogOpen} onOpenChange={setIsAddChitDialogOpen}>
          <DialogTrigger asChild>
            <Button size="lg" className="h-12 px-8">
              <Plus className="mr-2 size-5" />
              Add Chit Round
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <form onSubmit={handleAddChit}>
              <DialogHeader>
                <DialogTitle>Add New Chit Round</DialogTitle>
                <DialogDescription>Define the parameters for a new chit fund scheme.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-6">
                <div className="grid gap-2">
                  <Label htmlFor="name">Chit Name</Label>
                  <Input 
                    id="name" 
                    placeholder="e.g. Premium Alpha 5K" 
                    value={newChit.name}
                    onChange={e => setNewChit({...newChit, name: e.target.value})}
                    required 
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="amount">Monthly Amount (₹)</Label>
                    <Input 
                      id="amount" 
                      type="number"
                      value={newChit.monthlyAmount}
                      onChange={e => setNewChit({...newChit, monthlyAmount: Number(e.target.value)})}
                      required 
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="members">Total Members</Label>
                    <Input 
                      id="members" 
                      type="number"
                      value={newChit.totalMembers}
                      onChange={e => setNewChit({...newChit, totalMembers: Number(e.target.value)})}
                      required 
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="duration">Duration (months)</Label>
                    <Input 
                      id="duration" 
                      type="number"
                      value={newChit.duration}
                      onChange={e => setNewChit({...newChit, duration: Number(e.target.value)})}
                      required 
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="startDate">Start Date</Label>
                    <Input 
                      id="startDate" 
                      type="date"
                      value={newChit.startDate}
                      onChange={e => setNewChit({...newChit, startDate: e.target.value})}
                      required 
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="description">Description (Optional)</Label>
                  <Textarea 
                    id="description" 
                    placeholder="Additional details about the scheme..." 
                    value={newChit.description}
                    onChange={e => setNewChit({...newChit, description: e.target.value})}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsAddChitDialogOpen(false)}>Cancel</Button>
                <Button type="submit">Create Chit Scheme</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    )
  }

  if (!selectedChitId) {
    return (
      <div className="space-y-8 animate-in fade-in duration-500 pb-10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-3xl font-headline font-bold tracking-tight">Chit Rounds</h2>
            <p className="text-muted-foreground">Manage and track your active chit schemes.</p>
          </div>
          <Dialog open={isAddChitDialogOpen} onOpenChange={setIsAddChitDialogOpen}>
            <DialogTrigger asChild>
              <Button className="h-11 px-6 shadow-lg hover:shadow-xl transition-all">
                <Plus className="mr-2 size-5" />
                Add Chit Round
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <form onSubmit={handleAddChit}>
                <DialogHeader>
                  <DialogTitle>Add New Chit Round</DialogTitle>
                  <DialogDescription>Define the parameters for a new chit fund scheme.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-6">
                  <div className="grid gap-2">
                    <Label htmlFor="name">Chit Name</Label>
                    <Input 
                      id="name" 
                      placeholder="e.g. Premium Alpha 5K" 
                      value={newChit.name}
                      onChange={e => setNewChit({...newChit, name: e.target.value})}
                      required 
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="amount">Monthly Amount (₹)</Label>
                      <Input 
                        id="amount" 
                        type="number"
                        value={newChit.monthlyAmount}
                        onChange={e => setNewChit({...newChit, monthlyAmount: Number(e.target.value)})}
                        required 
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="members">Total Members</Label>
                      <Input 
                        id="members" 
                        type="number"
                        value={newChit.totalMembers}
                        onChange={e => setNewChit({...newChit, totalMembers: Number(e.target.value)})}
                        required 
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="duration">Duration (months)</Label>
                      <Input 
                        id="duration" 
                        type="number"
                        value={newChit.duration}
                        onChange={e => setNewChit({...newChit, duration: Number(e.target.value)})}
                        required 
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="startDate">Start Date</Label>
                      <Input 
                        id="startDate" 
                        type="date"
                        value={newChit.startDate}
                        onChange={e => setNewChit({...newChit, startDate: e.target.value})}
                        required 
                      />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="description">Description (Optional)</Label>
                    <Textarea 
                      id="description" 
                      placeholder="Additional details about the scheme..." 
                      value={newChit.description}
                      onChange={e => setNewChit({...newChit, description: e.target.value})}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsAddChitDialogOpen(false)}>Cancel</Button>
                  <Button type="submit">Create Chit Scheme</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {activeSchemes.map((group) => (
            <Card key={group.id} className="hover:shadow-lg transition-all duration-300 border-border/50 overflow-hidden group">
              <CardHeader className="bg-muted/30 pb-4">
                <div className="flex justify-between items-start">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary mb-2">
                    <LayoutGrid className="size-5" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-background">
                      {group.duration} Months
                    </Badge>
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
                          e.preventDefault();
                          openEditDialog(group);
                        }}>
                          <Pencil className="mr-2 size-4" /> Edit Details
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          className="text-destructive focus:bg-destructive/10 focus:text-destructive" 
                          onSelect={(e) => {
                            e.preventDefault();
                            handleDeleteClick(group);
                          }}
                        >
                          <Trash2 className="mr-2 size-4" /> Delete Scheme
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
                <CardTitle className="text-xl group-hover:text-primary transition-colors">{group.name}</CardTitle>
                <CardDescription>Scheme defined on {group.startDate}</CardDescription>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Contribution</span>
                    <p className="font-bold text-lg">₹{group.monthlyAmount?.toLocaleString()}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Members</span>
                    <p className="font-bold text-lg">{group.totalMembers}</p>
                  </div>
                </div>
                {group.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2 italic">
                    "{group.description}"
                  </p>
                )}
              </CardContent>
              <CardFooter className="bg-muted/10 border-t pt-4">
                <Button variant="ghost" className="w-full group" onClick={() => setSelectedChitId(group.id)}>
                  View Details
                  <ArrowRight className="ml-2 size-4 group-hover:translate-x-1 transition-transform" />
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>

        {/* Edit Chit Dialog */}
        <Dialog open={isEditChitDialogOpen} onOpenChange={(open) => {
          setIsEditChitDialogOpen(open);
          if (!open) setEditingChit(null);
        }}>
          <DialogContent className="sm:max-w-[425px]">
            <form onSubmit={handleEditChit}>
              <DialogHeader>
                <DialogTitle>Edit Chit Scheme</DialogTitle>
                <DialogDescription>Modify the details of your chit scheme.</DialogDescription>
              </DialogHeader>
              {editingChit && (
                <div className="grid gap-4 py-6">
                  <div className="grid gap-2">
                    <Label htmlFor="edit-name">Chit Name</Label>
                    <Input 
                      id="edit-name" 
                      value={editingChit.name}
                      onChange={e => setEditingChit({...editingChit, name: e.target.value})}
                      required 
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="edit-amount">Monthly Amount (₹)</Label>
                      <Input 
                        id="edit-amount" 
                        type="number"
                        value={editingChit.monthlyAmount}
                        onChange={e => setEditingChit({...editingChit, monthlyAmount: Number(e.target.value)})}
                        required 
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="edit-members">Total Members</Label>
                      <Input 
                        id="edit-members" 
                        type="number"
                        value={editingChit.totalMembers}
                        onChange={e => setEditingChit({...editingChit, totalMembers: Number(e.target.value)})}
                        required 
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="edit-duration">Duration (months)</Label>
                      <Input 
                        id="edit-duration" 
                        type="number"
                        value={editingChit.duration}
                        onChange={e => setEditingChit({...editingChit, duration: Number(e.target.value)})}
                        required 
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="edit-startDate">Start Date</Label>
                      <Input 
                        id="edit-startDate" 
                        type="date"
                        value={editingChit.startDate}
                        onChange={e => setEditingChit({...editingChit, startDate: e.target.value})}
                        required 
                      />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="edit-description">Description</Label>
                    <Textarea 
                      id="edit-description" 
                      value={editingChit.description}
                      onChange={e => setEditingChit({...editingChit, description: e.target.value})}
                    />
                  </div>
                </div>
              )}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => {
                  setIsEditChitDialogOpen(false);
                  setEditingChit(null);
                }}>Cancel</Button>
                <Button type="submit">Save Changes</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={(open) => {
          setIsDeleteDialogOpen(open);
          if (!open) setChitToDelete(null);
        }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure you want to delete this chit round?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the chit scheme and all its data.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => {
                setIsDeleteDialogOpen(false);
                setChitToDelete(null);
              }}>Cancel</AlertDialogCancel>
              <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={confirmDelete}>Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    )
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <Button variant="ghost" size="sm" className="-ml-2 h-8 text-muted-foreground hover:text-primary" onClick={() => setSelectedChitId(null)}>
            <ChevronLeft className="mr-1 size-4" /> Back to Schemes
          </Button>
          <div className="flex items-center gap-3">
            <h2 className="text-3xl font-headline font-bold tracking-tight">{chitSchemes.find(g => g.id === selectedChitId)?.name}</h2>
            <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">Active Scheme</Badge>
          </div>
          <p className="text-muted-foreground">Manage rounds and auctions for this scheme.</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
         <Card className="border-l-4 border-l-accent shadow-sm">
           <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
             <CardTitle className="text-sm font-medium">Scheme Start</CardTitle>
             <Calendar className="size-4 text-accent" />
           </CardHeader>
           <CardContent>
             <div className="text-2xl font-bold">{chitSchemes.find(g => g.id === selectedChitId)?.startDate}</div>
             <p className="text-xs text-muted-foreground mt-1">Duration: {chitSchemes.find(g => g.id === selectedChitId)?.duration} months</p>
           </CardContent>
         </Card>
         
         <Card className="border-l-4 border-l-primary shadow-sm">
           <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
             <CardTitle className="text-sm font-medium">Monthly Dues</CardTitle>
             <IndianRupee className="size-4 text-primary" />
           </CardHeader>
           <CardContent>
             <div className="text-2xl font-bold">₹{chitSchemes.find(g => g.id === selectedChitId)?.monthlyAmount?.toLocaleString()}</div>
             <p className="text-xs text-muted-foreground mt-1">Per member contribution</p>
           </CardContent>
         </Card>

         <Card className="border-l-4 border-l-emerald-500 shadow-sm">
           <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
             <CardTitle className="text-sm font-medium">Total Participants</CardTitle>
             <Users className="size-4 text-emerald-500" />
           </CardHeader>
           <CardContent>
             <div className="text-2xl font-bold">{chitSchemes.find(g => g.id === selectedChitId)?.totalMembers}</div>
             <p className="text-xs text-muted-foreground mt-1">Active participants registered</p>
           </CardContent>
         </Card>
      </div>

      <div className="bg-muted/30 rounded-xl p-8 border-2 border-dashed flex flex-col items-center justify-center text-center space-y-4">
        <Clock className="size-12 text-muted-foreground/40" />
        <div className="space-y-1">
          <h3 className="font-bold text-lg">Auction Tracking Coming Soon</h3>
          <p className="text-muted-foreground max-w-sm">Detailed round-by-round auction tracking and winner selection for this scheme is being enabled.</p>
        </div>
      </div>
    </div>
  )
}
