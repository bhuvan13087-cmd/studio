
"use client"

import { Database } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"

/**
 * @fileOverview Cycles Dashboard
 * 
 * Clean state placeholder for historical monitoring and auditing.
 */
export default function CyclesDashboard() {
  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-primary font-headline uppercase">
            Cycles Dashboard
          </h2>
          <p className="text-sm text-muted-foreground font-medium">
            Historical monitoring and auditing records.
          </p>
        </div>
      </div>

      <Card className="border-2 border-dashed rounded-2xl bg-muted/5 shadow-none">
        <CardContent className="h-[400px] flex flex-col items-center justify-center space-y-4">
          <div className="p-6 rounded-full bg-muted/10 border border-muted/20">
            <Database className="size-12 text-muted-foreground/30" />
          </div>
          <div className="text-center space-y-1">
            <p className="text-sm font-black uppercase tracking-[0.2em] text-muted-foreground/60">
              No cycle data yet
            </p>
            <p className="text-xs text-muted-foreground italic font-medium">
              Initialize a monitoring period to begin historical auditing.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
