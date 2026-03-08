"use client"

import { useState } from "react"
import { Trophy, History, Plus, Award, Calendar, IndianRupee, Users, CheckCircle2, MoreVertical, Search, UserCheck, ChevronLeft, LayoutGrid, ArrowRight } from "lucide-react"
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

const initialChitGroups = [
  { id: "g1", name: "Alpha Premium 5K", monthlyAmount: 5000, totalMembers: 20, currentRound: 13, totalRounds: 20, startDate: "2023-01-15" },
  { id: "g2", name: "Elite 10K Monthly", monthlyAmount: 10000, totalMembers: 12, currentRound: 4, totalRounds: 12, startDate: "2023-06-10" },
  { id: "g3", name: "Savings Special 2K", monthlyAmount: 2000, totalMembers: 25, currentRound: 1, totalRounds: 25, startDate: "2023-10-01" },
]

const initialRounds = [
  { id: "r1", chitGroupId: "g1", roundNumber: 13, winnerName: null, winningAmount: 0, date: "2023-10-15", commission: 5000, status: "active" },
  { id: "r2", chitGroupId: "g1", roundNumber: 12, winnerName: "John Doe", winningAmount: 45000, date: "2023-09-15", commission: 5000, status: "completed" },
  { id: "r3", chitGroupId: "g1", roundNumber: 11, winnerName: "Sarah Smith", winningAmount: 45000, date: "2023-08-15", commission: 5000, status: "completed" },
  { id: "r4", chitGroupId: "g2", roundNumber: 4, winnerName: null, winningAmount: 0, date: "2023-10-10", commission: 10000, status: "active" },
  { id: "r5", chitGroupId: "g2", roundNumber: 3, winnerName: "Michael Chen", winningAmount: 95000, date: "2023-09-10", commission: 10000, status: "completed" },
]

const mockParticipants = [
  { name: "John Doe", status: "eligible" },
  { name: "Sarah Smith", status: "eligible" },
  { name: "Michael Chen", status: "eligible" },
  { name: "Emma Watson", status: "eligible" },
  { name: "Robert Wilson", status: "eligible" },
  { name: "Lisa Wong", status: "eligible" },
  { name: "David Miller", status: "eligible" },
]

export default function RoundsPage() {
  const [chitGroups, setChitGroups] = useState(initialChitGroups)
  const [rounds, setRounds] = useState(initialRounds)
  const [selectedChitId, setSelectedChitId] = useState<string | null>(null)
  
  const [isCreateChitDialogOpen, setIsCreateChitDialogOpen] = useState(false)
  const [isCreateRoundDialogOpen, setIsCreateRoundDialogOpen] = useState(false)
  const [isWinnerDialogOpen, setIsWinnerDialogOpen] = useState(false)
  const [isParticipantsDialogOpen, setIsParticipantsDialogOpen] = useState(false)
  const [selectedRound, setSelectedRound] = useState<any>(null)
  
  const { toast } = useToast()

  const selectedChit = chitGroups.find(g => g.id === selectedChitId)
  const filteredRounds = rounds.filter(r => r.chitGroupId === selectedChitId)

  // New Chit Form State
  const [newChit, setNewChit] = useState({
    name: "",
    monthlyAmount: 5000,
    totalMembers: 20,
    totalRounds: 20,
    startDate: new Date().toISOString().split('T')[0],
  })

  // New Round Form State
  const [newRound, setNewRound] = useState({
    roundNumber: 1,
    date: new Date().toISOString().split('T')[0],
    amount: 50000,
  })

  const [winnerData, setWinnerData] = useState({
    winnerName: "",
    winningAmount: 45000,
  })

  const handleCreateChit = (e: React.FormEvent) => {
    e.preventDefault()
    const id = Math.random().toString(36).substr(2, 9)
    const chitToAdd = {
      id,
      ...newChit,
      currentRound: 1
    }
    setChitGroups([...chitGroups, chitToAdd])
    setIsCreateChitDialogOpen(false)
    toast({
      title: "Chit Group Created",
      description: `${newChit.name} has been successfully added.`,
    })
  }

  const handleCreateRound = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedChitId) return
    const id = Math.random().toString(36).substr(2, 9)
    const roundToAdd = {
      id,
      chitGroupId: selectedChitId,
      roundNumber: newRound.roundNumber,
      winnerName: null,
      winningAmount: 0,
      date: newRound.date,
      commission: selectedChit?.monthlyAmount || 0,
      status: "active"
    }
    setRounds([roundToAdd, ...rounds])
    setIsCreateRoundDialogOpen(false)
    toast({
      title: "Round Created",
      description: `Round #${newRound.roundNumber} for ${selectedChit?.name} has been scheduled.`,
    })
  }

  const handleSelectWinner = (e: React.FormEvent) => {
    e.preventDefault()
    setRounds(rounds.map(r => 
      r.id === selectedRound.id 
        ? { ...r, winnerName: winnerData.winnerName, winningAmount: winnerData.winningAmount, status: "completed" }
        : r
    ))
    setIsWinnerDialogOpen(false)
    toast({
      title: "Winner Selected",
      description: `${winnerData.winnerName} has won Round #${selectedRound.roundNumber}.`,
    })
  }

  const openWinnerDialog = (round: any) => {
    setSelectedRound(round)
    setIsWinnerDialogOpen(true)
  }

  const openParticipantsDialog = (round: any) => {
    setSelectedRound(round)
    setIsParticipantsDialogOpen(true)
  }

  if (!selectedChitId) {
    return (
      <div className="space-y-8 animate-in fade-in duration-500 pb-10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-3xl font-headline font-bold tracking-tight">Chit Groups</h2>
            <p className="text-muted-foreground">Select a group to manage its rounds and auctions.</p>
          </div>
          <Dialog open={isCreateChitDialogOpen} onOpenChange={setIsCreateChitDialogOpen}>
            <DialogTrigger asChild>
              <Button className="h-11 px-6 shadow-lg hover:shadow-xl transition-all">
                <Plus className="mr-2 size-5" />
                Create New Chit
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <form onSubmit={handleCreateChit}>
                <DialogHeader>
                  <DialogTitle>Create New Chit Group</DialogTitle>
                  <DialogDescription>Setup a new chit scheme with members and duration.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-6">
                  <div className="grid gap-2">
                    <Label htmlFor="chitName">Chit Name</Label>
                    <Input id="chitName" value={newChit.name} onChange={e => setNewChit({...newChit, name: e.target.value})} placeholder="e.g. Platinum 50K" required />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="monthlyAmount">Monthly Amount (₹)</Label>
                      <Input id="monthlyAmount" type="number" value={newChit.monthlyAmount} onChange={e => setNewChit({...newChit, monthlyAmount: parseInt(e.target.value)})} required />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="totalMembers">Total Members</Label>
                      <Input id="totalMembers" type="number" value={newChit.totalMembers} onChange={e => setNewChit({...newChit, totalMembers: parseInt(e.target.value)})} required />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="totalRounds">Total Rounds</Label>
                      <Input id="totalRounds" type="number" value={newChit.totalRounds} onChange={e => setNewChit({...newChit, totalRounds: parseInt(e.target.value)})} required />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="startDate">Start Date</Label>
                      <Input id="startDate" type="date" value={newChit.startDate} onChange={e => setNewChit({...newChit, startDate: e.target.value})} required />
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsCreateChitDialogOpen(false)}>Cancel</Button>
                  <Button type="submit">Create Chit Group</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {chitGroups.map((group) => (
            <Card key={group.id} className="hover:shadow-lg transition-all duration-300 border-border/50 overflow-hidden group">
              <CardHeader className="bg-muted/30 pb-4">
                <div className="flex justify-between items-start">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary mb-2">
                    <LayoutGrid className="size-5" />
                  </div>
                  <Badge variant="outline" className="bg-background">Round {group.currentRound}/{group.totalRounds}</Badge>
                </div>
                <CardTitle className="text-xl group-hover:text-primary transition-colors">{group.name}</CardTitle>
                <CardDescription>Started on {group.startDate}</CardDescription>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Monthly</span>
                    <p className="font-bold text-lg">₹{group.monthlyAmount.toLocaleString()}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Members</span>
                    <p className="font-bold text-lg">{group.totalMembers}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-medium">
                    <span>Progress</span>
                    <span>{Math.round((group.currentRound / group.totalRounds) * 100)}%</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-1.5">
                    <div className="bg-primary h-1.5 rounded-full transition-all duration-500" style={{ width: `${(group.currentRound / group.totalRounds) * 100}%` }}></div>
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

  // Round Management View for Selected Chit
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
          <p className="text-muted-foreground">Manage rounds and auctions for this chit group.</p>
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

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
         <Card className="border-l-4 border-l-accent shadow-sm">
           <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
             <CardTitle className="text-sm font-medium">Last Round Winner</CardTitle>
             <Trophy className="size-4 text-accent" />
           </CardHeader>
           <CardContent>
             <div className="text-2xl font-bold">{filteredRounds.find(r => r.status === 'completed')?.winnerName || 'No Winners Yet'}</div>
             <div className="flex items-center gap-1.5 mt-1 text-emerald-600 font-medium">
               <IndianRupee className="size-3.5" />
               {filteredRounds.find(r => r.status === 'completed')?.winningAmount.toLocaleString() || '0'}
             </div>
             <p className="text-xs text-muted-foreground mt-2">
               Round #{filteredRounds.find(r => r.status === 'completed')?.roundNumber || '-'}
             </p>
           </CardContent>
         </Card>
         
         <Card className="border-l-4 border-l-primary shadow-sm">
           <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
             <CardTitle className="text-sm font-medium">Chit Status</CardTitle>
             <History className="size-4 text-primary" />
           </CardHeader>
           <CardContent>
             <div className="text-2xl font-bold">{filteredRounds.filter(r => r.status === 'completed').length} / {selectedChit?.totalRounds}</div>
             <div className="w-full bg-muted rounded-full h-2 mt-2">
               <div className="bg-primary h-2 rounded-full" style={{ width: `${(filteredRounds.filter(r => r.status === 'completed').length / (selectedChit?.totalRounds || 1)) * 100}%` }}></div>
             </div>
             <p className="text-xs text-muted-foreground mt-2">Cycle Progression</p>
           </CardContent>
         </Card>

         <Card className="border-l-4 border-l-emerald-500 shadow-sm md:col-span-2 lg:col-span-1">
           <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
             <CardTitle className="text-sm font-medium">Funds Distributed</CardTitle>
             <Award className="size-4 text-emerald-500" />
           </CardHeader>
           <CardContent>
             <div className="text-2xl font-bold">₹{filteredRounds.reduce((acc, r) => acc + (r.winningAmount || 0), 0).toLocaleString()}</div>
             <p className="text-xs text-muted-foreground mt-1">Across completed rounds</p>
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
                <TableCell>
                  {round.winnerName ? (
                    <div className="font-medium">{round.winnerName}</div>
                  ) : (
                    <span className="text-muted-foreground italic">Not selected</span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="font-bold text-emerald-600">₹{round.winningAmount.toLocaleString()}</div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="size-3.5" />
                    {round.date}
                  </div>
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
                      {round.status === 'active' && (
                        <DropdownMenuItem onClick={() => openWinnerDialog(round)}>
                          <Trophy className="mr-2 size-4 text-accent" />
                          Select Winner
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={() => openParticipantsDialog(round)}>
                        <Users className="mr-2 size-4 text-primary" />
                        View Participants
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            )) : (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground italic">
                  No rounds scheduled for this chit group yet.
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
              <DialogDescription>
                Assign a winner and winning amount for Round #{selectedRound?.roundNumber}.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-6">
              <div className="grid gap-2">
                <Label htmlFor="winnerName">Winner Member</Label>
                <Select onValueChange={(v) => setWinnerData({...winnerData, winnerName: v})} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a member" />
                  </SelectTrigger>
                  <SelectContent>
                    {mockParticipants.map((p, i) => (
                      <SelectItem key={i} value={p.name}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="winningAmount">Winning Bid Amount (₹)</Label>
                <Input 
                  id="winningAmount" 
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
            <DialogTitle className="flex items-center gap-2">
              <Users className="size-5 text-primary" />
              Round #{selectedRound?.roundNumber} Participants
            </DialogTitle>
            <DialogDescription>
              List of members participating in this chit cycle.
            </DialogDescription>
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
                   {mockParticipants.map((p, i) => (
                     <TableRow key={i}>
                       <TableCell className="font-medium">{p.name}</TableCell>
                       <TableCell className="text-right">
                         <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
                           <UserCheck className="mr-1 size-3" /> Eligible
                         </Badge>
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
