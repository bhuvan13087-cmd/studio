
"use client"

import * as React from "react"
import { Loader2, ChevronLeft, CalendarDays, IndianRupee, History, Search, Filter, CheckCircle2, Clock, User, Lock, Wallet } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, query, orderBy } from "firebase/firestore"
import { useRouter } from "next/navigation"
import { format, parseISO, isWithinInterval, startOfDay, endOfDay, isValid, eachDayOfInterval, isAfter, max } from "date-fns"
import { cn } from "@/lib/utils"

/**
 * @fileOverview Specialized Cycle Audit Details Page.
 * 
 * Provides a granular, real-time view of a specific historical period.
 * FIX: Synchronized pending calculation with high-integrity engine to remove "already paid" errors.
 */
export default function CycleDetailsPage({ params }: { params: Promise<{ groupName: string, cycleId: string }> }) {
  const router = useRouter()
  const resolvedParams = React.use(params)
  
  const groupName = decodeURIComponent(resolvedParams?.groupName || "").trim()
  const cycleId = decodeURIComponent(resolvedParams?.cycleId || "").trim()

  const [selectedDate, setSelectedDate] = React.useState("")

  const db = useFirestore()

  // Base Data Fetching
  const cyclesQuery = useMemoFirebase(() => query(collection(db, 'cycles'), orderBy('startDate', 'desc')), [db])
  const { data: cyclesData, isLoading: cyclesLoading } = useCollection(cyclesQuery)
  
  const membersQuery = useMemoFirebase(() => collection(db, 'members'), [db])
  const { data: membersData, isLoading: membersLoading } = useCollection(membersQuery)

  const paymentsQuery = useMemoFirebase(() => query(collection(db, 'payments'), orderBy('paymentDate', 'desc')), [db])
  const { data: paymentsData, isLoading: paymentsLoading } = useCollection(paymentsQuery)

  const roundsQuery = useMemoFirebase(() => query(collection(db, 'chitRounds')), [db])
  const { data: roundsData } = useCollection(roundsQuery)

  // Find Exact Cycle
  const selectedCycle = React.useMemo(() => {
    const allCycles = Array.isArray(cyclesData) ? cyclesData : []
    return allCycles.find(
      (c) =>
        String(c?.name || "").trim().toLowerCase() === groupName.toLowerCase() &&
        (String(c?.id || "") === cycleId || String(c?.startDate || "") === cycleId)
    )
  }, [cyclesData, groupName, cycleId])

  const isCompleted = selectedCycle?.status === 'completed';

  const auditData = React.useMemo(() => {
    if (!selectedCycle || !membersData || !paymentsData) return null

    const startDate = selectedCycle.startDate || ""
    const endDate = selectedCycle.endDate || ""
    const cycleIdInternal = selectedCycle.id

    // Filter members belonging to this group (Case insensitive + Resilient)
    const groupMembers = (Array.isArray(membersData) ? membersData : [])
      .filter(m => {
        const mGroup = String(m?.chitGroup || "").trim().toLowerCase();
        const gName = groupName.toLowerCase();
        const gNameClean = groupName.replace(/Group/gi, '').trim().toLowerCase();
        return mGroup === gName || mGroup === gNameClean;
      })

    const memberIds = new Set(groupMembers.map(m => m.id))

    // RESILIENT DATE EXTRACTION
    const getPDateStr = (p: any) => {
      if (p.targetDate && typeof p.targetDate === 'string') return p.targetDate.trim();
      const raw = p.paymentDate || p.createdAt || p.date || p.paidDate;
      if (!raw) return null;
      try {
        const d = raw.toDate ? raw.toDate() : new Date(raw);
        if (isValid(d)) return format(d, 'yyyy-MM-dd');
      } catch (e) {}
      return null;
    }

    const getPAmount = (p: any) => Number(p.amountPaid || p.amount || 0);

    // Filter payments strictly within this cycle range OR matching cycle ID
    const cyclePayments = (Array.isArray(paymentsData) ? paymentsData : [])
      .filter(p => {
        if (!memberIds.has(p.memberId)) return false
        if (p.status && !['success', 'paid', 'verified'].includes(p.status.toLowerCase())) return false
        
        if (p.cycleId === cycleIdInternal) return true;
        
        const recordDate = getPDateStr(p);
        return recordDate && recordDate >= startDate && recordDate <= endDate;
      })

    const totalCollection = cyclePayments.reduce((sum, p) => sum + getPAmount(p), 0)

    const filteredPayments = cyclePayments.filter(p => 
      !selectedDate || getPDateStr(p) === selectedDate
    )

    const dailyCollection = filteredPayments.reduce((sum, p) => sum + getPAmount(p), 0)

    const membersWithStatus = groupMembers.map(m => {
      const dayPayment = filteredPayments.find(p => String(p?.memberId || "") === String(m?.id || ""))
      return {
        id: m.id,
        name: m?.name || "Anonymous Participant",
        phone: m?.phone || "-",
        paid: !!dayPayment,
        amount: dayPayment ? getPAmount(dayPayment) : 0
      }
    })

    // Calculate Pending Members using identical logic to settlement page
    const pendingMembersCount = groupMembers.filter(m => {
      const scheme = (roundsData || []).find(r => 
        String(r.name).trim().toLowerCase() === groupName.toLowerCase() ||
        String(r.name).replace(/Group/gi, '').trim().toLowerCase() === groupName.replace(/Group/gi, '').trim().toLowerCase()
      );
      const resolvedType = (m.paymentType || scheme?.collectionType || "Daily");
      const schemeAmt = Number(m.monthlyAmount || scheme?.monthlyAmount || 800);
      
      const mCyclePayments = cyclePayments.filter(p => p.memberId === m.id);

      if (resolvedType === 'Daily') {
        const start = startOfDay(max([parseISO(m.joinDate), parseISO(startDate)]));
        const end = parseISO(endDate);
        if (isAfter(start, end)) return false;
        try {
          const interval = eachDayOfInterval({ start, end });
          return interval.some(day => {
            const dStr = format(day, 'yyyy-MM-dd');
            const dayPaymentSum = mCyclePayments
              .filter(p => getPDateStr(p) === dStr)
              .reduce((sum, p) => sum + getPAmount(p), 0);
            return dayPaymentSum < schemeAmt;
          });
        } catch(e) { return false; }
      } else {
        const totalPaidInCycle = mCyclePayments.reduce((s, p) => s + getPAmount(p), 0);
        return totalPaidInCycle < schemeAmt;
      }
    }).length;

    return {
      groupMembers,
      cyclePayments,
      totalCollection,
      dailyCollection,
      membersWithStatus,
      startDate,
      endDate,
      pendingMembersCount
    }
  }, [selectedCycle, membersData, paymentsData, roundsData, groupName, selectedDate])

  if (cyclesLoading || membersLoading || paymentsLoading) {
    return (<div className="flex h-[60vh] items-center justify-center"><Loader2 className="size-8 animate-spin text-primary" /></div>)
  }

  if (!selectedCycle || !auditData) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
        <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center"><History className="size-8 text-muted-foreground/40" /></div>
        <div className="text-center space-y-1"><p className="text-sm font-black uppercase tracking-widest text-foreground">No Cycle Data Located</p></div>
        <Button variant="outline" onClick={() => router.push(`/cycles/${encodeURIComponent(groupName)}`)}>Back to History</Button>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push(`/cycles/${encodeURIComponent(groupName)}`)} className="rounded-full h-10 w-10 hover:bg-primary/10 text-primary transition-all active:scale-90"><ChevronLeft className="size-6" /></Button>
          <div className="space-y-0.5">
            <h2 className="text-2xl font-black tracking-tight text-primary font-headline uppercase">Audit Board</h2>
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">{groupName} Registry Detail</p>
          </div>
        </div>

        {isCompleted && auditData.pendingMembersCount > 0 && (
          <Button 
            onClick={() => router.push(`/cycles/${encodeURIComponent(groupName)}/${encodeURIComponent(cycleId)}/collect`)}
            className="bg-emerald-600 hover:bg-emerald-700 font-black uppercase tracking-[0.15em] text-[10px] h-10 px-6 rounded-xl shadow-lg active:scale-95 transition-all gap-2"
          >
            <Wallet className="size-3.5" /> Settle Arrears ({auditData.pendingMembersCount})
          </Button>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-border/60 shadow-lg rounded-3xl overflow-hidden bg-card">
            <CardHeader className="bg-muted/10 border-b border-border/40 p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shadow-inner"><CalendarDays className="size-6" /></div>
                  <div>
                    <CardTitle className="text-lg font-black uppercase tracking-tight">Period Summary</CardTitle>
                    <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-primary/70">{auditData.startDate} → {auditData.endDate}</CardDescription>
                  </div>
                </div>
                <div className="bg-emerald-50 px-4 py-2 rounded-2xl border border-emerald-100">
                  <p className="text-[9px] font-black uppercase tracking-widest text-emerald-600/70 mb-0.5">Cycle Collection</p>
                  <p className="text-xl font-black text-emerald-600 tabular-nums">₹{auditData.totalCollection.toLocaleString()}</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="p-6 border-b bg-muted/5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1.5 flex-1 max-w-xs">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">Select Audit Date</label>
                    <div className="relative">
                      <Filter className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-primary/50 pointer-events-none" />
                      <Input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} min={auditData.startDate} max={auditData.endDate} className="h-10 pl-9 rounded-xl font-bold text-xs" />
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 mb-0.5">Daily Intake</p>
                    <p className="text-3xl font-black text-primary tabular-nums tracking-tighter">₹{auditData.dailyCollection.toLocaleString()}</p>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-[9px] uppercase font-black tracking-widest pl-8 h-10">Participant</TableHead>
                      <TableHead className="text-[9px] uppercase font-black tracking-widest h-10 text-center">Status</TableHead>
                      <TableHead className="text-[9px] uppercase font-black tracking-widest h-10 text-right pr-8">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {auditData.membersWithStatus.length > 0 ? (
                      auditData.membersWithStatus.map((m) => (
                        <TableRow key={m.id} className="hover:bg-muted/5 transition-colors border-b last:border-none">
                          <TableCell className="pl-8 py-4">
                            <div className="flex items-center gap-3">
                              <div className="h-8 w-8 rounded-full bg-secondary text-primary flex items-center justify-center font-black text-[10px] uppercase">{m.name.split(' ').map(n => n[0]).join('').slice(0, 2)}</div>
                              <div className="flex flex-col"><span className="text-xs font-bold tracking-tight">{m.name}</span><span className="text-[9px] font-bold text-muted-foreground tabular-nums">{m.phone}</span></div>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant={m.paid ? "default" : "secondary"} className={cn("text-[8px] font-black uppercase tracking-tighter border-none px-2 py-0.5", m.paid ? "bg-emerald-500 text-white" : "bg-amber-100 text-amber-700")}>
                              {m.paid ? "PAID" : "PENDING"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right pr-8 font-black text-xs tabular-nums text-foreground/80">{m.amount > 0 ? `₹${m.amount.toLocaleString()}` : "-"}</TableCell>
                        </TableRow>
                      ))
                    ) : <TableRow><TableCell colSpan={3} className="h-32 text-center text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40 italic">No group participants located</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <div className="p-6 rounded-3xl bg-primary/5 border border-primary/10 flex items-start gap-4">
            <Clock className="size-5 text-primary/40 shrink-0 mt-0.5" />
            <div className="space-y-2">
              <p className="text-[10px] text-muted-foreground font-medium italic leading-relaxed">Calculations are strictly isolated to this operational interval.</p>
              {isCompleted && <div className="flex items-center gap-2 text-amber-700 font-black text-[9px] uppercase tracking-wider"><Lock className="size-3" /> Historical Record Locked</div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
