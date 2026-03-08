"use client"

import { useState } from "react"
import { Trophy, History, Plus, Award, Calendar, IndianRupee, Users, CheckCircle2, MoreVertical, Search, UserCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
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

const initialRounds = [
  { id: "active-1", roundNumber: 13, winnerName: null, winningAmount: 0, date: "2023-10-15", commission: 5000, status: "active" },
  { id: "1", roundNumber: 12, winnerName: "John Doe", winningAmount: 45000, date: "2023-09-15", commission: 5000, status: "completed" },
  { id: "2", roundNumber: 11, winnerName: "Sarah Smith", winningAmount: 45000, date: "2023-08-15", commission: 5000, status: "completed" },
  { id: "3", roundNumber: 10, winnerName: "Michael Chen", winningAmount: 45000, date: "2023-07-15", commission: 5000, status: "completed" },
  { id: "4", roundNumber: 9, winnerName: "Emma Watson", winningAmount: 45000, date: "2023-06-15", commission: 5000, status: "completed" },
  { id: "5", roundNumber: 8, winnerName: "Robert Wilson", winningAmount: 45000, date: "2023-05-15", commission: 5000, status: "completed" },
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
  const [rounds, setRounds] = useState(initialRounds)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isWinnerDialogOpen, setIsWinnerDialogOpen] = useState(false)
  const [isParticipantsDialogOpen, setIsParticipantsDialogOpen] = useState(false)
  const [selectedRound, setSelectedRound] = useState<any>(null)
  
  const { toast } = useToast()

  const [newRound, setNewRound] = useState({
    roundNumber: initialRounds[0].roundNumber + 1,
    date: new Date().toISOString().split('T')[0],
    amount: 50000,
  })

  const [winnerData, setWinnerData] = useState({
    winnerName: "",
    winningAmount: 45000,
  })

  const handleCreateRound = (e: React.FormEvent) => {
    e.preventDefault()
    const id = Math.random().toString(36).substr(2, 9)
    const roundToAdd = {
      id,
      roundNumber: newRound.roundNumber,
      winnerName: null,
      winningAmount: 0,
      date: newRound.date,
      commission: 5000,
      status: "active"
    }
    setRounds([roundToAdd, ...rounds])
    setIsCreateDialogOpen(false)
    toast({
      title: "Round Created",
      description: `Round #${newRound.roundNumber} has been scheduled.`,
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

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-headline font-bold tracking-tight">Chit Rounds</h2>
          <p className="text-muted-foreground">Historical records of chit auctions and winners.</p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="h-11 px-6 shadow-lg hover:shadow-xl transition-all">
              <Plus className="mr-2 size-5" />
              Start New Round
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <form onSubmit={handleCreateRound}>
              <DialogHeader>
                <DialogTitle>Create New Chit Round</DialogTitle>
                <DialogDescription>
                  Enter the details for the upcoming chit round.
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
                <div className="grid gap-2">
                  <Label htmlFor="amount">Total Chit Amount (₹)</Label>
                  <Input 
                    id="amount" 
                    type="number"
                    value={newRound.amount}
                    onChange={e => setNewRound({...newRound, amount: parseInt(e.target.value)})}
                    required 
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>Cancel</Button>
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
             <div className="text-2xl font-bold">{rounds.find(r => r.status === 'completed')?.winnerName || 'No Winners Yet'}</div>
             <div className="flex items-center gap-1.5 mt-1 text-emerald-600 font-medium">
               <IndianRupee className="size-3.5" />
               {rounds.find(r => r.status === 'completed')?.winningAmount.toLocaleString() || '0'}
             </div>
             <p className="text-xs text-muted-foreground mt-2">
               Round #{rounds.find(r => r.status === 'completed')?.roundNumber || '-'} • {rounds.find(r => r.status === 'completed')?.date || '-'}
             </p>
           </CardContent>
         </Card>
         
         <Card className="border-l-4 border-l-primary shadow-sm">
           <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
             <CardTitle className="text-sm font-medium">Current Cycle</CardTitle>
             <History className="size-4 text-primary" />
           </CardHeader>
           <CardContent>
             <div className="text-2xl font-bold">{rounds.filter(r => r.status === 'completed').length} / 20</div>
             <div className="w-full bg-muted rounded-full h-2 mt-2">
               <div className="bg-primary h-2 rounded-full" style={{ width: `${(rounds.filter(r => r.status === 'completed').length / 20) * 100}%` }}></div>
             </div>
             <p className="text-xs text-muted-foreground mt-2">{Math.round((rounds.filter(r => r.status === 'completed').length / 20) * 100)}% cycle completed</p>
           </CardContent>
         </Card>

         <Card className="border-l-4 border-l-emerald-500 shadow-sm md:col-span-2 lg:col-span-1">
           <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
             <CardTitle className="text-sm font-medium">Total Distributed</CardTitle>
             <Award className="size-4 text-emerald-500" />
           </CardHeader>
           <CardContent>
             <div className="text-2xl font-bold">₹{rounds.reduce((acc, r) => acc + (r.winningAmount || 0), 0).toLocaleString()}</div>
             <p className="text-xs text-muted-foreground mt-1">Across {rounds.filter(r => r.status === 'completed').length} successful rounds</p>
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
            {rounds.map((round) => (
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
            ))}
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
