"use client"

import { useState, useEffect, useMemo } from "react"
import { Download, Printer, Loader2, Database, Filter, CheckCircle2, Clock, Trophy, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, query, orderBy } from "firebase/firestore"
import { format, parseISO, isSameMonth, subMonths } from "date-fns"
import { cn } from "@/lib/utils"

export default function ReportsPage() {
  const [mounted, setMounted] = useState(false)
  const [reportType, setReportType] = useState("all")
  const { toast } = useToast()
  const db = useFirestore()

  const membersQuery = useMemoFirebase(() => collection(db, 'members'), [db])
  const { data: members, isLoading: membersLoading } = useCollection(membersQuery)

  const paymentsQuery = useMemoFirebase(() => query(collection(db, 'payments'), orderBy('paymentDate', 'desc')), [db])
  const { data: payments, isLoading: paymentsLoading } = useCollection(paymentsQuery)

  const roundsQuery = useMemoFirebase(() => query(collection(db, 'chitRounds'), orderBy('date', 'desc')), [db])
  const { data: rounds, isLoading: roundsLoading } = useCollection(roundsQuery)

  useEffect(() => { setMounted(true) }, [])

  const filteredData = useMemo(() => {
    if (!mounted || !members || !payments || !rounds) return null;
    const now = new Date();
    
    // Filter members based on scheme type
    let targetMembers = members;
    if (reportType !== "all") {
      targetMembers = members.filter(m => {
        const round = rounds.find(r => r.name === m.chitGroup);
        return (round?.collectionType || "Monthly").toLowerCase() === reportType;
      });
    }
    const targetIds = new Set(targetMembers.map(m => m.id));
    
    // Filter payments for these members
    const successPayments = payments.filter(p => (p.status === 'paid' || p.status === 'success') && targetIds.has(p.memberId));
    
    // Collection Data (last 6 months)
    const last6Months = Array.from({ length: 6 }).map((_, i) => subMonths(now, i)).reverse()
    const collectionData = last6Months.map(month => ({
      month: format(month, 'MMMM yyyy'),
      amount: successPayments.filter(p => p.paymentDate && isSameMonth(parseISO(p.paymentDate), month)).reduce((acc, p) => acc + (p.amountPaid || 0), 0)
    }))

    // Pending Members (this month)
    const pendingMembers = targetMembers.filter(m => {
      const paidThisMonth = successPayments.some(p => p.memberId === m.id && p.paymentDate && isSameMonth(parseISO(p.paymentDate), now));
      return !paidThisMonth;
    });

    // Winners
    const winners = rounds.filter(r => r.winnerName && (reportType === "all" || (r.collectionType || "Monthly").toLowerCase() === reportType));

    return { 
      successPayments, 
      targetMembers, 
      collectionData, 
      pendingMembers,
      winners,
      roundsList: rounds.filter(r => reportType === "all" || (r.collectionType || "Monthly").toLowerCase() === reportType) 
    };
  }, [mounted, reportType, members, payments, rounds]);

  const handlePrint = () => {
    window.print();
  };

  if (!mounted || membersLoading || paymentsLoading || roundsLoading) {
    return (<div className="flex h-[60vh] items-center justify-center"><Loader2 className="size-8 animate-spin text-primary" /></div>)
  }

  if (!filteredData) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] space-y-4 p-4 text-center">
        <Database className="size-16 text-muted-foreground/20" />
        <h2 className="text-xl font-semibold">No report data available.</h2>
      </div>
    )
  }

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-500 pb-10 overflow-x-hidden print:p-0">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <div className="space-y-1">
          <h2 className="text-2xl sm:text-3xl font-headline font-bold tracking-tight text-primary">Financial Reports</h2>
          <p className="text-sm text-muted-foreground">Comprehensive audit of fund collections and distributions.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
           <Select value={reportType} onValueChange={setReportType}>
             <SelectTrigger className="w-[120px] sm:w-[150px] h-10 text-[10px] font-bold uppercase tracking-wider bg-card shadow-sm">
               <Filter className="mr-2 size-3.5 text-primary" />
               <SelectValue placeholder="Scheme" />
             </SelectTrigger>
             <SelectContent>
               <SelectItem value="all" className="text-[10px] font-bold uppercase">All Schemes</SelectItem>
               <SelectItem value="daily" className="text-[10px] font-bold uppercase">Daily</SelectItem>
               <SelectItem value="monthly" className="text-[10px] font-bold uppercase">Monthly</SelectItem>
             </SelectContent>
           </Select>
           <Button variant="outline" size="sm" className="h-10 px-4 text-[10px] font-bold uppercase tracking-widest shadow-sm hover:bg-muted" onClick={handlePrint}>
             <Printer className="mr-2 size-4" /> Print
           </Button>
           <Button size="sm" className="h-10 px-4 text-[10px] font-bold uppercase tracking-widest shadow-md" onClick={() => toast({ title: "Generating Export...", description: "Your report will download shortly." })}>
             <Download className="mr-2 size-4" /> Export
           </Button>
        </div>
      </div>

      <Tabs defaultValue="collections" className="w-full">
        <TabsList className="grid w-full grid-cols-2 lg:grid-cols-4 h-auto p-1 bg-muted/50 border rounded-xl overflow-x-auto print:hidden">
          <TabsTrigger value="collections" className="py-3 text-[10px] font-bold uppercase tracking-widest data-[state=active]:bg-card data-[state=active]:shadow-sm">Collections</TabsTrigger>
          <TabsTrigger value="members" className="py-3 text-[10px] font-bold uppercase tracking-widest data-[state=active]:bg-card data-[state=active]:shadow-sm">Members</TabsTrigger>
          <TabsTrigger value="pending" className="py-3 text-[10px] font-bold uppercase tracking-widest data-[state=active]:bg-card data-[state=active]:shadow-sm">Pending Dues</TabsTrigger>
          <TabsTrigger value="winners" className="py-3 text-[10px] font-bold uppercase tracking-widest data-[state=active]:bg-card data-[state=active]:shadow-sm">Winners</TabsTrigger>
        </TabsList>

        <TabsContent value="collections" className="mt-8">
          <Card className="border-border/50 overflow-hidden shadow-sm">
            <div className="p-4 border-b bg-muted/20">
              <h3 className="text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                <Database className="size-4 text-primary" /> Monthly Revenue Summary
              </h3>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead className="text-[10px] uppercase font-bold tracking-widest h-12 pl-6">Period</TableHead>
                    <TableHead className="text-right text-[10px] uppercase font-bold tracking-widest h-12 pr-6">Total Collection</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredData.collectionData.map((row, i) => (
                    <TableRow key={i} className="hover:bg-muted/5 transition-colors h-14">
                      <TableCell className="font-bold text-sm pl-6">{row.month}</TableCell>
                      <TableCell className="text-right font-bold text-emerald-600 text-sm tabular-nums pr-6">₹{row.amount.toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="members" className="mt-8">
          <Card className="border-border/50 overflow-hidden shadow-sm">
            <div className="p-4 border-b bg-muted/20">
              <h3 className="text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                <Users className="size-4 text-primary" /> Active Member Directory
              </h3>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead className="text-[10px] uppercase font-bold tracking-widest h-12 pl-6">Member Name</TableHead>
                    <TableHead className="text-[10px] uppercase font-bold tracking-widest h-12">Scheme / Group</TableHead>
                    <TableHead className="text-right text-[10px] uppercase font-bold tracking-widest h-12">Monthly Due</TableHead>
                    <TableHead className="text-center text-[10px] uppercase font-bold tracking-widest h-12 pr-6">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredData.targetMembers.length > 0 ? filteredData.targetMembers.map((m, i) => (
                    <TableRow key={i} className="hover:bg-muted/5 transition-colors h-14">
                      <TableCell className="font-bold text-sm pl-6">{m.name}</TableCell>
                      <TableCell className="text-[10px] font-bold text-primary uppercase tracking-tight">{m.chitGroup || "N/A"}</TableCell>
                      <TableCell className="text-right font-bold text-sm tabular-nums">₹{m.monthlyAmount?.toLocaleString()}</TableCell>
                      <TableCell className="text-center pr-6">
                        <Badge variant={m.status === 'active' ? 'default' : 'secondary'} className="text-[8px] font-bold uppercase px-2 shadow-none border-none">
                          {m.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  )) : (
                    <TableRow>
                      <TableCell colSpan={4} className="h-40 text-center text-muted-foreground italic text-sm">No member data for selected criteria.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="pending" className="mt-8">
          <Card className="border-border/50 overflow-hidden shadow-sm">
            <div className="p-4 border-b bg-muted/20">
              <h3 className="text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                <Clock className="size-4 text-amber-500" /> Outstanding Collections
              </h3>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead className="text-[10px] uppercase font-bold tracking-widest h-12 pl-6">Member</TableHead>
                    <TableHead className="text-[10px] uppercase font-bold tracking-widest h-12">Contact</TableHead>
                    <TableHead className="text-right text-[10px] uppercase font-bold tracking-widest h-12 pr-6">Amount Due</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredData.pendingMembers.length > 0 ? filteredData.pendingMembers.map((m, i) => (
                    <TableRow key={i} className="hover:bg-muted/5 transition-colors h-14">
                      <TableCell className="font-bold text-sm pl-6">{m.name}</TableCell>
                      <TableCell className="text-xs font-medium text-muted-foreground tabular-nums">{m.phone}</TableCell>
                      <TableCell className="text-right font-bold text-amber-600 text-sm tabular-nums pr-6">₹{m.monthlyAmount?.toLocaleString()}</TableCell>
                    </TableRow>
                  )) : (
                    <TableRow>
                      <TableCell colSpan={3} className="h-40 text-center text-emerald-600 font-bold text-sm">
                        <CheckCircle2 className="size-8 mx-auto mb-2 opacity-30" />
                        All collections complete for this cycle!
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="winners" className="mt-8">
          <Card className="border-border/50 overflow-hidden shadow-sm">
            <div className="p-4 border-b bg-muted/20">
              <h3 className="text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                <Trophy className="size-4 text-amber-500" /> Auction History
              </h3>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead className="text-[10px] uppercase font-bold tracking-widest h-12 pl-6">Winner Name</TableHead>
                    <TableHead className="text-[10px] uppercase font-bold tracking-widest h-12">Scheme</TableHead>
                    <TableHead className="text-[10px] uppercase font-bold tracking-widest h-12">Round #</TableHead>
                    <TableHead className="text-right text-[10px] uppercase font-bold tracking-widest h-12 pr-6">Winning Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredData.winners.length > 0 ? filteredData.winners.map((r, i) => (
                    <TableRow key={i} className="hover:bg-muted/5 transition-colors h-14">
                      <TableCell className="font-bold text-sm pl-6">{r.winnerName}</TableCell>
                      <TableCell className="text-[10px] font-bold text-primary uppercase">{r.name}</TableCell>
                      <TableCell className="text-xs font-bold text-muted-foreground">{r.roundNumber}</TableCell>
                      <TableCell className="text-right font-bold text-emerald-600 text-sm tabular-nums pr-6">₹{r.winningAmount?.toLocaleString()}</TableCell>
                    </TableRow>
                  )) : (
                    <TableRow>
                      <TableCell colSpan={4} className="h-40 text-center text-muted-foreground italic text-sm">No auctions completed yet.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
