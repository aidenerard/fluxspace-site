"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { createBrowserSupabaseClient } from "@/lib/supabase-client"
import { useToast } from "@/components/ui/use-toast"
import { Eye, EyeOff } from "lucide-react"

export default function SignUpPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [name, setName] = useState("")
  const [loading, setLoading] = useState(false)
  const [passwordError, setPasswordError] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [signupSuccess, setSignupSuccess] = useState(false)
  const [needsEmailConfirmation, setNeedsEmailConfirmation] = useState(false)
  const router = useRouter()
  const { toast } = useToast()
  
  // Create supabase client
  const supabase = createBrowserSupabaseClient()
  
  // Debug: Log environment variables (remove in production)
  if (typeof window !== 'undefined') {
    console.log('Supabase URL configured:', !!process.env.NEXT_PUBLIC_SUPABASE_URL)
    console.log('Supabase Key configured:', !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  }

  // Validate passwords whenever they change
  useEffect(() => {
    // If both fields are empty, no error
    if (!password && !confirmPassword) {
      setPasswordError("")
      return
    }
    
    // If only password is filled, check length
    if (password && !confirmPassword) {
      if (password.length < 6) {
        setPasswordError("Password must be at least 6 characters")
        return
      }
      setPasswordError("")
      return
    }
    
    // If only confirm password is filled, wait for password
    if (!password && confirmPassword) {
      setPasswordError("")
      return
    }
    
    // Both fields have values - validate
    if (password && confirmPassword) {
      // Check length first
      if (password.length < 6) {
        setPasswordError("Password must be at least 6 characters")
        return
      }
      
      // Compare passwords (exact match)
      if (password !== confirmPassword) {
        setPasswordError("Passwords do not match")
        return
      }
      
      // Passwords match and are long enough
      setPasswordError("")
    }
  }, [password, confirmPassword])

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setPasswordError("")

    // Final validation before submit
    if (password.length < 6) {
      setPasswordError("Password must be at least 6 characters")
      setLoading(false)
      return
    }
    
    if (password !== confirmPassword) {
      setPasswordError("Passwords do not match")
      setLoading(false)
      return
    }
    
    // Clear any error if validation passes
    setPasswordError("")

    try {
      console.log("Attempting signup with email:", email.trim())
      
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password: password,
        options: {
          data: {
            name: name.trim(),
          },
          emailRedirectTo: `${window.location.origin}/dashboard`,
        },
      })

      console.log("Signup response:", { data, error })

      if (error) {
        console.error("Supabase signup error:", error)
        console.error("Error details:", JSON.stringify(error, null, 2))
        toast({
          title: "Error",
          description: error.message || "Failed to create account",
          variant: "destructive",
        })
        setLoading(false)
        return
      }

      // Check if email confirmation is required
      if (data.user && !data.session) {
        // Email confirmation required
        toast({
          title: "Check your email",
          description: "We sent you a confirmation email. Please click the link to verify your account, then sign in.",
        })
        
        // Still create user record even if not confirmed
        await supabase.from("users").insert({
          id: data.user.id,
          email: data.user.email!,
          name,
        }).catch(err => console.error("Error creating user record:", err))
        
        // Show success state with navigation options
        setSignupSuccess(true)
        setNeedsEmailConfirmation(true)
        setLoading(false)
        return
      }

      if (data.user && data.session) {
        // User is logged in immediately (email confirmation disabled)
        console.log("User signed up and logged in:", data.user.id)
        
        // Create user record
        const { error: userError } = await supabase.from("users").insert({
          id: data.user.id,
          email: data.user.email!,
          name,
        })

        if (userError) {
          console.error("Error creating user record:", userError)
          toast({
            title: "Warning",
            description: "Account created but user record failed. Please contact support.",
            variant: "destructive",
          })
          setLoading(false)
        } else {
          // Show success state
          setSignupSuccess(true)
          setNeedsEmailConfirmation(false)
          setLoading(false)
          
          toast({
            title: "Success!",
            description: "Account created successfully!",
          })
          
          // Auto-redirect after 2 seconds, but also show buttons
          setTimeout(() => {
            router.push("/dashboard")
            router.refresh()
          }, 2000)
        }
      } else if (data.user && !data.session) {
        // Already handled above, but just in case
        setLoading(false)
      } else {
        toast({
          title: "Error",
          description: "Failed to create account. Please try again.",
          variant: "destructive",
        })
        setLoading(false)
      }
    } catch (error: any) {
      console.error("Signup error:", error)
      
      // Provide more helpful error messages
      let errorMessage = "Failed to create account."
      
      if (error.message) {
        errorMessage = error.message
      } else if (error.toString().includes("fetch")) {
        errorMessage = "Network error: Could not connect to Supabase. Please check your internet connection and try again."
      } else if (error.toString().includes("CORS")) {
        errorMessage = "CORS error: Please check your Supabase project settings."
      } else {
        errorMessage = error.toString() || "Unknown error occurred. Please check the browser console for details."
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      })
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-muted/50">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">Create an account</CardTitle>
          <CardDescription>
            Enter your details to get started with FluxSpace
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSignUp} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                placeholder="John Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                  }}
                  required
                  minLength={6}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value)
                  }}
                  required
                  minLength={6}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              {passwordError && (
                <p className="text-sm text-red-500">{passwordError}</p>
              )}
            </div>
            <Button 
              type="submit" 
              className="w-full" 
              disabled={loading || passwordError !== "" || signupSuccess}
            >
              {loading ? "Creating account..." : signupSuccess ? "Account Created!" : "Create account"}
            </Button>
          </form>

          {signupSuccess && (
            <div className="mt-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <h3 className="font-semibold text-green-900 dark:text-green-100 mb-2">
                {needsEmailConfirmation ? "Check Your Email" : "Account Created Successfully!"}
              </h3>
              <p className="text-sm text-green-800 dark:text-green-200 mb-4">
                {needsEmailConfirmation 
                  ? "We sent a confirmation email. Please click the link to verify your account, then sign in."
                  : "Your account has been created. You'll be redirected to the dashboard shortly, or use the buttons below."
                }
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                {needsEmailConfirmation ? (
                  <>
                    <Button 
                      onClick={() => router.push("/signin")} 
                      className="flex-1"
                      variant="outline"
                    >
                      Go to Sign In
                    </Button>
                    <Button 
                      onClick={() => router.push("/")} 
                      className="flex-1"
                      variant="outline"
                    >
                      Go to Home
                    </Button>
                  </>
                ) : (
                  <>
                    <Button 
                      onClick={() => {
                        router.push("/dashboard")
                        router.refresh()
                      }} 
                      className="flex-1"
                    >
                      Go to Dashboard
                    </Button>
                    <Button 
                      onClick={() => router.push("/")} 
                      className="flex-1"
                      variant="outline"
                    >
                      Go to Home
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}

          {!signupSuccess && (
            <div className="mt-4 text-center text-sm">
              Already have an account?{" "}
              <Link href="/signin" className="text-primary hover:underline">
                Sign in
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
