
"use client"

import { useState, useMemo } from "react"
import { Search, Loader2, Database, Calendar, User, FileText } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, query, orderBy } from "firebase/firestore"
import { format, parseISO, isValid } from "date-fns"

export default function AuditLogsPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [adminFilter, setAdminFilter] = useState("")
  const db = useFirestore()

  const logsQuery = useMemoFirebase(() => query(collection(db, 'auditLogs'), orderBy('timestamp', 'desc')), [db])
  const { data: logs, isLoading } = useCollection(logsQuery)

  const filteredLogs = useMemo(() => {
    if (!logs) return []
    return logs.filter(log => {
      const matchesAction = log.actionDescription?.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesAdmin = log.adminEmail?.toLowerCase().includes(adminFilter.toLowerCase())
      return matchesAction && matchesAdmin
    })
  }, [logs, searchTerm, adminFilter])

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-500 pb-10 overflow-x-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-2xl sm:text-3xl font-headline font-bold tracking-tight text-primary">System Audit Logs</h2>
          <p className="text-sm text-muted-foreground">Monitor all administrative actions and system updates.</p>
        </div>
      </div>

      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 bg-card p-4 rounded-xl border border-border/50 shadow-sm">
        <div className="flex items-center space-x-2 bg-muted/30 px-3 py-2 rounded-lg">
          <Search className="size-4 text-muted-foreground shrink-0" />
          <Input
            placeholder="Search by action description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="border-none focus-visible:ring-0 shadow-none bg-transparent h-8 text-sm"
          />
        </div>
        <div className="flex items-center space-x-2 bg-muted/30 px-3 py-2 rounded-lg">
          <User className="size-4 text-muted-foreground shrink-0" />
          <Input
            placeholder="Filter by admin email..."
            value={adminFilter}
            onChange={(e) => setAdminFilter(e.target.value)}
            className="border-none focus-visible:ring-0 shadow-none bg-transparent h-8 text-sm"
          />
        </div>
      </div>

      <Card className="border-border/50 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="font-bold text-xs uppercase tracking-wider h-12 pl-6 min-w-[180px]">Date & Time</TableHead>
                <TableHead className="font-bold text-xs uppercase tracking-wider h-12 min-w-[200px]">Admin</TableHead>
                <TableHead className="font-bold text-xs uppercase tracking-wider h-12 pr-6">Action Description</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLogs.length > 0 ? (
                filteredLogs.map((log) => {
                  let displayDate = "-"
                  if (log.timestamp) {
                    // Handle Firestore Timestamp or ISO string
                    const dateObj = log.timestamp?.toDate ? log.timestamp.toDate() : new Date(log.timestamp)
                    if (isValid(dateObj)) {
                      displayDate = format(dateObj, 'dd MMM yyyy, hh:mm a')
                    }
                  }

                  return (
                    <TableRow key={log.id} className="hover:bg-muted/5 transition-colors">
                      <TableCell className="text-[10px] sm:text-xs font-medium tabular-nums text-muted-foreground pl-6">
                        {displayDate}
                      </TableCell>
                      <TableCell className="text-xs font-semibold">
                        <div className="flex items-center gap-2">
                          <User className="size-3 text-primary opacity-50" />
                          {log.adminEmail}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs sm:text-sm font-medium pr-6 py-4">
                        <div className="flex items-start gap-2">
                          <FileText className="size-4 text-primary shrink-0 mt-0.5" />
                          <span className="leading-relaxed">{log.actionDescription}</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={3} className="h-40 text-center">
                    <div className="flex flex-col items-center justify-center space-y-2 text-muted-foreground">
                      <Database className="size-10 opacity-20" />
                      <p className="italic text-sm">No logs found matching your filters.</p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  )
}
