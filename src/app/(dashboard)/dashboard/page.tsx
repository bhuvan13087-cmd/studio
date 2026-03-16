
"use client"

import { useEffect, useState, useMemo } from "react"
import { Users, IndianRupee, AlertCircle, Calendar, Clock, CheckCircle2, Loader2, Database } from "lucide-react"
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
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, query, orderBy } from "firebase/firestore"
import { format, isSameMonth, parseISO, startOfDay } from "date-fns"

export default function DashboardPage() {
  const [mounted, setMounted] = useState(false)
  const [revenueView, setRevenueView] = useState<'month' | 'today'>('month')
  const db = useFirestore()

  const membersQuery = useMemoFirebase(() => collection(db, 'members'), [db])
  const { data: members, isLoading: membersLoading } = useCollection(membersQuery)

  const paymentsQuery = useMemoFirebase(() => query(collection(db, 'payments'), orderBy('paymentDate', 'desc')), [db])
  const { data: payments, isLoading: paymentsLoading } = useCollection(paymentsQuery)

  const roundsQuery = useMemoFirebase(() => query(collection(db, 'chitRounds'), orderBy('date', 'desc')), [db])
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
        return format(parseISO(p.paymentDate), 'yyyy-MM-dd') === todayStr && 
               (p.status === 'paid' || p.status === 'success');
      } catch {
        return false;
      }
    }).reduce((acc, p) => acc + (p.amountPaid || 0), 0)

    const pendingSummary = (members || []).filter(m => m.status !== 'inactive').map(m => {
        const memberPayments = (payments || []).filter(p => p.memberId === m.id);
        const hasPaidToday = memberPayments.some(p => 
          (p.status === 'paid' || p.status === 'success') && 
          p.paymentDate && 
          format(parseISO(p.paymentDate), 'yyyy-MM-dd') === todayStr
        );
        const pendingTotal = memberPayments
          .filter(p => p.status === 'pending')
          .reduce((acc, p) => acc + (p.amountPaid || 0), 0);

        return {
          ...m,
          hasPaidToday,
          pendingTotal
        };
    });

    const pendingMembersList = pendingSummary.filter(s => !s.hasPaidToday || s.pendingTotal > 0);

    return {
      activeMembersCount: members?.filter(m => m.status !== 'inactive').length || 0,
      collectedThisMonth,
      collectedToday,
      pendingMembersList,
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

  const { activeMembersCount, collectedThisMonth, collectedToday, pendingMembersList, recentWinners, recentPaymentsList } = dashboardData;

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

        <Card className="hover:shadow-md transition-shadow duration-200 border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs sm:text-sm font-bold uppercase tracking-wider text-muted-foreground">Outstanding</CardTitle>
            <AlertCircle className="size-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl sm:text-3xl font-bold text-destructive">{pendingMembersList.length}</div>
            <p className="text-[10px] sm:text-xs text-muted-foreground mt-1 font-medium italic">Members with dues (Today or Pending)</p>
          </CardContent>
        </Card>
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
               Pending Dues
            </CardTitle>
            <CardDescription className="text-xs">Members with unpaid balances.</CardDescription>
          </CardHeader>
          <CardContent className="px-0 pt-0">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="text-[10px] uppercase font-bold tracking-wider pl-6">Member</TableHead>
                  <TableHead className="text-[10px] uppercase font-bold tracking-wider text-right pr-6">Due (₹)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingMembersList.length > 0 ? pendingMembersList.slice(0, 5).map((member, i) => {
                  return (
                    <TableRow key={i} className="hover:bg-muted/5 transition-colors">
                      <TableCell className="text-sm font-semibold pl-6 truncate">{member.name}</TableCell>
                      <TableCell className="text-right pr-6 text-sm font-bold text-amber-600">₹{((member.pendingTotal || 0) + (member.hasPaidToday ? 0 : (member.monthlyAmount || 0))).toLocaleString()}</TableCell>
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
    </div>
  )
}
