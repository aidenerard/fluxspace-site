"use client"

import { useState } from "react"
import { createBrowserSupabaseClient } from "@/lib/supabase-client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function TestConnectionPage() {
  const [result, setResult] = useState<string>("")
  const [loading, setLoading] = useState(false)

  const testConnection = async () => {
    setLoading(true)
    setResult("Testing...")

    try {
      const supabase = createBrowserSupabaseClient()
      
      // Test 1: Check if client was created
      setResult("✓ Supabase client created\n")
      
      // Test 2: Try to get current user (should fail if not logged in, but should connect)
      const { data: authData, error: authError } = await supabase.auth.getUser()
      
      if (authError && authError.message.includes("JWT")) {
        setResult(prev => prev + "✓ Connected to Supabase (auth check failed as expected - not logged in)\n")
      } else if (authError) {
        setResult(prev => prev + `⚠ Auth error: ${authError.message}\n`)
      } else {
        setResult(prev => prev + "✓ Connected to Supabase (user found)\n")
      }

      // Test 3: Try a simple query
      const { data: tableData, error: tableError } = await supabase
        .from("users")
        .select("count")
        .limit(1)

      if (tableError) {
        if (tableError.message.includes("permission") || tableError.message.includes("policy")) {
          setResult(prev => prev + "✓ Database connection works (RLS blocking query as expected)\n")
        } else if (tableError.message.includes("relation") || tableError.message.includes("does not exist")) {
          setResult(prev => prev + `⚠ Table might not exist: ${tableError.message}\n`)
        } else {
          setResult(prev => prev + `✗ Database error: ${tableError.message}\n`)
        }
      } else {
        setResult(prev => prev + "✓ Database query successful\n")
      }

      // Test 4: Check environment variables
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL
      const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      
      setResult(prev => prev + `\nEnvironment Variables:\n`)
      setResult(prev => prev + `URL: ${url ? "✓ Set" : "✗ Missing"}\n`)
      setResult(prev => prev + `Key: ${key ? "✓ Set (length: " + key.length + ")" : "✗ Missing"}\n`)
      
      if (url) {
        setResult(prev => prev + `URL value: ${url.substring(0, 30)}...\n`)
      }

      setResult(prev => prev + `\n✅ All tests completed!`)

    } catch (error: any) {
      setResult(`✗ Error: ${error.message}\n\nThis usually means:\n1. Wrong Supabase URL\n2. Wrong API key\n3. Network/CORS issue\n\nCheck your .env.local file and restart your dev server.`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-muted/50">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Test Supabase Connection</CardTitle>
          <CardDescription>
            This page will test if your Supabase keys are working correctly
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={testConnection} disabled={loading} className="w-full">
            {loading ? "Testing..." : "Test Connection"}
          </Button>
          
          {result && (
            <div className="bg-muted p-4 rounded-lg">
              <pre className="whitespace-pre-wrap text-sm font-mono">{result}</pre>
            </div>
          )}

          <div className="text-sm text-muted-foreground space-y-2">
            <p><strong>What to check:</strong></p>
            <ul className="list-disc list-inside space-y-1">
              <li>If you see &quot;✗ Missing&quot; for URL or Key, your .env.local file is not being loaded</li>
              <li>If you see connection errors, your keys might be wrong</li>
              <li>If you see &quot;✓ Connected&quot;, your keys are correct!</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
