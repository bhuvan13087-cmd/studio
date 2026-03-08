
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
  const { data: members } = useCollection(membersQuery);

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
      createdAt: serverTimestamp()
    })

    setIsAddChitDialogOpen(false)
    setNewChit({ name: "", monthlyAmount: 5000, totalMembers: 20, duration: 20, startDate: new Date().toISOString().split('T')[0], description: "" })
    toast({ title: "Chit Round Created", description: "Your new chit scheme is now active." })
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
    toast({ title: "Chit Updated", description: "Changes saved successfully." })
  }

  const confirmDelete = () => {
    if (!db || !chitToDelete) return;
    deleteDocumentNonBlocking(doc(db, 'chitRounds', chitToDelete.id));
    toast({ title: "Chit Deleted", description: `${chitToDelete.name} removed.` })
    setIsDeleteDialogOpen(false)
    setChitToDelete(null)
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
          <Dialog open={isAddChitDialogOpen} onOpenChange={(open) => {
            setIsAddChitDialogOpen(open)
            if (!open) document.body.style.pointerEvents = 'auto'
          }}>
            <DialogTrigger asChild>
              <Button className="h-11 shadow-lg"><Plus className="mr-2 size-5" /> Add Chit Round</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <form onSubmit={handleAddChit}>
                <DialogHeader><DialogTitle>Add Chit Round</DialogTitle></DialogHeader>
                <div className="grid gap-4 py-6">
                  <div className="grid gap-2">
                    <Label htmlFor="name">Chit Name</Label>
                    <Input id="name" value={newChit.name} onChange={e => setNewChit({...newChit, name: e.target.value})} required />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label>Monthly Amount (₹)</Label>
                      <Input type="number" value={newChit.monthlyAmount} onChange={e => setNewChit({...newChit, monthlyAmount: Number(e.target.value)})} required />
                    </div>
                    <div className="grid gap-2">
                      <Label>Total Members</Label>
                      <Input type="number" value={newChit.totalMembers} onChange={e => setNewChit({...newChit, totalMembers: Number(e.target.value)})} required />
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsAddChitDialogOpen(false)}>Cancel</Button>
                  <Button type="submit">Create</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
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
                      <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setEditingChit({...group}); setIsEditChitDialogOpen(true); }}>
                        <Pencil className="mr-2 size-4" /> Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive" onSelect={(e) => { e.preventDefault(); setChitToDelete(group); setIsDeleteDialogOpen(true); }}>
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
                  <span>Dues: ₹{group.monthlyAmount?.toLocaleString()}</span>
                  <span>Members: {(members || []).filter(m => m.chitGroup === group.name).length} / {group.totalMembers}</span>
                </div>
              </CardContent>
              <CardFooter className="bg-muted/10 border-t">
                <Button variant="ghost" className="w-full" onClick={() => setSelectedChitId(group.id)}>View Round Details</Button>
              </CardFooter>
            </Card>
          ))}
        </div>

        {/* Edit Dialog */}
        <Dialog open={isEditChitDialogOpen} onOpenChange={(open) => {
          setIsEditChitDialogOpen(open)
          if (!open) { setEditingChit(null); document.body.style.pointerEvents = 'auto' }
        }}>
          <DialogContent>
            <form onSubmit={handleEditChit}>
              <DialogHeader><DialogTitle>Edit Scheme</DialogTitle></DialogHeader>
              {editingChit && (
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label>Name</Label>
                    <Input value={editingChit.name} onChange={e => setEditingChit({...editingChit, name: e.target.value})} required />
                  </div>
                </div>
              )}
              <DialogFooter><Button type="submit">Save Changes</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Delete Dialog */}
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={(open) => {
          setIsDeleteDialogOpen(open)
          if (!open) { setChitToDelete(null); document.body.style.pointerEvents = 'auto' }
        }}>
          <AlertDialogContent>
            <AlertDialogHeader><AlertDialogTitle>Delete Chit Round?</AlertDialogTitle></AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setIsDeleteDialogOpen(false)}>Cancel</AlertDialogCancel>
              <AlertDialogAction className="bg-destructive" onClick={confirmDelete}>Confirm Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    )
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-10">
      <Button variant="ghost" size="sm" onClick={() => setSelectedChitId(null)} className="mb-2">
        <ChevronLeft className="mr-1 size-4" /> Back to Schemes
      </Button>
      <div className="grid gap-6 md:grid-cols-3">
        <Card className="border-l-4 border-l-primary">
          <CardHeader><CardTitle className="text-sm">Assigned Members</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(members || []).filter(m => m.chitGroup === chitSchemes.find(g => g.id === selectedChitId)?.name).length}
            </div>
          </CardContent>
        </Card>
      </div>
      <div className="bg-muted/30 rounded-xl p-8 text-center border-2 border-dashed">
        <h3 className="font-bold text-lg">Auction Tracking Coming Soon</h3>
        <p className="text-muted-foreground">Detailed auction history for this scheme will be enabled in the next update.</p>
      </div>
    </div>
  )
}
