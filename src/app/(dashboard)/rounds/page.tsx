
"use client"

import { useState } from "react"
import { Trophy, History, Plus, Award, Calendar, IndianRupee } from "lucide-react"
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
import { useToast } from "@/hooks/use-toast"

const initialRounds = [
  { id: "1", roundNumber: 12, winnerName: "John Doe", winningAmount: 45000, date: "2023-09-15", commission: 5000 },
  { id: "2", roundNumber: 11, winnerName: "Sarah Smith", winningAmount: 45000, date: "2023-08-15", commission: 5000 },
  { id: "3", roundNumber: 10, winnerName: "Michael Chen", winningAmount: 45000, date: "2023-07-15", commission: 5000 },
  { id: "4", roundNumber: 9, winnerName: "Emma Watson", winningAmount: 45000, date: "2023-06-15", commission: 5000 },
  { id: "5", roundNumber: 8, winnerName: "Robert Wilson", winningAmount: 45000, date: "2023-05-15", commission: 5000 },
]

export default function RoundsPage() {
  const [rounds] = useState(initialRounds)
  const { toast } = useToast()

  const startNewRound = () => {
    toast({
      title: "New Round Started",
      description: "Collection phase for Round 13 has begun.",
    })
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-headline font-bold tracking-tight">Chit Rounds</h2>
          <p className="text-muted-foreground">Historical records of chit auctions and winners.</p>
        </div>
        <Button className="h-11 px-6 shadow-lg hover:shadow-xl transition-all" onClick={startNewRound}>
          <Plus className="mr-2 size-5" />
          Start New Round
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
         <Card className="border-l-4 border-l-accent shadow-sm">
           <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
             <CardTitle className="text-sm font-medium">Last Round Winner</CardTitle>
             <Trophy className="size-4 text-accent" />
           </CardHeader>
           <CardContent>
             <div className="text-2xl font-bold">John Doe</div>
             <div className="flex items-center gap-1.5 mt-1 text-emerald-600 font-medium">
               <IndianRupee className="size-3.5" />
               45,000
             </div>
             <p className="text-xs text-muted-foreground mt-2">Round 12 • Sep 15, 2023</p>
           </CardContent>
         </Card>
         
         <Card className="border-l-4 border-l-primary shadow-sm">
           <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
             <CardTitle className="text-sm font-medium">Current Cycle</CardTitle>
             <History className="size-4 text-primary" />
           </CardHeader>
           <CardContent>
             <div className="text-2xl font-bold">12 / 20</div>
             <div className="w-full bg-muted rounded-full h-2 mt-2">
               <div className="bg-primary h-2 rounded-full" style={{ width: '60%' }}></div>
             </div>
             <p className="text-xs text-muted-foreground mt-2">60% cycle completed</p>
           </CardContent>
         </Card>

         <Card className="border-l-4 border-l-emerald-500 shadow-sm md:col-span-2 lg:col-span-1">
           <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
             <CardTitle className="text-sm font-medium">Total Distributed</CardTitle>
             <Award className="size-4 text-emerald-500" />
           </CardHeader>
           <CardContent>
             <div className="text-2xl font-bold">₹5,40,000</div>
             <p className="text-xs text-muted-foreground mt-1">Across 12 successful rounds</p>
           </CardContent>
         </Card>
      </div>

      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead className="font-semibold">Round #</TableHead>
              <TableHead className="font-semibold">Winner</TableHead>
              <TableHead className="font-semibold">Winning Amount</TableHead>
              <TableHead className="font-semibold">Admin Commission</TableHead>
              <TableHead className="font-semibold">Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rounds.map((round) => (
              <TableRow key={round.id} className="hover:bg-muted/10 transition-colors">
                <TableCell className="font-bold text-primary">#{round.roundNumber}</TableCell>
                <TableCell>
                  <div className="font-medium">{round.winnerName}</div>
                </TableCell>
                <TableCell>
                  <div className="font-bold text-emerald-600">₹{round.winningAmount.toLocaleString()}</div>
                </TableCell>
                <TableCell>
                  <div className="text-muted-foreground font-medium">₹{round.commission.toLocaleString()}</div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="size-3.5" />
                    {round.date}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
