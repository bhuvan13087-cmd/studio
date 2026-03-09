"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Lock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/firebase"
import { signInWithEmailAndPassword } from "firebase/auth"

export default function LoginPage() {
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const router = useRouter()
  const { toast } = useToast()
  const auth = useAuth()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    
    try {
      await signInWithEmailAndPassword(auth, email, password)
      toast({
        title: "Authenticated",
        description: "Access granted to dashboard.",
      })
      router.push("/dashboard")
    } catch (error: any) {
      console.error("Login error:", error)
      toast({
        variant: "destructive",
        title: "Login Failed",
        description: error.message || "Invalid credentials. Please try again.",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6 font-body">
      <Card className="w-full max-w-sm border-none shadow-2xl bg-card/80 backdrop-blur-sm">
        <CardHeader className="space-y-1 pt-8 pb-6 text-center border-b border-border/50">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 transition-transform hover:scale-105 duration-300">
            <Lock className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight text-primary">Admin Login</CardTitle>
          <CardDescription className="text-muted-foreground/80">
            Enter your credentials to access the portal
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleLogin}>
          <CardContent className="space-y-5 pt-8">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-xs font-bold uppercase tracking-wider text-muted-foreground/70">
                Email Address
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-11 bg-muted/20 border-border/50 focus:bg-background transition-all"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" title="Password" className="text-xs font-bold uppercase tracking-wider text-muted-foreground/70">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-11 bg-muted/20 border-border/50 focus:bg-background transition-all"
              />
            </div>
          </CardContent>
          <CardFooter className="pb-10 pt-6">
            <Button type="submit" className="w-full h-11 text-base font-bold shadow-lg shadow-primary/20 transition-all active:scale-[0.98]" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                "Sign In"
              )}
            </Button>
          </CardFooter>
        </form>
      </Card>
      
      <div className="fixed bottom-6 text-center w-full left-0 pointer-events-none">
        <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted-foreground/40">
          ChitFund Pro &copy; {new Date().getFullYear()}
        </p>
      </div>
    </div>
  )
}
