"use client"

import { useState } from "react"
import { Trophy, History, Plus, Award, Calendar, IndianRupee, Users, CheckCircle2, MoreVertical, Search, UserCheck, ChevronLeft, LayoutGrid, ArrowRight, Loader2, AlertCircle, Database } from "lucide-react"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { useFirestore, useCollection, useMemoFirebase, addDocumentNonBlocking, updateDocumentNonBlocking } from "@/firebase"
import { collection, query, doc, serverTimestamp, orderBy } from "firebase/firestore"
import { useRole } from "@/hooks/use-role"

export default function RoundsPage() {
  const [selectedChitId, setSelectedChitId] = useState<string | null>(null)
  
  const [isCreateChitDialogOpen, setIsCreateChitDialogOpen] = useState(false)
  const [isCreateRoundDialogOpen, setIsCreateRoundDialogOpen] = useState(false)
  const [isWinnerDialogOpen, setIsWinnerDialogOpen] = useState(false)
  const [isParticipantsDialogOpen, setIsParticipantsDialogOpen] = useState(false)
  const [selectedRound, setSelectedRound] = useState<any>(null)
  
  const { toast } = useToast()
  const db = useFirestore()
  const { isAdmin, isLoading: isRoleLoading } = useRole()

  // Real-time collections
  const roundsQuery = useMemoFirebase(() => query(collection(db, 'chitRounds'), orderBy('roundNumber', 'asc')), [db]);
  const { data: roundsData, isLoading: isRoundsLoading } = useCollection(roundsQuery);
  const rounds = roundsData || [];

  const membersQuery = useMemoFirebase(() => collection(db, 'members'), [db]);
  const { data: membersData, isLoading: isMembersLoading } = useCollection(membersQuery);
  const members = membersData || [];

  // Derive groups from members collection
  const uniqueGroups = Array.from(new Set(members.map(m => m.chitGroup).filter(Boolean)))
  const chitGroups = uniqueGroups.map(groupName => {
    const groupMembers = members.filter(m => m.chitGroup === groupName)
    const groupRounds = rounds.filter(r => r.chitGroupName === groupName)
    const completedRounds = groupRounds.filter(r => r.status === 'completed').length
    
    return {
      id: groupName,
      name: groupName,
      monthlyAmount: groupMembers[0]?.monthlyAmount || 0,
      totalMembers: groupMembers.length,
      currentRound: completedRounds + 1,
      totalRounds: groupMembers.length, // Typically matches member count
      startDate: groupMembers[0]?.joinDate || '-',
    }
  })

  const selectedChit = chitGroups.find(g => g.id === selectedChitId)
  const filteredRounds = rounds.filter(r => r.chitGroupName === selectedChitId)

  const [newChit, setNewChit] = useState({
    name: "",
    monthlyAmount: 5000,
    totalMembers: 20,
    totalRounds: 20,
    startDate: new Date().toISOString().split('T')[0],
  })

  const [newRound, setNewRound] = useState({
    roundNumber: 1,
    date: new Date().toISOString().split('T')[0],
    amount: 50000,
  })

  const [winnerData, setWinnerData] = useState({
    winnerId: "",
    winningAmount: 0,
  })

  const handleCreateChit = (e: React.FormEvent) => {
    e.preventDefault()
    toast({
      title: "Action Not Supported",
      description: "Please add a member and assign them to a new group name to create a chit group.",
    })
    setIsCreateChitDialogOpen(false)
  }

  const handleCreateRound = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedChitId || !db) return
    
    const roundId = Math.random().toString(36).substr(2, 9)
    addDocumentNonBlocking(collection(db, 'chitRounds'), {
      id: roundId,
      chitGroupName: selectedChitId,
      roundNumber: Number(newRound.roundNumber),
      winnerMemberId: "",
      winnerName: "",
      winningAmount: 0,
      date: newRound.date,
      status: "active",
      createdAt: serverTimestamp()
    })

    setIsCreateRoundDialogOpen(false)
    toast({
      title: "Round Created",
      description: `Round #${newRound.roundNumber} has been scheduled for ${selectedChitId}.`,
    })
  }

  const handleSelectWinner = (e: React.FormEvent) => {
    e.preventDefault()
    if (!db || !selectedRound) return

    const winner = members.find(m => m.id === winnerData.winnerId)
    if (!winner) return

    updateDocumentNonBlocking(doc(db, 'chitRounds', selectedRound.id), {
      winnerMemberId: winner.id,
      winnerName: winner.name,
      winningAmount: Number(winnerData.winningAmount),
      status: "completed"
    })

    setIsWinnerDialogOpen(false)
    toast({
      title: "Winner Selected",
      description: `${winner.name} has won Round #${selectedRound.roundNumber}.`,
    })
  }

  if (isRoleLoading || isRoundsLoading || isMembersLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    )
  }

  if (chitGroups.length === 0 && !selectedChitId) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
        <Database className="size-16 text-muted-foreground/20" />
        <h2 className="text-xl font-semibold">No data available. Please add records.</h2>
        <p className="text-muted-foreground text-center">Add members to a chit group to start managing rounds.</p>
      </div>
    )
  }

  if (!selectedChitId) {
    return (
      <div className="space-y-8 animate-in fade-in duration-500 pb-10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-3xl font-headline font-bold tracking-tight">Chit Groups</h2>
            <p className="text-muted-foreground">Select a group to manage its rounds and auctions.</p>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {chitGroups.map((group) => (
            <Card key={group.id} className="hover:shadow-lg transition-all duration-300 border-border/50 overflow-hidden group">
              <CardHeader className="bg-muted/30 pb-4">
                <div className="flex justify-between items-start">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary mb-2">
                    <LayoutGrid className="size-5" />
                  </div>
                  <Badge variant="outline" className="bg-background">Round {group.currentRound}</Badge>
                </div>
                <CardTitle className="text-xl group-hover:text-primary transition-colors">{group.name}</CardTitle>
                <CardDescription>Members: {group.totalMembers}</CardDescription>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Contribution</span>
                    <p className="font-bold text-lg">₹{group.monthlyAmount.toLocaleString()}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Start Date</span>
                    <p className="font-bold text-sm">{group.startDate}</p>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="bg-muted/10 border-t pt-4">
                <Button variant="ghost" className="w-full group" onClick={() => setSelectedChitId(group.id)}>
                  Manage Rounds
                  <ArrowRight className="ml-2 size-4 group-hover:translate-x-1 transition-transform" />
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <Button variant="ghost" size="sm" className="-ml-2 h-8 text-muted-foreground hover:text-primary" onClick={() => setSelectedChitId(null)}>
            <ChevronLeft className="mr-1 size-4" /> Back to Groups
          </Button>
          <div className="flex items-center gap-3">
            <h2 className="text-3xl font-headline font-bold tracking-tight">{selectedChit?.name}</h2>
            <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">Active Scheme</Badge>
          </div>
          <p className="text-muted-foreground">Manage rounds and auctions for this group.</p>
        </div>
        <Dialog open={isCreateRoundDialogOpen} onOpenChange={setIsCreateRoundDialogOpen}>
          <DialogTrigger asChild>
            <Button className="h-11 px-6 shadow-lg hover:shadow-xl transition-all">
              <Plus className="mr-2 size-5" />
              Schedule Next Round
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <form onSubmit={handleCreateRound}>
              <DialogHeader>
                <DialogTitle>Create New Chit Round</DialogTitle>
                <DialogDescription>
                  Setup the next auction round for {selectedChit?.name}.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-6">
                <div className="grid gap-2">
                  <Label htmlFor="roundNumber">Round Number</Label>
                  <Input 
                    id="roundNumber" 
                    type="number"
                    value={newRound.roundNumber}
                    onChange={e => setNewRound({...newRound, roundNumber: parseInt(e.target.value)})}
                    required 
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="date">Scheduled Date</Label>
                  <Input 
                    id="date" 
                    type="date"
                    value={newRound.date}
                    onChange={e => setNewRound({...newRound, date: e.target.value})}
                    required 
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsCreateRoundDialogOpen(false)}>Cancel</Button>
                <Button type="submit">Create Round</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
         <Card className="border-l-4 border-l-accent shadow-sm">
           <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
             <CardTitle className="text-sm font-medium">Last Round Winner</CardTitle>
             <Trophy className="size-4 text-accent" />
           </CardHeader>
           <CardContent>
             <div className="text-2xl font-bold">{filteredRounds.find(r => r.status === 'completed')?.winnerName || 'No Winners Yet'}</div>
             <div className="flex items-center gap-1.5 mt-1 text-emerald-600 font-medium">
               <IndianRupee className="size-3.5" />
               {(filteredRounds.find(r => r.status === 'completed')?.winningAmount || 0).toLocaleString()}
             </div>
           </CardContent>
         </Card>
         
         <Card className="border-l-4 border-l-primary shadow-sm">
           <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
             <CardTitle className="text-sm font-medium">Completed Rounds</CardTitle>
             <History className="size-4 text-primary" />
           </CardHeader>
           <CardContent>
             <div className="text-2xl font-bold">{filteredRounds.filter(r => r.status === 'completed').length}</div>
             <p className="text-xs text-muted-foreground mt-2">Total cycles finished</p>
           </CardContent>
         </Card>

         <Card className="border-l-4 border-l-emerald-500 shadow-sm">
           <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
             <CardTitle className="text-sm font-medium">Total Funds Distributed</CardTitle>
             <Award className="size-4 text-emerald-500" />
           </CardHeader>
           <CardContent>
             <div className="text-2xl font-bold">₹{filteredRounds.reduce((acc, r) => acc + (r.winningAmount || 0), 0).toLocaleString()}</div>
             <p className="text-xs text-muted-foreground mt-1">Real payout data</p>
           </CardContent>
         </Card>
      </div>

      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead className="font-semibold">Round #</TableHead>
              <TableHead className="font-semibold">Status</TableHead>
              <TableHead className="font-semibold">Winner</TableHead>
              <TableHead className="font-semibold">Winning Amount</TableHead>
              <TableHead className="font-semibold">Date</TableHead>
              <TableHead className="w-[100px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRounds.length > 0 ? filteredRounds.map((round) => (
              <TableRow key={round.id} className="hover:bg-muted/10 transition-colors">
                <TableCell className="font-bold text-primary">#{round.roundNumber}</TableCell>
                <TableCell>
                  <Badge 
                    variant={round.status === 'active' ? 'outline' : 'default'}
                    className={round.status === 'active' ? 'border-primary text-primary bg-primary/5' : 'bg-emerald-500'}
                  >
                    {round.status?.toUpperCase()}
                  </Badge>
                </TableCell>
                <TableCell>{round.winnerName || <span className="text-muted-foreground italic">TBD</span>}</TableCell>
                <TableCell className="font-bold text-emerald-600">₹{(round.winningAmount || 0).toLocaleString()}</TableCell>
                <TableCell>{round.date}</TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {round.status === 'active' && (
                        <DropdownMenuItem onClick={() => { setSelectedRound(round); setIsWinnerDialogOpen(true); }}>
                          <Trophy className="mr-2 size-4 text-accent" /> Select Winner
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={() => { setSelectedRound(round); setIsParticipantsDialogOpen(true); }}>
                        <Users className="mr-2 size-4 text-primary" /> Participants
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            )) : (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground italic">
                  No rounds scheduled. Click "Schedule Next Round" to begin.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Winner Selection Dialog */}
      <Dialog open={isWinnerDialogOpen} onOpenChange={setIsWinnerDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <form onSubmit={handleSelectWinner}>
            <DialogHeader>
              <DialogTitle>Select Round Winner</DialogTitle>
              <DialogDescription>Assign a winner for Round #{selectedRound?.roundNumber}.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-6">
              <div className="grid gap-2">
                <Label>Winner Member</Label>
                <Select onValueChange={(v) => setWinnerData({...winnerData, winnerId: v})} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a member" />
                  </SelectTrigger>
                  <SelectContent>
                    {members.filter(m => m.chitGroup === selectedChitId).map((p, i) => (
                      <SelectItem key={i} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Winning Bid Amount (₹)</Label>
                <Input 
                  type="number"
                  value={winnerData.winningAmount}
                  onChange={e => setWinnerData({...winnerData, winningAmount: parseInt(e.target.value)})}
                  required 
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsWinnerDialogOpen(false)}>Cancel</Button>
              <Button type="submit">Confirm Winner</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Participants List Dialog */}
      <Dialog open={isParticipantsDialogOpen} onOpenChange={setIsParticipantsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Round #{selectedRound?.roundNumber} Participants</DialogTitle>
          </DialogHeader>
          <div className="py-4">
             <div className="rounded-md border">
               <Table>
                 <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead>Member Name</TableHead>
                      <TableHead className="text-right">Status</TableHead>
                    </TableRow>
                 </TableHeader>
                 <TableBody>
                   {members.filter(m => m.chitGroup === selectedChitId).map((p, i) => (
                     <TableRow key={i}>
                       <TableCell className="font-medium">{p.name}</TableCell>
                       <TableCell className="text-right">
                         <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">Eligible</Badge>
                       </TableCell>
                     </TableRow>
                   ))}
                 </TableBody>
               </Table>
             </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setIsParticipantsDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
