
"use client"

import { useEffect, useState, useMemo } from "react"
import { Users, IndianRupee, AlertCircle, Calendar, Clock, CheckCircle2, Loader2, Database, Info, ArrowRight } from "lucide-react"
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, query, orderBy } from "firebase/firestore"
import { format, isSameMonth, parseISO } from "date-fns"

export default function DashboardPage() {
  const [mounted, setMounted] = useState(false)
  const [revenueView, setRevenueView] = useState<'month' | 'today'>('month')
  const [selectedSchemeDetail, setSelectedSchemeDetail] = useState<any>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  
  const db = useFirestore()

  const membersQuery = useMemoFirebase(() => collection(db, 'members'), [db])
  const { data: members, isLoading: membersLoading } = useCollection(membersQuery)

  const paymentsQuery = useMemoFirebase(() => query(collection(db, 'payments'), orderBy('paymentDate', 'desc')), [db])
  const { data: payments, isLoading: paymentsLoading } = useCollection(paymentsQuery)

  const roundsQuery = useMemoFirebase(() => query(collection(db, 'chitRounds'), orderBy('createdAt', 'desc')), [db])
  const { data: rounds, isLoading: roundsLoading } = useCollection(roundsQuery)

  useEffect(() => {
    setMounted(true)
  }, [])

  const dashboardData = useMemo(() => {
    if (!mounted || membersLoading || paymentsLoading || roundsLoading) return null;

    const now = new Date()
    const todayStr = format(now, 'yyyy-MM-dd')

    const currentMonthPayments = (payments || []).filter(p => {
      if (!p.paymentDate) return false;
      try {
        return isSameMonth(parseISO(p.paymentDate), now);
      } catch {
        return false;
      }
    })
    
    const collectedThisMonth = currentMonthPayments
      .filter(p => p.status === 'paid' || p.status === 'success')
      .reduce((acc, p) => acc + (p.amountPaid || 0), 0)
    
    const collectedToday = (payments || []).filter(p => {
      if (!p.paymentDate) return false;
      try {
        const pDateStr = format(parseISO(p.paymentDate), 'yyyy-MM-dd');
        return (pDateStr === todayStr || p.targetDate === todayStr) && 
               (p.status === 'paid' || p.status === 'success');
      } catch {
        return false;
      }
    }).reduce((acc, p) => acc + (p.amountPaid || 0), 0)

    // UNIFIED PENDING LOGIC (Same as Rounds & Report)
    const pendingMembersList = (members || []).filter(m => {
        if (m.status === 'inactive') return false;
        
        const scheme = (rounds || []).find(r => r.name === m.chitGroup);
        const resolvedType = (m.paymentType || scheme?.collectionType || "").toLowerCase();
        if (resolvedType !== 'daily') return false;
        
        // Exact Today payment verification
        const hasPaidToday = (payments || []).some(p => 
          p.memberId === m.id &&
          (p.status === 'success' || p.status === 'paid') &&
          (p.targetDate === todayStr || (p.paymentDate && format(parseISO(p.paymentDate), 'yyyy-MM-dd') === todayStr))
        );
        
        return !hasPaidToday;
    });

    // SCHEME AGGREGATES
    const schemeSummaries = (rounds || []).map(round => {
      const groupMembers = (members || []).filter(m => m.chitGroup === round.name && m.status !== 'inactive');
      const totalPendingDays = groupMembers.reduce((acc, m) => acc + (m.pendingDays || 0), 0);
      const totalPendingAmount = groupMembers.reduce((acc, m) => acc + (m.pendingAmount || 0), 0);
      const lastUpdate = groupMembers[0]?.lastPendingUpdateDate || todayStr;

      return {
        ...round,
        totalPendingDays,
        totalPendingAmount,
        lastUpdate
      };
    });

    return {
      activeMembersCount: members?.filter(m => m.status !== 'inactive').length || 0,
      collectedThisMonth,
      collectedToday,
      pendingMembersList,
      schemeSummaries,
      recentWinners: (rounds || []).filter(r => r.winnerName).slice(0, 4),
      recentPaymentsList: (payments || []).filter(p => p.status === 'paid' || p.status === 'success').slice(0, 5)
    }
  }, [mounted, members, payments, rounds, membersLoading, paymentsLoading, roundsLoading])

  if (!mounted || !dashboardData) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    )
  }

  const { activeMembersCount, collectedThisMonth, collectedToday, pendingMembersList, schemeSummaries, recentWinners, recentPaymentsList } = dashboardData;

  const handleSchemeClick = (scheme: any) => {
    setSelectedSchemeDetail(scheme);
    setIsDetailOpen(true);
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-10 overflow-x-hidden">
      <div className="flex flex-col gap-1.5">
        <h2 className="text-2xl sm:text-3xl font-headline font-bold tracking-tight">Dashboard Overview</h2>
        <p className="text-sm sm:text-base text-muted-foreground">Monitor your chit fund's financial health in real-time.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="hover:shadow-md transition-shadow duration-200 border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs sm:text-sm font-bold uppercase tracking-wider text-muted-foreground">Total Members</CardTitle>
            <Users className="size-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl sm:text-3xl font-bold">{activeMembersCount}</div>
            <p className="text-[10px] sm:text-xs text-muted-foreground mt-1 font-medium italic">Active participants</p>
          </CardContent>
        </Card>
        
        <Card className="hover:shadow-md transition-shadow duration-200 overflow-hidden border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs sm:text-sm font-bold uppercase tracking-wider text-muted-foreground">Revenue</CardTitle>
            <div className="flex items-center gap-2">
              <Select value={revenueView} onValueChange={(v: any) => setRevenueView(v)}>
                <SelectTrigger className="h-7 w-fit min-w-[90px] text-[10px] font-bold border-none bg-muted/50 focus:ring-0 shadow-none px-2">
                  <SelectValue placeholder="Period" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="month" className="text-[10px] font-bold">This Month</SelectItem>
                  <SelectItem value="today" className="text-[10px] font-bold">Today</SelectItem>
                </SelectContent>
              </Select>
              <IndianRupee className="size-4 text-emerald-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl sm:text-3xl font-bold text-primary">
              ₹{(revenueView === 'month' ? collectedThisMonth : collectedToday).toLocaleString()}
            </div>
            <p className="text-[10px] sm:text-xs text-muted-foreground font-medium mt-1 italic">
              {revenueView === 'month' ? 'Current Cycle' : 'Collected Today'}
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow duration-200 border-border/50 border-l-4 border-l-destructive">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs sm:text-sm font-bold uppercase tracking-wider text-destructive">Today Pending</CardTitle>
            <AlertCircle className="size-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl sm:text-3xl font-bold text-destructive">{pendingMembersList.length}</div>
            <p className="text-[10px] sm:text-xs text-muted-foreground mt-1 font-medium italic">Daily members who haven't paid today</p>
          </CardContent>
        </Card>
      </div>

      {/* SCHEMES HEALTH OVERVIEW - NEW SECTION */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 border-l-4 border-primary pl-3 py-1">
          <h3 className="text-lg font-bold tracking-tight font-headline">Schemes & Arrears</h3>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {schemeSummaries.map((scheme, i) => (
            <Card 
              key={i} 
              className="group cursor-pointer hover:border-primary/50 transition-all border-border/50 overflow-hidden relative"
              onClick={() => handleSchemeClick(scheme)}
            >
              <div className="absolute top-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <Info className="size-3 text-primary" />
              </div>
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-xs font-bold uppercase text-muted-foreground tracking-widest truncate">{scheme.name}</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="flex items-end justify-between">
                  <div>
                    <div className={cn(
                      "text-2xl font-bold tabular-nums",
                      scheme.totalPendingDays > 0 ? "text-destructive" : "text-emerald-600"
                    )}>
                      {scheme.totalPendingDays}
                    </div>
                    <p className="text-[9px] font-bold uppercase tracking-tight text-muted-foreground">Pending Dates</p>
                  </div>
                  <div className="h-8 w-8 rounded-full bg-muted/50 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                    <ArrowRight className="size-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="border-border/50 overflow-hidden shadow-sm">
          <CardHeader className="bg-muted/10">
            <CardTitle className="text-lg flex items-center gap-2 font-bold">
              Recent Winners
            </CardTitle>
            <CardDescription className="text-xs">Latest auction outcomes.</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            {recentWinners.length > 0 ? (
              <div className="space-y-5">
                {recentWinners.map((winner, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs uppercase">
                      {winner.winnerName?.split(' ').map(n => n[0]).join('') || '?'}
                    </div>
                    <div className="flex-1 min-w-0 space-y-0.5">
                      <p className="text-sm font-bold leading-none truncate">{winner.winnerName}</p>
                      <p className="text-[10px] text-muted-foreground truncate uppercase font-bold tracking-tight">Round #{winner.roundNumber}</p>
                    </div>
                    <div className="font-bold text-emerald-600 text-sm tabular-nums shrink-0">₹{winner.winningAmount?.toLocaleString()}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground italic text-xs">
                No winners recorded yet.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/50 overflow-hidden shadow-sm">
          <CardHeader className="bg-muted/10">
            <CardTitle className="flex items-center gap-2 text-lg font-bold">
               <Clock className="size-5 text-amber-500" />
               Pending Today
            </CardTitle>
            <CardDescription className="text-xs">Daily members without payments.</CardDescription>
          </CardHeader>
          <CardContent className="px-0 pt-0">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="text-[10px] uppercase font-bold tracking-wider pl-6">Member</TableHead>
                  <TableHead className="text-[10px] uppercase font-bold tracking-wider text-right pr-6">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingMembersList.length > 0 ? pendingMembersList.slice(0, 5).map((member, i) => {
                  return (
                    <TableRow key={i} className="hover:bg-muted/5 transition-colors">
                      <TableCell className="text-sm font-semibold pl-6 truncate">{member.name}</TableCell>
                      <TableCell className="text-right pr-6 text-[10px] font-bold text-amber-600 uppercase">Unpaid</TableCell>
                    </TableRow>
                  );
                }) : (
                  <TableRow>
                    <TableCell colSpan={2} className="h-32 text-center text-muted-foreground italic text-xs">
                      Zero pending members.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="border-border/50 overflow-hidden shadow-sm">
          <CardHeader className="bg-muted/10">
            <CardTitle className="flex items-center gap-2 text-lg font-bold">
               <CheckCircle2 className="size-5 text-emerald-500" />
               Recent Activity
            </CardTitle>
            <CardDescription className="text-xs">Latest collection logs.</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
             {recentPaymentsList.length > 0 ? (
               <div className="space-y-4">
                 {recentPaymentsList.map((payment, i) => (
                   <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors border border-transparent hover:border-border/50">
                      <div className="flex flex-col min-w-0">
                         <span className="font-bold text-sm truncate">{payment.memberName}</span>
                         <span className="text-[10px] text-muted-foreground font-medium">{payment.paymentDate ? format(parseISO(payment.paymentDate), 'MMM dd, yyyy') : '-'}</span>
                      </div>
                      <div className="flex items-center gap-1.5 h-10">
                         <span className="font-bold text-emerald-600 text-sm tabular-nums">₹{payment.amountPaid?.toLocaleString()}</span>
                         <span className="text-[9px] uppercase font-bold text-muted-foreground tracking-tight">{payment.status}</span>
                      </div>
                   </div>
                 ))}
               </div>
             ) : (
               <div className="h-[200px] flex items-center justify-center text-muted-foreground italic text-xs">
                 No activity recorded.
               </div>
             )}
          </CardContent>
        </Card>
      </div>

      {/* ARREARS DETAIL DIALOG */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="sm:max-w-[400px]">
          {selectedSchemeDetail && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Database className="size-5 text-primary" />
                  Scheme Arrears Detail
                </DialogTitle>
                <DialogDescription>Financial breakdown for {selectedSchemeDetail.name}</DialogDescription>
              </DialogHeader>
              <div className="py-6 space-y-4">
                <div className="flex flex-col items-center justify-center p-6 bg-muted/30 rounded-2xl border border-dashed border-border/50 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground mb-1">Total Pending Amount</p>
                  <div className="text-3xl font-bold text-destructive">
                    ₹{selectedSchemeDetail.totalPendingAmount?.toLocaleString()}
                  </div>
                  <div className="mt-2 px-3 py-1 rounded-full bg-destructive/10 text-destructive text-[10px] font-bold uppercase tracking-widest">
                    {selectedSchemeDetail.totalPendingDays} Dates Owed
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                   <div className="p-3 bg-muted/20 rounded-xl">
                      <p className="text-[9px] font-bold uppercase text-muted-foreground tracking-tighter mb-0.5">Collection Type</p>
                      <p className="text-sm font-bold">{selectedSchemeDetail.collectionType}</p>
                   </div>
                   <div className="p-3 bg-muted/20 rounded-xl">
                      <p className="text-[9px] font-bold uppercase text-muted-foreground tracking-tighter mb-0.5">As Of Date</p>
                      <p className="text-sm font-bold">{selectedSchemeDetail.lastUpdate ? format(parseISO(selectedSchemeDetail.lastUpdate), 'dd MMM yyyy') : '-'}</p>
                   </div>
                </div>

                <div className="p-4 rounded-xl bg-primary/5 border border-primary/10 flex items-start gap-3">
                  <Info className="size-4 text-primary shrink-0 mt-0.5" />
                  <p className="text-[10px] text-muted-foreground leading-relaxed italic">
                    This amount reflects the cumulative currency deficit across all active daily members in this scheme. Values are calculated automatically based on the 10 PM production batch.
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={() => setIsDetailOpen(false)} className="w-full font-bold uppercase tracking-widest h-10">Close Breakdown</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}
