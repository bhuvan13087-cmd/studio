
"use client"

import { useEffect, useState, useMemo } from "react"
import { Users, IndianRupee, Clock, CheckCircle2, Loader2, Info, ArrowRight, FolderKanban, User, CalendarDays, RefreshCcw, LayoutDashboard, ShieldCheck, AlertCircle } from "lucide-react"
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
import { format, startOfDay } from "date-fns"
import { cn } from "@/lib/utils"
import {
  getPaymentAmount,
  getPaymentDateStr,
  getCreatedAtDateStr,
  isPaymentSuccess,
  findActiveCycle,
  computeMemberStats,
} from "@/lib/chit-engine"

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

  const cyclesQuery = useMemoFirebase(() => query(collection(db, 'cycles'), orderBy('createdAt', 'desc')), [db])
  const { data: allCycles } = useCollection(cyclesQuery)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    return () => {
      document.body.style.pointerEvents = 'auto';
      document.body.style.overflow = 'auto';
    };
  }, []);

  const dashboardData = useMemo(() => {
    if (!mounted || membersLoading || paymentsLoading || roundsLoading) return null;

    const now = startOfDay(new Date());
    const todayStr = format(now, 'yyyy-MM-dd')

    // 1. Map members by ID for fast lookup
    const membersMap = new Map<string, any>();
    (members || []).forEach(m => membersMap.set(m.id, m));

    // 2. Pre-index active cycles by group name
    const activeCyclesByGroup = new Map<string, any>();
    (allCycles || []).forEach(c => {
      if (c.status === 'active' && c.name) {
        activeCyclesByGroup.set(String(c.name).trim().toUpperCase(), c);
      }
    });

    // 3. Group payments by member ID
    const paymentsByMember = new Map<string, any[]>();
    (payments || []).forEach(p => {
      if (p.memberId) {
        if (!paymentsByMember.has(p.memberId)) {
          paymentsByMember.set(p.memberId, []);
        }
        paymentsByMember.get(p.memberId)!.push(p);
      }
    });

    // 4. Calculate collectedThisCycle in O(P)
    const collectedThisCycle = (payments || []).reduce((acc, p) => {
      if (!isPaymentSuccess(p, false)) return acc;
      const member = membersMap.get(p.memberId);
      if (!member) return acc;
      const activeCycle = activeCyclesByGroup.get(String(member.chitGroup || '').trim().toUpperCase());
      if (!activeCycle) return acc;
      const pDateStr = getPaymentDateStr(p);
      if (pDateStr && pDateStr >= activeCycle.startDate && (activeCycle.endDate ? pDateStr <= activeCycle.endDate : true)) {
        return acc + getPaymentAmount(p);
      }
      return acc;
    }, 0);

    const collectedToday = (payments || []).reduce((acc, p) => {
      if (!isPaymentSuccess(p, false)) return acc;
      const intakeDate = getCreatedAtDateStr(p);
      if (intakeDate === todayStr) { return acc + getPaymentAmount(p); }
      return acc;
    }, 0);

    // strict=false: dashboard historically counts payments with no status field as paid
    const membersWithCalculatedStats = (members || []).filter(m => m.status !== 'inactive').map(m => {
      const memberPayments = paymentsByMember.get(m.id) || [];
      const stats = computeMemberStats(m, memberPayments, allCycles || [], rounds || [], false);
      return { ...m, ...stats };
    });

    const dailyPendingList = membersWithCalculatedStats.filter(m => {
      const isPending = m.memberStatus === 'pending';
      if (!isPending) return false;
      const mGroupNorm = String(m.chitGroup || '').trim().toUpperCase();
      const round = (rounds || []).find(r => String(r.name || '').trim().toUpperCase() === mGroupNorm);
      const collectionType = m.paymentType || round?.collectionType || 'Daily';
      return collectionType === 'Daily';
    });

    const monthlyOverdueList = membersWithCalculatedStats.filter(m => {
      const isPending = m.memberStatus === 'pending';
      if (!isPending) return false;
      const mGroupNorm = String(m.chitGroup || '').trim().toUpperCase();
      const round = (rounds || []).find(r => String(r.name || '').trim().toUpperCase() === mGroupNorm);
      const collectionType = m.paymentType || round?.collectionType || 'Daily';
      return collectionType === 'Monthly';
    });

    return { 
      activeMembersCount: members?.filter(m => m.status !== 'inactive').length || 0, 
      collectedThisMonth: collectedThisCycle, 
      collectedToday, 
      dailyPendingCount: dailyPendingList.length, 
      monthlyOverdueCount: monthlyOverdueList.length, 
      schemeSummaries: ['A GROUP', 'B GROUP', 'C GROUP', 'D GROUP', 'H GROUP'].map(name => {
        const normName = name.trim().toUpperCase();
        const schemeInfo = (rounds || []).find(r => String(r.name || '').trim().toUpperCase() === normName) || { name, collectionType: 'Daily', monthlyAmount: 800, dueDate: 5 };
        const groupMembers = membersWithCalculatedStats.filter(m => String(m.chitGroup || '').trim().toUpperCase() === normName);
        return { ...schemeInfo, name: name.replace(' GROUP', ''), totalPendingDays: groupMembers.reduce((acc, m) => acc + m.calculatedPendingDays, 0), memberCount: groupMembers.length, members: groupMembers };
      }), 
      recentPaymentsList: (payments || []).slice(0, 5) 
    }
  }, [mounted, members, payments, rounds, allCycles, membersLoading, paymentsLoading, roundsLoading])

  if (!mounted || !dashboardData) { return (<div className="flex h-[60vh] items-center justify-center"><Loader2 className="size-8 animate-spin text-primary" /></div>) }

  const { activeMembersCount, collectedThisMonth, collectedToday, dailyPendingCount, monthlyOverdueCount, schemeSummaries, recentPaymentsList } = dashboardData;

  const handleModalClose = (setter: (v: boolean) => void, resetter: () => void) => {
    setter(false);
    resetter();
    document.body.style.pointerEvents = 'auto';
    document.body.style.overflow = 'auto';
  };

  return (
    <div className="space-y-10 animate-in fade-in duration-700 pb-10 overflow-x-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1.5"><h2 className="text-2xl sm:text-4xl font-black tracking-tight text-primary font-headline uppercase">Financial Command Center</h2><p className="text-sm sm:text-base text-muted-foreground font-medium flex items-center gap-2"><ShieldCheck className="size-4 text-primary" /> Multi-Group Synchronization Protocol.</p></div>
        <Button variant="outline" className="font-bold gap-2 h-11 px-6 shadow-sm border-border/60 hover:bg-muted/50 active:scale-95 transition-all" onClick={() => window.location.reload()}><RefreshCcw className="size-4 text-primary" /> Sync Status</Button>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="hover:shadow-xl transition-all duration-300 border-border/60 rounded-2xl bg-card shadow-sm group">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0 p-6"><CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/70">Total Active Seats</CardTitle><div className="h-10 w-10 rounded-xl bg-primary/5 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-300"><Users className="size-5" /></div></CardHeader>
          <CardContent className="p-6 pt-0"><div className="text-4xl font-black tracking-tighter tabular-nums mb-1">{activeMembersCount}</div><div className="text-[11px] text-muted-foreground font-semibold flex items-center gap-1.5 mt-2"><div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> Verified participants</div></CardContent>
        </Card>
        <Card className="hover:shadow-xl transition-all duration-300 border-border/60 rounded-2xl bg-card shadow-sm group">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0 p-6">
            <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/70">Collections</CardTitle>
            <Select value={revenueView} onValueChange={(v: any) => setRevenueView(v)}><SelectTrigger className="h-8 w-fit min-w-[100px] text-[10px] font-black border-none bg-muted/50 focus:ring-0 shadow-none px-3 rounded-lg"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="month" className="text-[10px] font-black uppercase">Active Cycle</SelectItem><SelectItem value="today" className="text-[10px] font-black uppercase">Paid Today</SelectItem></SelectContent></Select>
          </CardHeader>
          <CardContent className="p-6 pt-0"><div className="text-4xl font-black tracking-tighter text-primary tabular-nums mb-1">₹{(revenueView === 'month' ? collectedThisMonth : collectedToday).toLocaleString()}</div><div className="text-[11px] text-muted-foreground font-semibold mt-2 flex items-center gap-1.5"><IndianRupee className="size-3.5 text-emerald-600" /> {revenueView === 'month' ? 'Active Operational Intake' : 'Physical Cash/UPI Today'}</div></CardContent>
        </Card>
        <Card className="hover:shadow-xl transition-all duration-300 border-border/60 rounded-2xl bg-card shadow-sm group border-l-4 border-l-destructive">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0 p-6"><CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-destructive/70">Arrears Alert</CardTitle><div className="h-10 w-10 rounded-xl bg-destructive/5 flex items-center justify-center text-destructive transition-all duration-300"><Clock className="size-5" /></div></CardHeader>
          <CardContent className="p-6 pt-0"><div className="flex items-end gap-4"><div><div className="text-4xl font-black tracking-tighter text-destructive tabular-nums">{dailyPendingCount}</div><div className="text-[9px] text-muted-foreground font-bold uppercase tracking-widest">Daily Pending</div></div><div className="h-10 w-px bg-border/60 mb-2" /><div><div className="text-4xl font-black tracking-tighter text-amber-600 tabular-nums">{monthlyOverdueCount}</div><div className="text-[9px] text-muted-foreground font-bold uppercase tracking-widest">Monthly Overdue</div></div></div></CardContent>
        </Card>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {schemeSummaries.map((scheme, i) => (
          <Card key={i} className="group cursor-pointer hover:border-primary hover:shadow-xl transition-all border-border/60 overflow-hidden relative shadow-sm rounded-2xl" onClick={() => { setSelectedGroup(scheme); setIsGroupDetailOpen(true); }}>
            <div className="absolute top-0 right-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity"><ArrowRight className="size-4 text-primary" /></div>
            <CardHeader className="p-5 pb-2 bg-muted/10 border-b border-border/40">
              <div className="flex items-center justify-between">
                <CardTitle className="text-[11px] font-bold whitespace-nowrap overflow-visible uppercase text-muted-foreground tracking-[0.3em] leading-tight">Group {scheme.name}</CardTitle>
                <Badge variant="outline" className="text-[8px] font-black border-none bg-primary/5 text-primary/60 shrink-0">{scheme.collectionType}</Badge>
              </div>
            </CardHeader>
            <CardContent className="p-5"><div className="flex items-end justify-between"><div><div className={cn("text-3xl font-black tabular-nums transition-colors flex items-center gap-3 mb-1", scheme.totalPendingDays > 0 ? (scheme.collectionType === 'Daily' ? "text-destructive" : "text-amber-600") : "text-emerald-600")}>{scheme.totalPendingDays}</div><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 flex items-center gap-1.5"><Clock className="size-3" /> Arrears Span</p></div><div className="text-[10px] font-black text-muted-foreground/30 uppercase tracking-widest">{scheme.memberCount} Seats</div></div></CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-border/60 overflow-hidden shadow-sm rounded-2xl border bg-card">
        <CardHeader className="bg-muted/20 p-6 flex flex-row items-center justify-between border-b border-border/50"><div className="space-y-1"><CardTitle className="flex items-center gap-2 text-xl font-black tracking-tight uppercase"><CheckCircle2 className="size-6 text-emerald-500" />Real-time Intake</CardTitle><CardDescription className="text-xs font-medium">Recently recorded transaction logs.</CardDescription></div></CardHeader>
        <CardContent className="p-6">
           {recentPaymentsList.length > 0 ? (
             <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
               {recentPaymentsList.map((payment, i) => {
                 const pAmt = getPaymentAmount(payment);
                 const pDateStr = getPaymentDateStr(payment) || '-';
                 return (
                   <div key={i} className="flex flex-col p-5 rounded-2xl bg-muted/20 hover:bg-muted/40 transition-all border border-transparent hover:border-border/60 group">
                      <div className="flex items-center justify-between mb-3"><Badge className="bg-emerald-100 text-emerald-700 border-none text-[9px] font-black uppercase tracking-widest">Captured</Badge><span className="text-[10px] text-muted-foreground font-bold tabular-nums">{pDateStr}</span></div>
                      <span className="font-bold text-base break-words whitespace-normal mb-1">{payment.memberName}</span>
                      <div className="flex items-center justify-between mt-auto"><span className="text-lg font-black text-emerald-600 tabular-nums">₹{pAmt.toLocaleString()}</span><span className="text-[10px] uppercase font-black text-muted-foreground/50 tracking-widest">{payment.method || 'Cash'}</span></div>
                   </div>
                 );
               })}
             </div>
           ) : (<div className="h-[120px] flex items-center justify-center text-muted-foreground italic text-xs font-medium border-2 border-dashed rounded-2xl">No recent intake logs.</div>)}
        </CardContent>
      </Card>

      <Dialog open={isGroupDetailOpen} onOpenChange={(open) => { if (!open) { setSelectedGroup(null); document.body.style.pointerEvents = 'auto'; } setIsGroupDetailOpen(open); }}>
        <DialogContent className="sm:max-w-[650px] max-h-[85vh] flex flex-col p-0 overflow-hidden rounded-2xl">
          {selectedGroup && (
            <><DialogHeader className="p-6 border-b bg-muted/10 space-y-4"><div className="flex items-center gap-4"><div className="h-12 w-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-black shadow-inner"><FolderKanban className="size-6" /></div><div><DialogTitle className="text-2xl font-black uppercase tracking-tight break-words whitespace-normal">Group {selectedGroup.name} Registry</DialogTitle><DialogDescription className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/70 mt-1">Audit Mode: {selectedGroup.collectionType}</DialogDescription></div></div></DialogHeader>
            <div className="flex-1 overflow-y-auto"><Table><TableHeader className="bg-muted/30 sticky top-0 z-10"><TableRow className="hover:bg-transparent"><TableHead className="text-[10px] uppercase font-black tracking-[0.2em] pl-8 h-12">Participant</TableHead><TableHead className="text-[10px] uppercase font-black tracking-[0.2em] h-12">Status</TableHead><TableHead className="text-[10px] uppercase font-black tracking-[0.2em] text-center h-12">Arrears</TableHead></TableRow></TableHeader><TableBody>{selectedGroup.members.length > 0 ? selectedGroup.members.map((m: any) => (<TableRow key={m.id} className="hover:bg-muted/10 transition-colors border-b last:border-none"><TableCell className="pl-8 py-5"><div className="flex flex-col gap-0.5"><span className="text-sm font-bold tracking-tight">{m.name}</span><span className="text-[10px] font-bold text-muted-foreground tracking-widest tabular-nums uppercase">{m.paymentType || selectedGroup?.collectionType}</span></div></TableCell><TableCell><Badge variant={m.memberStatus === 'paid' ? 'default' : 'secondary'} className={cn("text-[9px] font-black uppercase tracking-widest px-3 py-1 border-none shadow-sm", m.memberStatus === 'paid' ? "bg-emerald-500" : (m.memberStatus === 'waiting' ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"))}>{m.memberStatus.toUpperCase()}</Badge></TableCell><TableCell className="text-center pr-8"><button className={cn("inline-flex items-center justify-center px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-90 border", m.calculatedPendingDays > 0 ? "bg-destructive/10 text-destructive border-destructive/20" : "bg-emerald-50 text-emerald-700 border-emerald-200")} onClick={() => { setSelectedMemberDebt(m); setIsMemberArrearsOpen(true); }}>{m.calculatedPendingDays} Days</button></TableCell></TableRow>)) : <TableRow><TableCell colSpan={3} className="h-48 text-center text-muted-foreground italic text-xs font-bold uppercase tracking-widest">No participants available.</TableCell></TableRow>}</TableBody></Table></div>
            <DialogFooter className="p-4 border-t bg-muted/5"><Button onClick={() => setIsGroupDetailOpen(false)} className="w-full font-black uppercase tracking-[0.2em] h-12 rounded-xl">Close Registry</Button></DialogFooter></>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isMemberArrearsOpen} onOpenChange={(open) => { if (!open) { setSelectedMemberDebt(null); document.body.style.pointerEvents = 'auto'; } setIsMemberArrearsOpen(open); }}>
        <DialogContent className="sm:max-w-[420px] rounded-2xl p-0 overflow-hidden border-none shadow-2xl">
          {selectedMemberDebt && (
            <><DialogHeader className="p-6 bg-gradient-to-br from-muted/50 to-background border-b"><div className="flex items-center gap-4"><div className="h-14 w-14 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center font-black shadow-inner"><User className="size-7" /></div><div className="space-y-0.5"><DialogTitle className="text-xl font-black uppercase tracking-tight">Audit Record</DialogTitle><DialogDescription className="text-[10px] font-black tracking-[0.2em] text-muted-foreground uppercase">{selectedMemberDebt.name}</DialogDescription></div></div></DialogHeader>
            <div className="p-6 space-y-6 bg-background"><div className="flex flex-col items-center justify-center p-8 bg-destructive/5 rounded-3xl border border-dashed border-destructive/20 text-center relative overflow-hidden group"><p className="text-[10px] font-black uppercase tracking-[0.3em] text-destructive/60 mb-3 relative z-10">Unpaid Cycle Debt</p><div className="text-5xl font-black text-destructive tabular-nums tracking-tighter relative z-10 mb-4">₹{(selectedMemberDebt.calculatedPendingAmount || 0).toLocaleString()}</div><Badge className="bg-destructive text-destructive-foreground px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg relative z-10">⏳ {selectedMemberDebt.calculatedPendingDays || 0} Missed</Badge></div></div>
            <DialogFooter className="p-6 pt-0 bg-background"><Button onClick={() => setIsMemberArrearsOpen(false)} className="w-full font-black uppercase tracking-[0.2em] h-12 rounded-xl active:scale-95 shadow-lg">Close Audit</Button></DialogFooter></>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
