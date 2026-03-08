"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ShieldCheck, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"

export default function LoginPage() {
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const router = useRouter()
  const { toast } = useToast()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    
    // Simulate login for demo purposes
    setTimeout(() => {
      if (email === "admin@chitfund.pro" && password === "password") {
        router.push("/dashboard")
      } else if (email && password) {
        // Allow any input for preview
        router.push("/dashboard")
      } else {
        toast({
          variant: "destructive",
          title: "Login Failed",
          description: "Please enter valid credentials.",
        })
      }
      setLoading(false)
    }, 1500)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6 font-body">
      <div className="w-full max-w-md space-y-8">
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="flex aspect-square size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg mb-4">
            <ShieldCheck className="size-8" />
          </div>
          <h1 className="font-headline text-3xl font-bold tracking-tight text-foreground">ChitFund Pro</h1>
          <p className="text-muted-foreground text-lg">Secure Administrator Access</p>
        </div>

        <Card className="border-border/50 shadow-xl overflow-hidden bg-card/50 backdrop-blur-sm">
          <CardHeader className="space-y-1 pb-6">
            <CardTitle className="text-2xl text-center">Login</CardTitle>
            <CardDescription className="text-center">
              Enter your credentials to manage your chit funds
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleLogin}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@chitfund.pro"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="bg-background"
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                </div>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="bg-background"
                />
              </div>
            </CardContent>
            <CardFooter className="pt-4">
              <Button type="submit" className="w-full text-lg h-12" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 size-5 animate-spin" />
                    Authenticating...
                  </>
                ) : (
                  "Sign In"
                )}
              </Button>
            </CardFooter>
          </form>
        </Card>
        
        <p className="text-center text-sm text-muted-foreground">
          Authorized personnel only. All access is logged.
        </p>
      </div>
    </div>
  )
}
