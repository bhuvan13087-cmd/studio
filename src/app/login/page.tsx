
"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { Loader2, Mail, KeyRound } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/firebase"
import { signInWithEmailAndPassword, signInAnonymously, createUserWithEmailAndPassword } from "firebase/auth"

export default function LoginPage() {
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const router = useRouter()
  const { toast } = useToast()
  const auth = useAuth()

  const handleBypass = async () => {
    setLoading(true)
    try {
      await signInAnonymously(auth)
      toast({
        title: "Bypass Authorized",
        description: "Logged in anonymously.",
      })
      router.push("/rounds")
    } catch (err: any) {
      console.warn("Anonymous sign-in failed, trying email registration/login...", err)
      try {
        await createUserWithEmailAndPassword(auth, "devadmin@gmail.com", "Password@123")
        toast({
          title: "Bypass Successful",
          description: "Registered and logged in with devadmin@gmail.com",
        })
        router.push("/rounds")
      } catch (err2: any) {
        try {
          await signInWithEmailAndPassword(auth, "devadmin@gmail.com", "Password@123")
          toast({
            title: "Bypass Successful",
            description: "Logged in with devadmin@gmail.com",
          })
          router.push("/rounds")
        } catch (err3: any) {
          toast({
            variant: "destructive",
            title: "Bypass Failed",
            description: `Anon: ${err.message}. Email: ${err3.message}`,
          })
          setLoading(false)
        }
      }
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    
    try {
      await signInWithEmailAndPassword(auth, email, password)
      toast({
        title: "Welcome Back",
        description: "Authentication successful. Accessing seat reservations...",
      })
      router.push("/rounds")
    } catch (error: any) {
      let errorMessage = "Login failed. Please try again"
      
      if (error.code === 'auth/user-not-found') {
        errorMessage = "Email ID is incorrect"
      } else if (error.code === 'auth/wrong-password') {
        errorMessage = "Password is incorrect"
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = "Invalid email format"
      } else if (error.code === 'auth/network-request-failed') {
        errorMessage = "Network error. Check your connection"
      } else if (error.code === 'auth/invalid-credential') {
        errorMessage = "Invalid credentials. Please verify your email and password."
      }
      
      toast({
        variant: "destructive",
        title: "Access Denied",
        description: errorMessage,
      })
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

      <Card className="relative z-10 w-full max-w-[420px] border-none shadow-[0_20px_50px_rgba(0,0,0,0.1)] rounded-3xl overflow-hidden bg-white">
        <div className="h-2 w-full bg-gradient-to-r from-primary to-accent" />
        
        <CardHeader className="space-y-4 pt-12 pb-6 text-center">
          <div className="mx-auto flex h-32 w-32 items-center justify-center overflow-hidden">
            <Image 
              src="/chitfund.png" 
              alt="Logo" 
              width={128} 
              height={128} 
              className="object-contain"
              priority
            />
          </div>
          <div className="space-y-1.5">
            <CardTitle className="text-3xl font-black tracking-tight text-primary font-headline uppercase">
              Admin Portal
            </CardTitle>
            <CardDescription className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">
              Cloud Management Protocol
            </CardDescription>
          </div>
        </CardHeader>

        <form onSubmit={handleLogin} className="px-2">
          <CardContent className="space-y-6 pt-2 pb-8">
            <div className="space-y-2">
              <Label 
                htmlFor="email" 
                className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 ml-1"
              >
                Identification
              </Label>
              <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors">
                  <Mail className="size-4" />
                </div>
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@gmail.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="pl-11 h-12 bg-slate-50 border-slate-200 focus:bg-white focus:ring-primary/20 transition-all text-slate-900 font-bold rounded-2xl"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label 
                htmlFor="password" 
                className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 ml-1"
              >
                Security Key
              </Label>
              <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors">
                  <KeyRound className="size-4" />
                </div>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="pl-11 h-12 bg-slate-50 border-slate-200 focus:bg-white focus:ring-primary/20 transition-all text-slate-900 font-bold rounded-2xl"
                />
              </div>
            </div>
          </CardContent>

          <CardFooter className="pb-12 flex flex-col gap-4">
            <Button 
              type="submit" 
              className="w-full h-14 text-base font-black uppercase tracking-[0.15em] rounded-2xl shadow-xl bg-primary hover:bg-primary/90 shadow-primary/20 active:scale-[0.98] transition-all" 
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Verifying...
                </>
              ) : (
                "Authorize Access"
              )}
            </Button>
            <p className="text-center text-[9px] text-slate-400 font-black uppercase tracking-[0.3em]">
              Secured Endpoint
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
