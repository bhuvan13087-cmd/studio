
"use client"

import * as React from "react"
import { Loader2, ChevronLeft, CalendarDays, IndianRupee, History, Search, Filter, CheckCircle2, Clock, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, query, orderBy } from "firebase/firestore"
import { useRouter } from "next/navigation"
import { format, parseISO, isWithinInterval, startOfDay, endOfDay, isValid } from "date-fns"
import { cn } from "@/lib/utils"

/**
 * @fileOverview Specialized Cycle Audit Details Page.
 * 
 * Provides a granular, real-time view of a specific historical period.
 * Connects to existing database data for members and payments safely.
 */
export default function CycleDetailsPage({ params }: { params: Promise<{ groupName: string, cycleId: string }> }) {
  const router = useRouter()
  const resolvedParams = React.use(params)
  
  // Safe Param Handling
  const rawGroup = resolvedParams?.groupName || ""
  const rawCycle = resolvedParams?.cycleId || ""

  const groupName = decodeURIComponent(rawGroup).trim()
  const cycleId = decodeURIComponent(rawCycle).trim()

  const [selectedDate, setSelectedDate] = React.useState("")

  const db = useFirestore()

  // TASK 1: Safe Base Data Fetching
  const cyclesQuery = useMemoFirebase(() => query(collection(db, 'cycles'), orderBy('startDate', 'desc')), [db])
  const { data: cyclesData, isLoading: cyclesLoading } = useCollection(cyclesQuery)
  
  const membersQuery = useMemoFirebase(() => collection(db, 'members'), [db])
  const { data: membersData, isLoading: membersLoading } = useCollection(membersQuery)

  const paymentsQuery = useMemoFirebase(() => query(collection(db, 'payments'), orderBy('paymentDate', 'desc')), [db])
  const { data: paymentsData, isLoading: paymentsLoading } = useCollection(paymentsQuery)

  // TASK 2: Find Exact Cycle
  const selectedCycle = React.useMemo(() => {
    const allCycles = Array.isArray(cyclesData) ? cyclesData : []
    return allCycles.find(
      (c) =>
        String(c?.name || "").trim() === groupName &&
        (String(c?.id || "") === cycleId || String(c?.startDate || "") === cycleId)
    )
  }, [cyclesData, groupName, cycleId])

  // TASK 3 & 4: Safe Members + Payments + Total Calculation
  const auditData = React.useMemo(() => {
    if (!selectedCycle) return null

    const startDate = selectedCycle.startDate || ""
    const endDate = selectedCycle.endDate || ""

    // Filter members belonging to this group
    const groupMembers = (Array.isArray(membersData) ? membersData : [])
      .filter(m => String(m?.chitGroup || "").trim().toLowerCase() === groupName.toLowerCase() || 
                   String(m?.chitGroup || "").replace(/Group/gi, '').trim().toLowerCase() === groupName.replace(/Group/gi, '').trim().toLowerCase())

    const memberIds = new Set(groupMembers.map(m => m.id))

    // RESILIENT DATE EXTRACTION
    const getPDateStr = (p: any) => {
      if (p.targetDate && typeof p.targetDate === 'string') return p.targetDate;
      const raw = p.paymentDate || p.createdAt || p.date || p.paidDate;
      if (!raw) return null;
      try {
        const d = raw.toDate ? raw.toDate() : new Date(raw);
        if (isValid(d)) return format(d, 'yyyy-MM-dd');
      } catch (e) {}
      return null;
    }

    // RESILIENT AMOUNT EXTRACTION
    const getPAmount = (p: any) => Number(p.amountPaid || p.amount || 0);

    // Filter payments within this cycle range for these members
    const cyclePayments = (Array.isArray(paymentsData) ? paymentsData : [])
      .filter(p => {
        if (!memberIds.has(p.memberId)) return false
        
        // Permissive Status Check
        if (p.status && !['success', 'paid', 'verified', 'Success', 'Paid'].includes(p.status)) return false
        
        const recordDate = getPDateStr(p);
        if (!recordDate || !startDate || !endDate) return false
        
        return recordDate >= startDate && recordDate <= endDate
      })

    const totalCollection = cyclePayments.reduce((sum, p) => sum + getPAmount(p), 0)

    // TASK 6 & 7: Daily Filtering & Collection
    const filteredPayments = cyclePayments.filter(p => 
      !selectedDate || getPDateStr(p) === selectedDate
    )

    const dailyCollection = filteredPayments.reduce((sum, p) => sum + getPAmount(p), 0)

    // TASK 8: Members List Status
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

    return {
      groupMembers,
      cyclePayments,
      totalCollection,
      dailyCollection,
      membersWithStatus,
      startDate,
      endDate
    }
  }, [selectedCycle, membersData, paymentsData, groupName, selectedDate])

  if (!groupName || !cycleId) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
        <p className="text-sm font-black text-destructive uppercase tracking-widest">Invalid Audit Data</p>
        <Button variant="outline" onClick={() => router.push('/cycles')}>Return to Registry</Button>
      </div>
    )
  }

  if (cyclesLoading || membersLoading || paymentsLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!selectedCycle || !auditData) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
        <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
          <History className="size-8 text-muted-foreground/40" />
        </div>
        <div className="text-center space-y-1">
          <p className="text-sm font-black uppercase tracking-widest text-foreground">No Cycle Data Located</p>
          <p className="text-xs text-muted-foreground italic">The requested audit period could not be verified in history.</p>
        </div>
        <Button 
          variant="outline" 
          onClick={() => router.push(`/cycles/${encodeURIComponent(groupName)}`)}
          className="rounded-xl h-11 px-6 font-bold"
        >
          Back to History
        </Button>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500 pb-10 overflow-x-hidden">
      {/* Header Navigation */}
      <div className="flex items-center gap-4">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => router.push(`/cycles/${encodeURIComponent(groupName)}`)}
          className="rounded-full h-10 w-10 hover:bg-primary/10 text-primary transition-all active:scale-90"
        >
          <ChevronLeft className="size-6" />
        </Button>
        <div className="space-y-0.5">
          <h2 className="text-2xl font-black tracking-tight text-primary font-headline uppercase">
            Audit Board
          </h2>
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">
            {groupName} Registry Detail
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Statistics Summary */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-border/60 shadow-lg rounded-3xl overflow-hidden bg-card">
            <CardHeader className="bg-muted/10 border-b border-border/40 p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shadow-inner">
                    <CalendarDays className="size-6" />
                  </div>
                  <div>
                    <CardTitle className="text-lg font-black uppercase tracking-tight">Period Summary</CardTitle>
                    <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-primary/70">
                      {auditData.startDate} → {auditData.endDate}
                    </CardDescription>
                  </div>
                </div>
                <div className="bg-emerald-50 px-4 py-2 rounded-2xl border border-emerald-100 self-start sm:self-auto">
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
                      <Input 
                        type="date" 
                        value={selectedDate} 
                        onChange={(e) => setSelectedDate(e.target.value)}
                        min={auditData.startDate}
                        max={auditData.endDate}
                        className="h-10 pl-9 rounded-xl font-bold text-xs"
                      />
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
                      auditData.membersWithStatus.map((m, i) => (
                        <TableRow key={m.id} className="hover:bg-muted/5 transition-colors border-b last:border-none">
                          <TableCell className="pl-8 py-4">
                            <div className="flex items-center gap-3">
                              <div className="h-8 w-8 rounded-full bg-secondary text-primary flex items-center justify-center font-black text-[10px] uppercase">
                                {m.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                              </div>
                              <div className="flex flex-col">
                                <span className="text-xs font-bold tracking-tight">{m.name}</span>
                                <span className="text-[9px] font-bold text-muted-foreground tabular-nums">{m.phone}</span>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant={m.paid ? "default" : "secondary"} className={cn(
                              "text-[8px] font-black uppercase tracking-tighter border-none px-2 py-0.5",
                              m.paid ? "bg-emerald-500 hover:bg-emerald-600" : "bg-amber-100 text-amber-700"
                            )}>
                              {m.paid ? "PAID" : "PENDING"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right pr-8 font-black text-xs tabular-nums text-foreground/80">
                            {m.amount > 0 ? `₹${m.amount.toLocaleString()}` : "-"}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={3} className="h-32 text-center text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40 italic">
                          No group participants located
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Audit Sidebar */}
        <div className="space-y-6">
          <div className="p-6 rounded-3xl bg-primary/5 border border-primary/10 flex items-start gap-4">
            <Clock className="size-5 text-primary/40 shrink-0 mt-0.5" />
            <p className="text-[10px] text-muted-foreground font-medium italic leading-relaxed">
              Calculations are performed in real-time based on your isolated ledger entries for this group.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
