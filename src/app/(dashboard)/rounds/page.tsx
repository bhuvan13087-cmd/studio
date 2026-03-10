"use client"

import { useState } from "react"
import { History, Plus, Users, MoreVertical, ChevronLeft, Loader2, Pencil, Trash2, Phone } from "lucide-react"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, query, doc, serverTimestamp, orderBy, addDoc, updateDoc, deleteDoc } from "firebase/firestore"
import { useRole } from "@/hooks/use-role"
import { format, parseISO } from "date-fns"
import { cn } from "@/lib/utils"

export default function RoundsPage() {
  const [selectedChitId, setSelectedChitId] = useState<string | null>(null)
  const [isAddChitDialogOpen, setIsAddChitDialogOpen] = useState(false)
  const [isEditChitDialogOpen, setIsEditChitDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false)
  const [isActionPending, setIsActionPending] = useState(false)
  
  const [editingChit, setEditingChit] = useState<any>(null)
  const [chitToDelete, setChitToDelete] = useState<any>(null)
  const [historyMember, setHistoryMember] = useState<any>(null)
  
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
    dailyAmount: 0, 
    totalMembers: 20, 
    duration: 20, 
    startDate: new Date().toISOString().split('T')[0], 
    description: "", 
    collectionType: "" 
  })

  const restoreInteraction = (open: boolean) => {
    if (!open) {
      setTimeout(() => {
        document.body.style.pointerEvents = 'auto'; document.body.style.overflow = 'auto';
        document.querySelectorAll('.modal-backdrop, .overlay, .dropdown-backdrop, [data-radix-portal]').forEach(el => { if (el.innerHTML === '') el.remove(); });
      }, 300)
    }
  }

  const handleAddChit = async (e: React.FormEvent) => {
    e.preventDefault(); if (!db || isActionPending) return;
    
    if (!newChit.collectionType) {
      toast({ variant: "destructive", title: "Selection Required", description: "Please select a collection type (Daily or Monthly)." });
      return;
    }

    setIsActionPending(true);
    try {
      await addDoc(collection(db, 'chitRounds'), { ...newChit, createdAt: serverTimestamp() });
      setIsAddChitDialogOpen(false); restoreInteraction(false);
      setNewChit({ name: "", monthlyAmount: 5000, dailyAmount: 0, totalMembers: 20, duration: 20, startDate: new Date().toISOString().split('T')[0], description: "", collectionType: "" });
      toast({ title: "Round Created" });
    } catch (e: any) { toast({ variant: "destructive", title: "Error" }); } finally { setIsActionPending(false); }
  }

  const handleEditChit = async (e: React.FormEvent) => {
    e.preventDefault(); if (!db || !editingChit || isActionPending) return;
    setIsActionPending(true);
    try {
      await updateDoc(doc(db, 'chitRounds', editingChit.id), { 
        ...editingChit, 
        monthlyAmount: Number(editingChit.monthlyAmount), 
        dailyAmount: Number(editingChit.dailyAmount || 0),
        totalMembers: Number(editingChit.totalMembers) 
      });
      setIsEditChitDialogOpen(false); restoreInteraction(false);
      toast({ title: "Updated Successfully" });
    } catch (e: any) { toast({ variant: "destructive", title: "Error" }); } finally { setIsActionPending(false); }
  }

  const confirmDelete = async () => {
    if (!db || !chitToDelete || isActionPending) return;
    setIsActionPending(true);
    try { await deleteDoc(doc(db, 'chitRounds', chitToDelete.id)); toast({ title: "Scheme Deleted" }); setIsDeleteDialogOpen(false); restoreInteraction(false); }
    catch (e: any) { toast({ variant: "destructive", title: "Error" }); } finally { setIsActionPending(false); }
  }

  const currentRound = chitSchemes.find(r => r.id === selectedChitId)
  const assignedMembers = (members || []).filter(m => m.chitGroup === currentRound?.name)

  if (isRoleLoading || isRoundsLoading) return (<div className="flex h-[60vh] items-center justify-center"><Loader2 className="size-8 animate-spin text-primary" /></div>)

  if (!selectedChitId) {
    return (
      <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-500 pb-10 overflow-x-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1"><h2 className="text-2xl sm:text-3xl font-headline font-bold">Chit Rounds</h2><p className="text-sm text-muted-foreground">Manage active fund schemes.</p></div>
          <Button className="h-10 sm:h-11 shadow-lg w-full sm:w-auto font-bold" onClick={() => setIsAddChitDialogOpen(true)}><Plus className="mr-2 size-5" /> Add Scheme</Button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {chitSchemes.map((group) => (
            <Card key={group.id} className="hover:shadow-md transition-all border-border/50 overflow-hidden flex flex-col">
              <CardHeader className="bg-muted/20 p-4 space-y-2">
                <div className="flex justify-between items-start">
                  <Badge variant="outline" className="text-[10px] font-bold uppercase">{group.collectionType || "Monthly"}</Badge>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7"><MoreVertical className="size-4" /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => { setEditingChit({...group}); setIsEditChitDialogOpen(true); }}>
                        <Pencil className="mr-2 size-3.5" /> Edit
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-destructive" onSelect={() => { setChitToDelete(group); setIsDeleteDialogOpen(true); }}>
                        <Trash2 className="mr-2 size-3.5" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <CardTitle className="text-lg truncate">{group.name}</CardTitle>
                <CardDescription className="text-xs">Capacity: {group.totalMembers} Members</CardDescription>
              </CardHeader>
              <CardContent className="p-4 flex-1">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-emerald-600">
                    {group.collectionType === 'Daily' ? `Daily: ₹${group.dailyAmount?.toLocaleString()}` : `Dues: ₹${group.monthlyAmount?.toLocaleString()}`}
                  </span>
                  <span className="text-muted-foreground">{(members || []).filter(m => m.chitGroup === group.name).length} / {group.totalMembers} Filled</span>
                </div>
              </CardContent>
              <CardFooter className="p-0 border-t"><Button variant="ghost" className="w-full h-10 rounded-none text-xs font-bold" onClick={() => setSelectedChitId(group.id)}>View Round Board</Button></CardFooter>
            </Card>
          ))}
        </div>

        {/* Add Scheme Dialog */}
        <Dialog open={isAddChitDialogOpen} onOpenChange={(o) => { setIsAddChitDialogOpen(o); restoreInteraction(o); }}>
          <DialogContent className="sm:max-w-[425px] max-h-[90vh] overflow-y-auto">
            <form onSubmit={handleAddChit}>
              <DialogHeader><DialogTitle>New Scheme</DialogTitle><DialogDescription>Define a new chit fund collection cycle.</DialogDescription></DialogHeader>
              <div className="grid gap-4 py-6">
                <div className="grid gap-2">
                  <Label htmlFor="schemeName">Name</Label>
                  <Input id="schemeName" value={newChit.name} onChange={e => setNewChit({...newChit, name: e.target.value})} required disabled={isActionPending} placeholder="e.g. Platinum Group" />
                </div>
                <div className="grid gap-2">
                  <Label>Collection Type</Label>
                  <Select value={newChit.collectionType} onValueChange={v => setNewChit({...newChit, collectionType: v})} disabled={isActionPending}>
                    <SelectTrigger><SelectValue placeholder="Select Daily/Monthly" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Monthly">Monthly</SelectItem>
                      <SelectItem value="Daily">Daily</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="monthlyAmount">Monthly Amount (₹)</Label>
                    <Input id="monthlyAmount" type="number" value={newChit.monthlyAmount} onChange={e => setNewChit({...newChit, monthlyAmount: Number(e.target.value)})} required disabled={isActionPending} />
                  </div>
                  {newChit.collectionType === "Daily" && (
                    <div className="grid gap-2">
                      <Label htmlFor="dailyAmount">Daily Amount (₹)</Label>
                      <Input id="dailyAmount" type="number" value={newChit.dailyAmount} onChange={e => setNewChit({...newChit, dailyAmount: Number(e.target.value)})} required disabled={isActionPending} />
                    </div>
                  )}
                  <div className="grid gap-2">
                    <Label htmlFor="totalMembers">Members</Label>
                    <Input id="totalMembers" type="number" value={newChit.totalMembers} onChange={e => setNewChit({...newChit, totalMembers: Number(e.target.value)})} required disabled={isActionPending} />
                  </div>
                </div>
              </div>
              <DialogFooter className="gap-2">
                <Button variant="outline" type="button" onClick={() => { setIsAddChitDialogOpen(false); restoreInteraction(false); }} disabled={isActionPending} className="w-full sm:w-auto">Cancel</Button>
                <Button type="submit" disabled={isActionPending} className="w-full sm:w-auto">
                  {isActionPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create Scheme
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Edit Scheme Dialog */}
        <Dialog open={isEditChitDialogOpen} onOpenChange={(o) => { setIsEditChitDialogOpen(o); restoreInteraction(o); if(!o) setEditingChit(null); }}>
          <DialogContent className="sm:max-w-[425px] max-h-[90vh] overflow-y-auto">
            {editingChit && (
              <form onSubmit={handleEditChit}>
                <DialogHeader><DialogTitle>Edit Scheme</DialogTitle></DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2"><Label>Name</Label><Input value={editingChit.name} onChange={e => setEditingChit({...editingChit, name: e.target.value})} required disabled={isActionPending} /></div>
                  <div className="grid gap-2">
                    <Label>Collection Type</Label>
                    <Select value={editingChit.collectionType} onValueChange={v => setEditingChit({...editingChit, collectionType: v})} disabled={isActionPending}>
                      <SelectTrigger><SelectValue placeholder="Select Daily/Monthly" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Monthly">Monthly</SelectItem>
                        <SelectItem value="Daily">Daily</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2"><Label>Monthly (₹)</Label><Input type="number" value={editingChit.monthlyAmount} onChange={e => setEditingChit({...editingChit, monthlyAmount: Number(e.target.value)})} required disabled={isActionPending} /></div>
                    {editingChit.collectionType === "Daily" && (
                      <div className="grid gap-2"><Label>Daily (₹)</Label><Input type="number" value={editingChit.dailyAmount} onChange={e => setEditingChit({...editingChit, dailyAmount: Number(e.target.value)})} required disabled={isActionPending} /></div>
                    )}
                    <div className="grid gap-2"><Label>Members</Label><Input type="number" value={editingChit.totalMembers} onChange={e => setEditingChit({...editingChit, totalMembers: Number(e.target.value)})} required disabled={isActionPending} /></div>
                  </div>
                </div>
                <DialogFooter className="gap-2">
                  <Button variant="outline" type="button" onClick={() => { setIsEditChitDialogOpen(false); restoreInteraction(false); }} disabled={isActionPending}>Cancel</Button>
                  <Button type="submit" disabled={isActionPending}>Update</Button>
                </DialogFooter>
              </form>
            )}
          </DialogContent>
        </Dialog>

        {/* Delete AlertDialog */}
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={(o) => { setIsDeleteDialogOpen(o); restoreInteraction(o); if(!o) setChitToDelete(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader><AlertDialogTitle className="text-destructive">Delete Scheme?</AlertDialogTitle><AlertDialogDescription>This will permanently remove the scheme <strong>{chitToDelete?.name}</strong>. Members currently in this group will need to be reassigned.</AlertDialogDescription></AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isActionPending}>Cancel</AlertDialogCancel>
              <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={confirmDelete} disabled={isActionPending}>Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    )
  }

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-500 pb-10 overflow-x-hidden">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => setSelectedChitId(null)} className="rounded-full h-9 w-9"><ChevronLeft className="size-5" /></Button>
        <div className="min-w-0"><h2 className="text-xl sm:text-2xl font-bold truncate">{currentRound?.name}</h2><p className="text-[10px] sm:text-xs text-muted-foreground uppercase font-bold tracking-tight">Round Dashboard</p></div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="shadow-sm border-l-4 border-l-primary"><CardHeader className="p-3 pb-1"><CardTitle className="text-[10px] uppercase font-bold text-muted-foreground">Type</CardTitle></CardHeader><CardContent className="p-3 pt-0"><div className="text-lg font-bold">{currentRound?.collectionType || "Monthly"}</div></CardContent></Card>
        <Card className="shadow-sm border-l-4 border-l-primary"><CardHeader className="p-3 pb-1"><CardTitle className="text-[10px] uppercase font-bold text-muted-foreground">Members</CardTitle></CardHeader><CardContent className="p-3 pt-0"><div className="text-lg font-bold">{assignedMembers.length} / {currentRound?.totalMembers}</div></CardContent></Card>
        <Card className="shadow-sm border-l-4 border-l-emerald-500"><CardHeader className="p-3 pb-1"><CardTitle className="text-[10px] uppercase font-bold text-muted-foreground">Monthly Amount</CardTitle></CardHeader><CardContent className="p-3 pt-0"><div className="text-lg font-bold text-emerald-600">₹{currentRound?.monthlyAmount?.toLocaleString()}</div></CardContent></Card>
        {currentRound?.collectionType === 'Daily' && (
          <Card className="shadow-sm border-l-4 border-l-amber-500"><CardHeader className="p-3 pb-1"><CardTitle className="text-[10px] uppercase font-bold text-muted-foreground">Daily Amount</CardTitle></CardHeader><CardContent className="p-3 pt-0"><div className="text-lg font-bold text-amber-600">₹{currentRound?.dailyAmount?.toLocaleString()}</div></CardContent></Card>
        )}
      </div>
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <div className="p-4 border-b bg-muted/20 flex justify-between items-center"><h3 className="text-sm font-bold flex items-center gap-2"><Users className="size-4 text-primary" /> Active Board</h3><Badge variant="secondary" className="text-[10px] tabular-nums font-bold">{assignedMembers.length} Joined</Badge></div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow><TableHead className="text-[10px] uppercase font-bold">Member</TableHead><TableHead className="text-[10px] uppercase font-bold">Payment</TableHead><TableHead className="text-[10px] uppercase font-bold text-right">Total Paid</TableHead><TableHead className="w-[40px]"></TableHead></TableRow></TableHeader>
            <TableBody>
              {assignedMembers.length > 0 ? assignedMembers.map((m) => (
                <TableRow key={m.id} className="hover:bg-muted/5">
                  <TableCell><div className="flex items-center gap-2"><div className="h-7 w-7 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-[10px]">{m.name[0]}</div><span className="text-xs font-semibold truncate max-w-[100px]">{m.name}</span></div></TableCell>
                  <TableCell><Badge variant={m.paymentStatus === 'success' ? 'default' : 'secondary'} className={cn("text-[9px] px-1.5", m.paymentStatus === 'success' ? "bg-emerald-500" : "")}>{m.paymentStatus || "Pending"}</Badge></TableCell>
                  <TableCell className="text-right text-xs font-bold tabular-nums">₹{(m.totalPaid || 0).toLocaleString()}</TableCell>
                  <TableCell><Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setHistoryMember(m); setIsHistoryDialogOpen(true); }}><History className="size-3.5" /></Button></TableCell>
                </TableRow>
              )) : <TableRow><TableCell colSpan={4} className="h-24 text-center text-xs text-muted-foreground italic">No participants yet.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* History Dialog */}
      <Dialog open={isHistoryDialogOpen} onOpenChange={(open) => { setIsHistoryDialogOpen(open); restoreInteraction(open); if (!open) setHistoryMember(null) }}>
        <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
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
    </div>
  )
}
