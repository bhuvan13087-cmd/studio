"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import { AlertTriangle, RotateCcw } from "lucide-react"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log the error for diagnosis
    console.error("Application Error Boundary caught:", error)
    
    // CRITICAL RECOVERY: Ensure body pointer events and overflow are reset 
    // to prevent the UI from being locked if a modal/popup crashed.
    document.body.style.pointerEvents = 'auto'
    document.body.style.overflow = 'auto'
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center space-y-6 animate-in fade-in duration-500">
      <div className="h-20 w-20 rounded-full bg-destructive/10 flex items-center justify-center">
        <AlertTriangle className="h-10 w-10 text-destructive" />
      </div>
      <div className="space-y-2">
        <h2 className="text-2xl font-bold tracking-tight">Something went wrong</h2>
        <p className="text-muted-foreground max-w-md mx-auto">
          The application encountered an unexpected error. This might be due to a connection issue or a security rule restriction.
        </p>
      </div>
      <div className="flex flex-col sm:flex-row gap-3">
        <Button 
          variant="outline" 
          onClick={() => window.location.reload()}
          className="gap-2 font-bold"
        >
          <RotateCcw className="h-4 w-4" />
          Reload Page
        </Button>
        <Button onClick={() => reset()} className="gap-2 font-bold">
          Try Again
        </Button>
      </div>
      {error.message && (
        <div className="mt-8 p-4 bg-muted rounded-lg text-left max-w-2xl w-full overflow-auto border border-border/50 shadow-inner">
          <p className="text-[10px] font-mono text-muted-foreground break-all whitespace-pre-wrap leading-tight">
            Error Digest: {error.digest || 'N/A'}
            {"\n"}{error.message}
          </p>
        </div>
      )}
    </div>
  )
}
