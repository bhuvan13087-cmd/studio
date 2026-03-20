"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Lock, ShieldCheck, Mail, KeyRound } from "lucide-react"
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
        title: "Welcome Back",
        description: "Authentication successful. Accessing seat reservations...",
      })
      // Redirect to Chit Rounds by default as per production requirement
      router.push("/rounds")
    } catch (error: any) {
      console.error("Login error:", error)
      toast({
        variant: "destructive",
        title: "Access Denied",
        description: error.message || "Invalid credentials. Please verify your email and password.",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center p-6 overflow-hidden bg-slate-50">
      {/* Decorative Background Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-primary/10 blur-[100px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-accent/20 blur-[100px]" />
        <div 
          className="absolute inset-0 opacity-[0.03]" 
          style={{ 
            backgroundImage: `radial-gradient(circle at 2px 2px, black 1px, transparent 0)`,
            backgroundSize: '32px 32px' 
          }} 
        />
      </div>

      <Card className="relative z-10 w-full max-w-[420px] border-none shadow-[0_20px_50px_rgba(0,0,0,0.1)] rounded-2xl overflow-hidden bg-white">
        {/* Top Accent Bar */}
        <div className="h-2 w-full bg-gradient-to-r from-primary to-accent" />
        
        <CardHeader className="space-y-4 pt-10 pb-6 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/5 shadow-inner">
            <ShieldCheck className="h-8 w-8 text-primary" />
          </div>
          <div className="space-y-1">
            <CardTitle className="text-3xl font-extrabold tracking-tight text-slate-900 font-headline">
              Admin Login
            </CardTitle>
            <CardDescription className="text-slate-500 font-medium px-4">
              Enter your credentials to access the portal
            </CardDescription>
          </div>
        </CardHeader>

        <form onSubmit={handleLogin} className="px-2">
          <CardContent className="space-y-6 pt-2 pb-8">
            <div className="space-y-2">
              <Label 
                htmlFor="email" 
                className="text-xs font-bold uppercase tracking-widest text-slate-500 ml-1"
              >
                Email Address
              </Label>
              <div className="relative group">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors">
                  <Mail className="h-4 w-4" />
                </div>
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@gmail.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="pl-10 h-12 bg-slate-50 border-slate-200 focus:bg-white focus:ring-primary/20 transition-all text-slate-900 font-medium rounded-xl"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label 
                htmlFor="password" 
                className="text-xs font-bold uppercase tracking-widest text-slate-500 ml-1"
              >
                Password
              </Label>
              <div className="relative group">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors">
                  <KeyRound className="h-4 w-4" />
                </div>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="pl-10 h-12 bg-slate-50 border-slate-200 focus:bg-white focus:ring-primary/20 transition-all text-slate-900 font-medium rounded-xl"
                />
              </div>
            </div>
          </CardContent>

          <CardFooter className="pb-12 flex flex-col gap-4">
            <Button 
              type="submit" 
              className="w-full h-12 text-base font-bold rounded-xl shadow-lg bg-primary hover:bg-primary/90 shadow-primary/20 active:scale-[0.98] transition-all" 
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Authenticating...
                </>
              ) : (
                "Sign In"
              )}
            </Button>
            <p className="text-center text-[10px] text-slate-400 font-medium uppercase tracking-tighter">
              Authorized Personnel Only
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
