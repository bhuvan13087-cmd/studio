
"use client"

import { useEffect, useState, useMemo } from "react"
import { Users, IndianRupee, Clock, CheckCircle2, Loader2, Info, ArrowRight, FolderKanban, User, CalendarDays, RefreshCcw, LayoutDashboard, ShieldCheck } from "lucide-react"
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
import { format, isSameMonth, parseISO, startOfDay, eachDayOfInterval, isBefore, max } from "date-fns"
import { cn } from "@/lib/utils"

// STRICT SYSTEM START DATE
const CALCULATION_START_DATE = parseISO('2026-04-01');

export default function DashboardPage() {
  const [mounted, setMounted] = useState(false)
  const [revenueView, setRevenueView] = useState<'month' | 'today'>('month')
  
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

  // Helper to clean and format group names
  const getDisplayName = (name: string) => {
    if (!name) return "";
    const clean = name.replace(/Group/gi, '').trim();
    return `Group ${clean}`;
  };

  const dashboardData = useMemo(() => {
    if (!mounted || membersLoading || paymentsLoading || roundsLoading) return null;

    const now = new Date()
    const todayStr = format(now, 'yyyy-MM-dd')
    const today = startOfDay(now);
    const currentMonthStr = format(now, 'MMMM yyyy');
    const currentDayOfMonth = now.getDate();

    // Helper to extract amount resiliently
    const getPAmount = (p: any) => Number(p.amountPaid || p.amount || 0);
    // Helper to extract date from record resiliently
    const getPDateStr = (p: any) => {
      if (p.targetDate) return p.targetDate;
      const d = p.paymentDate?.toDate ? p.paymentDate.toDate() : (p.paymentDate ? new Date(p.paymentDate) : null);
      if (d && !isNaN(d.getTime())) return d.toISOString().split('T')[0];
      return null;
    }

    const currentMonthPayments = (payments || []).filter(p => {
      if (!p.paymentDate && !p.createdAt) return false;
      try {
        const pDate = p.paymentDate?.toDate ? p.paymentDate.toDate() : (p.paymentDate ? parseISO(p.paymentDate) : parseISO(p.createdAt));
        return isSameMonth(pDate, now) && (p.status === 'paid' || p.status === 'success' || !p.status);
      } catch {
        return false;
      }
    })
    
    const collectedThisMonth = currentMonthPayments.reduce((acc, p) => acc + getPAmount(p), 0)
    
    const collectedToday = (payments || []).filter(p => {
      return getPDateStr(p) === todayStr && (p.status === 'paid' || p.status === 'success' || !p.status);
    }).reduce((acc, p) => acc + getPAmount(p), 0)

    const membersWithCalculatedStats = (members || []).filter(m => m.status !== 'inactive').map(m => {
      const mPayments = (payments || []).filter(p => p.memberId === m.id && (p.status === 'success' || p.status === 'paid' || !p.status));
      const scheme = (rounds || []).find(r => r.name === m.chitGroup);
      const resolvedType = (m.paymentType || scheme?.collectionType || "Daily");
      
      let pendingDaysCount = 0;
      let memberStatus: 'paid' | 'pending' | 'waiting' = 'pending';

      if (resolvedType === 'Daily') {
        if (m.joinDate) {
          try {
            const rawJoinDate = parseISO(m.joinDate);
            const effectiveStart = startOfDay(max([rawJoinDate, CALCULATION_START_DATE]));
            
            if (isBefore(effectiveStart, today.getTime() + 86400000)) {
              const interval = eachDayOfInterval({ start: effectiveStart, end: today });
              interval.forEach(day => {
                const dStr = format(day, 'yyyy-MM-dd');
                const dayPaymentSum = mPayments
                  .filter(p => getPDateStr(p) === dStr)
                  .reduce((acc, p) => acc + getPAmount(p), 0);
                
                if (dayPaymentSum < (m.monthlyAmount || 800)) {
                  pendingDaysCount++;
                }
              });
            }
          } catch {}
        }
        memberStatus = mPayments.filter(p => getPDateStr(p) === todayStr).reduce((acc, p) => acc + getPAmount(p), 0) >= (m.monthlyAmount || 800) ? 'paid' : 'pending';
      } else {
        // Monthly logic
        const dueDate = scheme?.dueDate || 5;
        const hasPaidThisMonth = mPayments.some(p => p.month === currentMonthStr);
        
        if (hasPaidThisMonth) {
          memberStatus = 'paid';
          pendingDaysCount = 0;
        } else if (currentDayOfMonth < dueDate) {
          memberStatus = 'waiting';
          pendingDaysCount = 0;
        } else {
          memberStatus = 'pending';
          pendingDaysCount = 1;
        }
      }

      return {
        ...m,
        calculatedPendingDays: pendingDaysCount,
        calculatedPendingAmount: pendingDaysCount * (m.monthlyAmount || 800),
        memberStatus: memberStatus
      };
    });

    const pendingMembersList = membersWithCalculatedStats.filter(m => m.memberStatus === 'pending');

    const fixedGroupNames = ['A', 'B', 'C', 'D'];
    const schemeSummaries = fixedGroupNames.map(name => {
      const schemeInfo = (rounds || []).find(r => r.name === name) || { name, collectionType: 'Daily', monthlyAmount: 800, dueDate: 5 };
      const groupMembers = membersWithCalculatedStats.filter(m => m.chitGroup === name);
      const totalPendingDays = groupMembers.reduce((acc, m) => acc + m.calculatedPendingDays, 0);
      
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
      recentPaymentsList: (payments || []).filter(p => p.status === 'paid' || p.status === 'success' || !p.status).slice(0, 5)
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
    <div className="space-y-10 animate-in fade-in duration-700 pb-10 overflow-x-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <h2 className="text-2xl sm:text-4xl font-black tracking-tight text-primary font-headline uppercase">Financial Command Center</h2>
          <p className="text-sm sm:text-base text-muted-foreground font-medium flex items-center gap-2">
            <ShieldCheck className="size-4 text-primary" /> Real-time monitoring for Groups A, B, C, and D.
          </p>
        </div>
        <Button variant="outline" className="font-bold gap-2 h-11 px-6 shadow-sm border-border/60 hover:bg-muted/50 transition-all active:scale-95" onClick={() => window.location.reload()}>
          <RefreshCcw className="size-4 text-primary" /> Sync Status
        </Button>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="hover:shadow-xl transition-all duration-300 border-border/60 rounded-2xl bg-card shadow-sm group">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0 p-6">
            <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/70">Total Active Seats</CardTitle>
            <div className="h-10 w-10 rounded-xl bg-primary/5 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-300">
               <Users className="size-5" />
            </div>
          </CardHeader>
          <CardContent className="p-6 pt-0">
            <div className="text-4xl font-black tracking-tighter tabular-nums mb-1">{activeMembersCount}</div>
            <div className="text-[11px] text-muted-foreground font-semibold flex items-center gap-1.5 mt-2">
               <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> Verified participants
            </div>
          </CardContent>
        </Card>
        
        <Card className="hover:shadow-xl transition-all duration-300 border-border/60 rounded-2xl bg-card shadow-sm group">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0 p-6">
            <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/70">Group Collections</CardTitle>
            <Select value={revenueView} onValueChange={(v: any) => setRevenueView(v)}>
              <SelectTrigger className="h-8 w-fit min-w-[100px] text-[10px] font-black border-none bg-muted/50 focus:ring-0 shadow-none px-3 rounded-lg">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="month" className="text-[10px] font-black uppercase">Month Cycle</SelectItem>
                <SelectItem value="today" className="text-[10px] font-black uppercase">Captured Today</SelectItem>
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent className="p-6 pt-0">
            <div className="text-4xl font-black tracking-tighter text-primary tabular-nums mb-1">
              ₹{(revenueView === 'month' ? collectedThisMonth : collectedToday).toLocaleString()}
            </div>
            <div className="text-[11px] text-muted-foreground font-semibold mt-2 flex items-center gap-1.5">
               <IndianRupee className="size-3.5 text-emerald-600" /> {revenueView === 'month' ? 'Total Period Revenue' : 'Real-time Daily Intake'}
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-xl transition-all duration-300 border-border/60 rounded-2xl bg-card shadow-sm group border-l-4 border-l-destructive">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0 p-6">
            <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-destructive/70">Arrears Alert</CardTitle>
            <div className="h-10 w-10 rounded-xl bg-destructive/5 flex items-center justify-center text-destructive group-hover:bg-destructive group-hover:text-destructive-foreground transition-all duration-300">
               <Clock className="size-5" />
            </div>
          </CardHeader>
          <CardContent className="p-6 pt-0">
            <div className="text-4xl font-black tracking-tighter text-destructive tabular-nums mb-1">{pendingMembersList.length}</div>
            <div className="text-[11px] text-muted-foreground font-semibold mt-2 flex items-center gap-1.5 italic">
               Unpaid Installments
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {schemeSummaries.map((scheme, i) => (
            <Card 
              key={i} 
              className="group cursor-pointer hover:border-primary hover:shadow-xl transition-all border-border/60 overflow-hidden relative shadow-sm rounded-2xl"
              onClick={() => handleGroupClick(scheme)}
            >
              <div className="absolute top-0 right-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity">
                <ArrowRight className="size-4 text-primary" />
              </div>
              <CardHeader className="p-5 pb-2 bg-muted/10 border-b border-border/40">
                <CardTitle className="text-[11px] font-black uppercase text-muted-foreground tracking-[0.3em] truncate">
                  {getDisplayName(scheme.name)}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5">
                <div className="flex items-end justify-between">
                  <div>
                    <div className={cn(
                      "text-3xl font-black tabular-nums transition-colors flex items-center gap-3 mb-1",
                      scheme.totalPendingDays > 0 ? "text-destructive" : "text-emerald-600"
                    )}>
                      {scheme.totalPendingDays}
                    </div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 flex items-center gap-1.5">
                      <Clock className="size-3" /> {scheme.collectionType === 'Daily' ? 'Cumulative Arrears' : 'Pending Members'}
                    </p>
                  </div>
                  <div className="text-[10px] font-black text-muted-foreground/30 uppercase tracking-widest">{scheme.memberCount} Seats</div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <Card className="border-border/60 overflow-hidden shadow-sm rounded-2xl border bg-card">
        <CardHeader className="bg-muted/20 p-6 flex flex-row items-center justify-between border-b border-border/50">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-xl font-black tracking-tight uppercase">
               <CheckCircle2 className="size-6 text-emerald-500" />
               Recent Transactions
            </CardTitle>
            <CardDescription className="text-xs font-medium">Verified automated collection logs.</CardDescription>
          </div>
          <Button variant="ghost" size="sm" className="text-[10px] font-black uppercase tracking-widest hover:bg-muted">View Ledger</Button>
        </CardHeader>
        <CardContent className="p-6">
           {recentPaymentsList.length > 0 ? (
             <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
               {recentPaymentsList.map((payment, i) => {
                 const pAmt = Number(payment.amountPaid || payment.amount || 0);
                 const pDateStr = payment.targetDate || (payment.paymentDate ? (payment.paymentDate.toDate ? format(payment.paymentDate.toDate(), 'yyyy-MM-dd') : payment.paymentDate.split('T')[0]) : '-');
                 return (
                   <div key={i} className="flex flex-col p-5 rounded-2xl bg-muted/20 hover:bg-muted/40 transition-all border border-transparent hover:border-border/60 group">
                      <div className="flex items-center justify-between mb-3">
                        <Badge className="bg-emerald-100 text-emerald-700 border-none text-[9px] font-black uppercase tracking-widest">Verified</Badge>
                        <span className="text-[10px] text-muted-foreground font-bold tabular-nums">
                          {pDateStr}
                        </span>
                      </div>
                      <span className="font-bold text-base truncate mb-1">{payment.memberName}</span>
                      <div className="flex items-center justify-between mt-auto">
                        <span className="text-lg font-black text-emerald-600 tabular-nums">₹{pAmt.toLocaleString()}</span>
                        <span className="text-[10px] uppercase font-black text-muted-foreground/50 tracking-widest">{payment.method || 'Cash'}</span>
                      </div>
                   </div>
                 );
               })}
             </div>
           ) : (
             <div className="h-[120px] flex items-center justify-center text-muted-foreground italic text-xs font-medium border-2 border-dashed rounded-2xl">
               No transaction logs captured in this session.
             </div>
           )}
        </CardContent>
      </Card>

      {/* GROUP DETAIL DIALOG */}
      <Dialog open={isGroupDetailOpen} onOpenChange={setIsGroupDetailOpen}>
        <DialogContent className="sm:max-w-[650px] max-h-[85vh] flex flex-col p-0 overflow-hidden rounded-2xl">
          {selectedGroup && (
            <>
              <DialogHeader className="p-6 border-b bg-muted/10 space-y-4">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-black shadow-inner">
                    <FolderKanban className="size-6" />
                  </div>
                  <div>
                    <DialogTitle className="text-2xl font-black uppercase tracking-tight">
                      {getDisplayName(selectedGroup.name)} Registry
                    </DialogTitle>
                    <DialogDescription className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/70 mt-1">
                      Automated Isolated Member Board
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>
              
              <div className="flex-1 overflow-y-auto">
                <Table>
                  <TableHeader className="bg-muted/30 sticky top-0 z-10">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-[10px] uppercase font-black tracking-[0.2em] pl-8 h-12">Participant</TableHead>
                      <TableHead className="text-[10px] uppercase font-black tracking-[0.2em] h-12">Cycle Status</TableHead>
                      <TableHead className="text-[10px] uppercase font-black tracking-[0.2em] text-center h-12">Arrears Count</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedGroup.members.length > 0 ? selectedGroup.members.map((m: any) => {
                      const status = m.memberStatus;
                      return (
                        <TableRow key={m.id} className="hover:bg-muted/10 transition-colors border-b last:border-none">
                          <TableCell className="pl-8 py-5">
                            <div className="flex flex-col gap-0.5">
                              <span className="text-sm font-bold tracking-tight">{m.name}</span>
                              <span className="text-[10px] font-bold text-muted-foreground tracking-widest tabular-nums uppercase">
                                {m.paymentType || selectedGroup?.collectionType}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={status === 'paid' ? 'default' : 'secondary'} className={cn(
                              "text-[9px] font-black uppercase tracking-widest px-3 py-1 border-none shadow-sm",
                              status === 'paid' ? "bg-emerald-500 hover:bg-emerald-600" : (status === 'waiting' ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700")
                            )}>
                              {status === 'paid' ? 'SUCCESS' : (status === 'waiting' ? 'WAITING' : 'PENDING')}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center pr-8">
                            <button 
                              className={cn(
                                "inline-flex items-center justify-center px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-90 shadow-sm border",
                                m.calculatedPendingDays > 0 ? "bg-destructive/10 text-destructive border-destructive/20" : "bg-emerald-50 text-emerald-700 border-emerald-200"
                              )}
                              onClick={() => handleMemberArrearsClick(m)}
                            >
                              {m.calculatedPendingDays} {selectedGroup?.collectionType === 'Daily' ? 'Days' : 'Month'}
                            </button>
                          </TableCell>
                        </TableRow>
                      );
                    }) : (
                      <TableRow>
                        <TableCell colSpan={3} className="h-48 text-center text-muted-foreground italic text-xs font-bold uppercase tracking-widest">
                          No board participants available.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              <DialogFooter className="p-4 border-t bg-muted/5">
                <Button onClick={() => setIsGroupDetailOpen(false)} className="w-full font-black uppercase tracking-[0.2em] h-12 rounded-xl active:scale-95 transition-all">Close Board Registry</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* MEMBER ARREARS POPUP 💬 */}
      <Dialog open={isMemberArrearsOpen} onOpenChange={setIsMemberArrearsOpen}>
        <DialogContent className="sm:max-w-[420px] rounded-2xl p-0 overflow-hidden border-none shadow-2xl">
          {selectedMemberDebt && (
            <>
              <DialogHeader className="p-6 bg-gradient-to-br from-muted/50 to-background border-b">
                <div className="flex items-center gap-4">
                  <div className="h-14 w-14 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center font-black shadow-inner">
                    <User className="size-7" />
                  </div>
                  <div className="space-y-0.5">
                    <DialogTitle className="text-xl font-black uppercase tracking-tight">Arrears Summary</DialogTitle>
                    <DialogDescription className="text-[10px] font-black tracking-[0.2em] text-muted-foreground uppercase">
                      Financial Audit: {selectedMemberDebt.name}
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>
              
              <div className="p-6 space-y-6 bg-background">
                <div className="flex flex-col items-center justify-center p-8 bg-destructive/5 rounded-3xl border border-dashed border-destructive/20 text-center relative overflow-hidden group">
                  <div className="absolute inset-0 bg-destructive/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] text-destructive/60 mb-3 relative z-10">Current Currency Deficit</p>
                  <div className="text-5xl font-black text-destructive tabular-nums tracking-tighter relative z-10 mb-4">
                    ₹{(selectedMemberDebt.calculatedPendingAmount || 0).toLocaleString()}
                  </div>
                  <Badge className="bg-destructive text-destructive-foreground px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg shadow-destructive/20 relative z-10">
                    ⏳ {selectedMemberDebt.calculatedPendingDays || 0} {selectedMemberDebt.memberStatus === 'pending' ? 'Missed' : 'Pending'}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-4">
                   <div className="p-4 bg-muted/30 rounded-2xl border border-border/40">
                      <p className="text-[9px] font-black uppercase text-muted-foreground/50 tracking-widest mb-1.5">Scheme Unit</p>
                      <p className="text-lg font-black tracking-tight">₹{(selectedMemberDebt.monthlyAmount || 800).toLocaleString()}</p>
                   </div>
                   <div className="p-4 bg-muted/30 rounded-2xl border border-border/40">
                      <p className="text-[9px] font-black uppercase text-muted-foreground/50 tracking-widest mb-1.5">Audit Mode</p>
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="size-4 text-primary opacity-60" />
                        <p className="text-sm font-bold tracking-tight uppercase">Real-Time Tracking</p>
                      </div>
                   </div>
                </div>

                <div className="p-5 rounded-2xl bg-primary/5 border border-primary/10 flex items-start gap-4">
                  <Info className="size-5 text-primary shrink-0 mt-0.5" />
                  <p className="text-[11px] text-muted-foreground leading-relaxed italic font-medium">
                    Arrears are calculated based on scheme frequency and due dates. Daily tracking follows the strict April 2026 window.
                  </p>
                </div>
              </div>
              
              <DialogFooter className="p-6 pt-0 bg-background">
                <Button onClick={() => setIsMemberArrearsOpen(false)} className="w-full font-black uppercase tracking-[0.2em] h-12 rounded-xl active:scale-95 transition-all shadow-lg">Close Audit</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
