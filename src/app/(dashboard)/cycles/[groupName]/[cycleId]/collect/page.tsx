
"use client"

import * as React from "react"
import { Loader2, ChevronLeft, Wallet, User, CalendarDays, CheckCircle2, IndianRupee } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useFirestore, useCollection, useMemoFirebase, useUser } from "@/firebase"
import { collection, query, orderBy, addDoc, serverTimestamp, doc } from "firebase/firestore"
import { useRouter } from "next/navigation"
import { format, parseISO, isValid, eachDayOfInterval, isAfter, max, startOfDay } from "date-fns"
import { useToast } from "@/hooks/use-toast"
import { createAuditLog } from "@/firebase/logging"
import { cn } from "@/lib/utils"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"

export default function HistoryCollectionPage({ params }: { params: Promise<{ groupName: string, cycleId: string }> }) {
  const router = useRouter()
  const resolvedParams = React.use(params)
  const { toast } = useToast()
  const { user } = useUser()
  
  const groupName = decodeURIComponent(resolvedParams?.groupName || "").trim()
  const cycleId = decodeURIComponent(resolvedParams?.cycleId || "").trim()

  const db = useFirestore()

  // Payment Modal State
  const [isPaymentOpen, setIsPaymentOpen] = React.useState(false)
  const [selectedMember, setSelectedMember] = React.useState<any>(null)
  const [isActionPending, setIsActionPending] = React.useState(false)
  const [paymentData, setPaymentData] = React.useState({
    amount: 0,
    date: format(new Date(), 'yyyy-MM-dd'),
    method: "Cash"
  })

  // Data Fetching
  const cyclesQuery = useMemoFirebase(() => query(collection(db, 'cycles')), [db])
  const { data: cyclesData, isLoading: cyclesLoading } = useCollection(cyclesQuery)
  
  const membersQuery = useMemoFirebase(() => collection(db, 'members'), [db])
  const { data: membersData, isLoading: membersLoading } = useCollection(membersQuery)

  const paymentsQuery = useMemoFirebase(() => query(collection(db, 'payments')), [db])
  const { data: paymentsData, isLoading: paymentsLoading } = useCollection(paymentsQuery)

  const roundsQuery = useMemoFirebase(() => query(collection(db, 'chitRounds')), [db])
  const { data: roundsData } = useCollection(roundsQuery)

  const selectedCycle = React.useMemo(() => {
    return (cyclesData || []).find(c => String(c.name).trim() === groupName && (c.id === cycleId || c.startDate === cycleId))
  }, [cyclesData, groupName, cycleId])

  const pendingMembers = React.useMemo(() => {
    if (!selectedCycle || !membersData || !paymentsData || !roundsData) return []

    const startDate = selectedCycle.startDate
    const endDate = selectedCycle.endDate
    const scheme = roundsData.find(r => String(r.name).trim() === groupName)

    const getPDateStr = (p: any) => {
      if (p.targetDate) return p.targetDate;
      const d = p.paymentDate?.toDate ? p.paymentDate.toDate() : new Date(p.paymentDate);
      return isValid(d) ? format(d, 'yyyy-MM-dd') : null;
    }

    return membersData
      .filter(m => String(m.chitGroup).trim() === groupName && m.status !== 'inactive')
      .map(m => {
        const resolvedType = (m.paymentType || scheme?.collectionType || "Daily");
        const mPayments = paymentsData.filter(p => 
          p.memberId === m.id && 
          (p.status === 'success' || p.status === 'paid') &&
          getPDateStr(p) >= startDate && getPDateStr(p) <= endDate
        );

        let pendingCount = 0;
        if (resolvedType === 'Daily') {
          const start = startOfDay(max([parseISO(m.joinDate), parseISO(startDate)]));
          const end = parseISO(endDate);
          if (!isAfter(start, end)) {
            try {
              const interval = eachDayOfInterval({ start, end });
              pendingCount = interval.filter(day => {
                const dStr = format(day, 'yyyy-MM-dd');
                const dayPaid = mPayments.filter(p => getPDateStr(p) === dStr).reduce((s, p) => s + (p.amountPaid || 0), 0);
                return dayPaid < (m.monthlyAmount || 800);
              }).length;
            } catch {}
          }
        } else {
          pendingCount = mPayments.length > 0 ? 0 : 1;
        }

        return {
          ...m,
          resolvedType,
          pendingAmount: pendingCount * (m.monthlyAmount || 800),
          pendingCount
        }
      })
      .filter(m => m.pendingAmount > 0)
  }, [selectedCycle, membersData, paymentsData, roundsData, groupName])

  const handleOpenPayment = (member: any) => {
    setSelectedMember(member)
    setPaymentData({
      amount: member.monthlyAmount || 800,
      date: selectedCycle.startDate, // Default to cycle start for history
      method: "Cash"
    })
    setIsPaymentOpen(true)
  }

  const handleCollect = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!db || !selectedMember || isActionPending) return

    setIsActionPending(true)
    try {
      const paymentRecord = {
        memberId: selectedMember.id,
        memberName: selectedMember.name,
        month: format(parseISO(paymentData.date), 'MMMM yyyy'),
        targetDate: paymentData.date,
        amountPaid: Number(paymentData.amount),
        paymentDate: new Date().toISOString(),
        status: "success",
        method: paymentData.method,
        settlementType: "historical",
        cycleId: selectedCycle.id,
        createdAt: serverTimestamp()
      }

      await addDoc(collection(db, 'payments'), paymentRecord)
      await createAuditLog(db, user, `Settled Historical Pending ₹${paymentData.amount} for ${selectedMember.name} in ${groupName} (${selectedCycle.startDate} Cycle)`)

      toast({ title: "Payment Recorded", description: "Arrears settled for selected date." })
      setIsPaymentOpen(false)
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message || "Failed to record settlement." })
    } finally {
      setIsActionPending(false)
    }
  }

  if (cyclesLoading || membersLoading || paymentsLoading) {
    return (<div className="flex h-[60vh] items-center justify-center"><Loader2 className="size-8 animate-spin text-primary" /></div>)
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full"><ChevronLeft className="size-6" /></Button>
        <div className="space-y-0.5">
          <h2 className="text-xl font-black uppercase tracking-tight text-primary font-headline">Pending Settlement</h2>
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">{groupName} • {selectedCycle?.startDate} History</p>
        </div>
      </div>

      <div className="rounded-xl border bg-card shadow-sm overflow-hidden border-border/60">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead className="text-[10px] uppercase font-black tracking-widest pl-6 h-12">Member</TableHead>
              <TableHead className="text-[10px] uppercase font-black tracking-widest h-12">Pending Amount</TableHead>
              <TableHead className="w-[100px] pr-6"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pendingMembers.length > 0 ? pendingMembers.map((m) => (
              <TableRow key={m.id} className="hover:bg-muted/5 transition-colors border-b last:border-none">
                <TableCell className="pl-6 py-4">
                  <div className="flex flex-col">
                    <span className="text-sm font-bold tracking-tight">{m.name}</span>
                    <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">{m.resolvedType}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <span className="text-sm font-black text-destructive tabular-nums">₹{m.pendingAmount.toLocaleString()}</span>
                </TableCell>
                <TableCell className="pr-6 text-right">
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => handleOpenPayment(m)}
                    className="h-8 text-[9px] font-black uppercase tracking-widest border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100"
                  >
                    Collect
                  </Button>
                </TableCell>
              </TableRow>
            )) : (
              <TableRow>
                <TableCell colSpan={3} className="h-40 text-center text-muted-foreground italic text-xs font-bold uppercase tracking-widest">
                  All pending arrears settled.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isPaymentOpen} onOpenChange={setIsPaymentOpen}>
        <DialogContent className="sm:max-w-[400px]">
          {selectedMember && (
            <form onSubmit={handleCollect} className="space-y-6">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2"><Wallet className="size-5 text-primary" /> History Settlement</DialogTitle>
                <DialogDescription>Process arrears for {selectedMember.name} in {selectedCycle?.startDate} cycle.</DialogDescription>
              </DialogHeader>

              <div className="grid gap-4">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Settlement Amount (₹)</Label>
                  <Input 
                    type="number" 
                    value={paymentData.amount || ""} 
                    onChange={e => setPaymentData({...paymentData, amount: Number(e.target.value)})}
                    className="h-11 rounded-xl font-black text-lg text-primary"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Target Audit Date</Label>
                  <Input 
                    type="date" 
                    value={paymentData.date} 
                    min={selectedCycle.startDate}
                    max={selectedCycle.endDate}
                    onChange={e => setPaymentData({...paymentData, date: e.target.value})}
                    className="h-11 rounded-xl font-bold"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Payment Method</Label>
                  <Select value={paymentData.method} onValueChange={v => setPaymentData({...paymentData, method: v})}>
                    <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Cash">Cash</SelectItem>
                      <SelectItem value="UPI">UPI</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <DialogFooter>
                <Button 
                  type="submit" 
                  disabled={isActionPending} 
                  className="w-full h-12 font-black uppercase tracking-[0.2em] shadow-lg active:scale-95 transition-all bg-emerald-600 hover:bg-emerald-700"
                >
                  {isActionPending ? <Loader2 className="size-4 mr-2 animate-spin" /> : <CheckCircle2 className="size-4 mr-2" />}
                  Confirm Settlement
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
