
"use client"

import { useEffect, useState, useMemo } from "react"
import { Users, IndianRupee, Clock, CheckCircle2, Loader2, Info, ArrowRight, FolderKanban, User, CalendarDays } from "lucide-react"
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
import { Badge } from "@/components/ui/badge"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, query, orderBy } from "firebase/firestore"
import { format, isSameMonth, parseISO } from "date-fns"
import { cn } from "@/lib/utils"

export default function DashboardPage() {
  const [mounted, setMounted] = useState(false)
  const [revenueView, setRevenueView] = useState<'month' | 'today'>('month')
  
  // Dialog States
  const [selectedGroup, setSelectedGroup] = useState<any>(null)
  const [isGroupDetailOpen, setIsGroupDetailOpen] = useState(false)
  const [selectedMemberDebt, setSelectedMemberDebt] = useState<any>(null)
  const [isMemberArrearsOpen, setIsMemberArrearsOpen] = useState(false)
  
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

    // Revenue calculations
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

    // Today Pending Logic (Reuse Group Logic: Daily only, no payment today)
    const pendingMembersList = (members || []).filter(m => {
        if (m.status === 'inactive') return false;
        const scheme = (rounds || []).find(r => r.name === m.chitGroup);
        const resolvedType = (m.paymentType || scheme?.collectionType || "").toLowerCase();
        if (resolvedType !== 'daily') return false;
        
        const hasPaidToday = (payments || []).some(p => 
          p.memberId === m.id &&
          (p.status === 'success' || p.status === 'paid') &&
          (p.targetDate === todayStr || (p.paymentDate && format(parseISO(p.paymentDate), 'yyyy-MM-dd') === todayStr))
        );
        return !hasPaidToday;
    });

    // 4-Group Logic (Group A, B, C, D cards)
    const fixedGroupNames = ['A', 'B', 'C', 'D'];
    const schemeSummaries = fixedGroupNames.map(name => {
      const schemeInfo = (rounds || []).find(r => r.name === name) || { name, collectionType: 'Daily', monthlyAmount: 800 };
      const groupMembers = (members || []).filter(m => m.chitGroup === name && m.status !== 'inactive');
      const totalPendingDays = groupMembers.reduce((acc, m) => acc + (m.pendingDays || 0), 0);
      
      return {
        ...schemeInfo,
        totalPendingDays,
        memberCount: groupMembers.length,
        members: groupMembers
      };
    });

    return {
      activeMembersCount: members?.filter(m => m.status !== 'inactive').length || 0,
      collectedThisMonth,
      collectedToday,
      pendingMembersList,
      schemeSummaries,
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

  const { activeMembersCount, collectedThisMonth, collectedToday, pendingMembersList, schemeSummaries, recentPaymentsList } = dashboardData;

  const handleGroupClick = (scheme: any) => {
    setSelectedGroup(scheme);
    setIsGroupDetailOpen(true);
  }

  const handleMemberArrearsClick = (member: any) => {
    setSelectedMemberDebt(member);
    setIsMemberArrearsOpen(true);
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-10 overflow-x-hidden">
      <div className="flex flex-col gap-1.5">
        <h2 className="text-2xl sm:text-3xl font-headline font-bold tracking-tight">Financial Command Center</h2>
        <p className="text-sm sm:text-base text-muted-foreground">Real-time health monitoring for Groups A, B, C, and D.</p>
      </div>

      {/* Main Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="hover:shadow-md transition-shadow duration-200 border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Active Seats</CardTitle>
            <Users className="size-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl sm:text-3xl font-bold">{activeMembersCount}</div>
            <p className="text-[10px] text-muted-foreground mt-1 font-medium italic">Verified participants</p>
          </CardContent>
        </Card>
        
        <Card className="hover:shadow-md transition-shadow duration-200 border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Collections</CardTitle>
            <div className="flex items-center gap-2">
              <Select value={revenueView} onValueChange={(v: any) => setRevenueView(v)}>
                <SelectTrigger className="h-7 w-fit min-w-[90px] text-[10px] font-bold border-none bg-muted/50 focus:ring-0 shadow-none px-2">
                  <SelectValue />
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
            <p className="text-[10px] text-muted-foreground font-medium mt-1 italic">
              {revenueView === 'month' ? 'Total Revenue (Cycle)' : 'Captured Today'}
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow duration-200 border-border/50 border-l-4 border-l-destructive">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-destructive">Unpaid Today</CardTitle>
            <Clock className="size-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl sm:text-3xl font-bold text-destructive">{pendingMembersList.length}</div>
            <p className="text-[10px] text-muted-foreground mt-1 font-medium italic">Daily members with no transaction</p>
          </CardContent>
        </Card>
      </div>

      {/* Schemes Overview (Group A, B, C, D cards) 🗂️ */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 border-l-4 border-primary pl-3 py-1">
          <h3 className="text-lg font-bold tracking-tight font-headline">🗂️ Schemes Monitor (4-Group System)</h3>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {schemeSummaries.map((scheme, i) => (
            <Card 
              key={i} 
              className="group cursor-pointer hover:border-primary/50 transition-all border-border/50 overflow-hidden relative shadow-sm"
              onClick={() => handleGroupClick(scheme)}
            >
              <div className="absolute top-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <ArrowRight className="size-3 text-primary" />
              </div>
              <CardHeader className="p-4 pb-2 bg-muted/10">
                <CardTitle className="text-[10px] font-bold uppercase text-muted-foreground tracking-[0.2em] truncate">Group {scheme.name}</CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <div className="flex items-end justify-between">
                  <div>
                    <div className={cn(
                      "text-2xl font-bold tabular-nums transition-colors flex items-center gap-2",
                      scheme.totalPendingDays > 0 ? "text-destructive" : "text-emerald-600"
                    )}>
                      <Clock className="size-4 opacity-50" /> {scheme.totalPendingDays}
                    </div>
                    <p className="text-[9px] font-bold uppercase tracking-tight text-muted-foreground">⏳ Pending Dates</p>
                  </div>
                  <div className="text-[10px] font-bold text-muted-foreground/50">{scheme.memberCount} Members</div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Latest Collections Log */}
        <Card className="border-border/50 overflow-hidden shadow-sm lg:col-span-2">
          <CardHeader className="bg-muted/10">
            <CardTitle className="flex items-center gap-2 text-lg font-bold">
               <CheckCircle2 className="size-5 text-emerald-500" />
               Recent Transactions
            </CardTitle>
            <CardDescription className="text-xs">Audit log of latest verified payments.</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
             {recentPaymentsList.length > 0 ? (
               <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                 {recentPaymentsList.map((payment, i) => (
                   <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors border border-transparent hover:border-border/50">
                      <div className="flex flex-col min-w-0">
                         <span className="font-bold text-sm truncate">{payment.memberName}</span>
                         <span className="text-[9px] text-muted-foreground font-medium uppercase tracking-tighter">
                            {payment.paymentDate ? format(parseISO(payment.paymentDate), 'MMM dd') : '-'}
                         </span>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="font-bold text-emerald-600 text-sm tabular-nums">₹{payment.amountPaid?.toLocaleString()}</span>
                        <span className="text-[9px] uppercase font-bold text-muted-foreground tracking-tight">{payment.method}</span>
                      </div>
                   </div>
                 ))}
               </div>
             ) : (
               <div className="h-[100px] flex items-center justify-center text-muted-foreground italic text-xs">
                 No transactions captured in this session.
               </div>
             )}
          </CardContent>
        </Card>
      </div>

      {/* GROUP DETAIL DIALOG */}
      <Dialog open={isGroupDetailOpen} onOpenChange={setIsGroupDetailOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[85vh] flex flex-col p-0 overflow-hidden">
          {selectedGroup && (
            <>
              <DialogHeader className="p-6 border-b bg-muted/10">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold">
                    <FolderKanban className="size-5" />
                  </div>
                  <div>
                    <DialogTitle className="text-xl">Group {selectedGroup.name} Registry</DialogTitle>
                    <DialogDescription className="text-xs font-bold uppercase tracking-widest text-primary/70">
                      Isolated member list for this scheme
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>
              
              <div className="flex-1 overflow-y-auto">
                <Table>
                  <TableHeader className="bg-muted/30 sticky top-0 z-10">
                    <TableRow>
                      <TableHead className="text-[10px] uppercase font-bold tracking-widest pl-6">Participant</TableHead>
                      <TableHead className="text-[10px] uppercase font-bold tracking-widest">Payment Status</TableHead>
                      <TableHead className="text-[10px] uppercase font-bold tracking-widest text-center">⏳ Pending Days</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedGroup.members.length > 0 ? selectedGroup.members.map((m: any) => {
                       const isPaidToday = (payments || []).some(p => 
                        p.memberId === m.id &&
                        (p.status === 'success' || p.status === 'paid') &&
                        (p.targetDate === format(new Date(), 'yyyy-MM-dd') || (p.paymentDate && format(parseISO(p.paymentDate), 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')))
                      );

                      return (
                        <TableRow key={m.id} className="hover:bg-muted/5 transition-colors">
                          <TableCell className="pl-6 py-4">
                            <div className="flex flex-col">
                              <span className="text-sm font-bold">{m.name}</span>
                              <span className="text-[10px] text-muted-foreground">{m.phone}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={isPaidToday ? "default" : "secondary"} className={cn(
                              "text-[8px] font-bold uppercase px-2",
                              isPaidToday ? "bg-emerald-500 hover:bg-emerald-600" : "bg-amber-100 text-amber-700"
                            )}>
                              {isPaidToday ? "PAID TODAY" : "UNPAID"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <button 
                              className={cn(
                                "inline-flex items-center justify-center px-3 py-1 rounded-full text-[10px] font-bold uppercase transition-all active:scale-95",
                                m.pendingDays > 0 ? "bg-destructive/10 text-destructive border border-destructive/20" : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              )}
                              onClick={() => handleMemberArrearsClick(m)}
                            >
                              ⏳ {m.pendingDays || 0}
                            </button>
                          </TableCell>
                        </TableRow>
                      );
                    }) : (
                      <TableRow>
                        <TableCell colSpan={3} className="h-32 text-center text-muted-foreground italic text-xs">
                          No active members in this group.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              <DialogFooter className="p-4 border-t bg-muted/5">
                <Button onClick={() => setIsGroupDetailOpen(false)} className="w-full font-bold uppercase tracking-widest h-10">Close Registry</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* MEMBER ARREARS POPUP 💬 */}
      <Dialog open={isMemberArrearsOpen} onOpenChange={setIsMemberArrearsOpen}>
        <DialogContent className="sm:max-w-[400px]">
          {selectedMemberDebt && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3 mb-2">
                  <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold">
                    <User className="size-5" />
                  </div>
                  <div>
                    <DialogTitle className="text-lg">💬 Arrears Summary</DialogTitle>
                    <DialogDescription className="text-xs font-bold text-muted-foreground">
                      Financial audit for {selectedMemberDebt.name}
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>
              
              <div className="py-6 space-y-5">
                <div className="flex flex-col items-center justify-center p-6 bg-muted/30 rounded-2xl border border-dashed border-border/50 text-center relative overflow-hidden">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground mb-1">Current Pending Amount</p>
                  <div className="text-4xl font-bold text-destructive tabular-nums">
                    ₹{(selectedMemberDebt.pendingAmount || 0).toLocaleString()}
                  </div>
                  <div className="mt-3 px-3 py-1 rounded-full bg-destructive/10 text-destructive text-[10px] font-bold uppercase tracking-widest flex items-center gap-2">
                    ⏳ {selectedMemberDebt.pendingDays || 0} Missed Installments
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                   <div className="p-3 bg-muted/20 rounded-xl border border-transparent">
                      <p className="text-[9px] font-bold uppercase text-muted-foreground tracking-tighter mb-0.5">Scheme Unit</p>
                      <p className="text-sm font-bold">₹{(selectedMemberDebt.monthlyAmount || 800).toLocaleString()}</p>
                   </div>
                   <div className="p-3 bg-muted/20 rounded-xl border border-transparent">
                      <p className="text-[9px] font-bold uppercase text-muted-foreground tracking-tighter mb-0.5">Last Sync</p>
                      <div className="flex items-center gap-1.5">
                        <CalendarDays className="size-3 text-primary opacity-50" />
                        <p className="text-sm font-bold">
                          {selectedMemberDebt.lastPendingUpdateDate ? format(parseISO(selectedMemberDebt.lastPendingUpdateDate), 'dd MMM yyyy') : '-'}
                        </p>
                      </div>
                   </div>
                </div>

                <div className="p-4 rounded-xl bg-primary/5 border border-primary/10 flex items-start gap-3">
                  <Info className="size-4 text-primary shrink-0 mt-0.5" />
                  <p className="text-[10px] text-muted-foreground leading-relaxed italic">
                    Pending amounts and dates are automatically aged daily at 10 PM. This reflects the total currency deficit up to the last reconciliation cycle.
                  </p>
                </div>
              </div>
              
              <DialogFooter>
                <Button onClick={() => setIsMemberArrearsOpen(false)} className="w-full font-bold uppercase tracking-widest h-10">Close Details</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
