"use client"

import { useState } from "react"
import { NavBar } from "@/components/navbar-new"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { MessageSquare, Send, Bot, User } from "lucide-react"
import Link from "next/link"

type Message = {
  role: "user" | "assistant"
  content: string
}

export default function SupportPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Hi! I'm the FluxSpace assistant. I can help you with questions about magnetic mapping, CSV uploads, pricing, and more. What can I help you with?"
    }
  ])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim()) return

    const userMessage = input.trim()
    setInput("")
    setMessages(prev => [...prev, { role: "user", content: userMessage }])
    setLoading(true)

    // Simple keyword-based responses (you can enhance this with actual AI later)
    await new Promise(resolve => setTimeout(resolve, 800))

    let response = ""
    const lowerInput = userMessage.toLowerCase()

    if (lowerInput.includes("csv") || lowerInput.includes("upload") || lowerInput.includes("file")) {
      response = "To upload a CSV file, go to your Dashboard → select a project → click Upload. Your CSV must include columns: time, lat, lon, alt, roll, pitch, yaw, Bx, By, Bz. Maximum file size is 2GB. Check our Docs page for the complete schema."
    } else if (lowerInput.includes("price") || lowerInput.includes("cost") || lowerInput.includes("plan")) {
      response = "We offer 3 options:\n\n• Starter ($499/scan): Up to 1,000 sq ft, 2D detection + PDF report, 48-hr turnaround\n• Pro ($1,999/mo): Up to 8 scans/month, priority scheduling, team access for 3 users\n• Enterprise (custom): Custom volume, multi-site workflows, dedicated support\n\nAdd-ons like 24-hr rush, 3D mapping, and data exports are available. Check our Pricing page for details!"
    } else if (lowerInput.includes("process") || lowerInput.includes("how long") || lowerInput.includes("time")) {
      response = "Processing typically takes 2-5 minutes depending on file size. You'll receive an email notification when your job completes. The pipeline handles frame rotation, filtering, gridding, and GeoTIFF generation automatically."
    } else if (lowerInput.includes("format") || lowerInput.includes("geotiff") || lowerInput.includes("export")) {
      response = "FluxSpace exports in 3 formats:\n\n• GeoTIFF: Georeferenced raster with embedded CRS\n• PNG: Preview image with color ramp\n• CSV: Gridded values (x, y, anomaly_value)\n\nAll outputs use WGS84 coordinates with automatic UTM projection."
    } else if (lowerInput.includes("gradiometer") || lowerInput.includes("dual sensor")) {
      response = "Yes! FluxSpace supports dual-sensor gradiometer configurations. Just include Bx2, By2, Bz2 columns in your CSV for the second sensor. The system will automatically calculate ΔB = |B_lower| - |B_upper| for enhanced anomaly detection."
    } else if (lowerInput.includes("support") || lowerInput.includes("help") || lowerInput.includes("contact")) {
      response = "For direct support:\n\n• Email: support@fluxspace.com\n• Response time: Within 24 hours (email support on Pro/Team plans)\n• Or use our Contact form for detailed inquiries.\n\nCheck our Docs for FAQs and guides!"
    } else {
      response = "I can help you with:\n\n• File upload & CSV format\n• Pricing & plans\n• Processing pipeline\n• Export formats\n• Technical questions\n\nYou can also check our Docs page or Contact us directly for detailed assistance!"
    }

    setMessages(prev => [...prev, { role: "assistant", content: response }])
    setLoading(false)
  }

  const faqs = [
    {
      question: "How do I upload data?",
      answer: "Go to Dashboard → Projects → Upload. Supports CSV files up to 2GB."
    },
    {
      question: "What are the pricing plans?",
      answer: "Starter ($499/scan), Pro ($1,999/mo for up to 8 scans), and Enterprise (custom). See Pricing page for details."
    },
    {
      question: "How long does processing take?",
      answer: "Typically 2-5 minutes depending on file size and complexity."
    },
    {
      question: "What file formats are supported?",
      answer: "Input: CSV with magnetometer data. Output: GeoTIFF, PNG, CSV."
    }
  ]

  return (
    <div className="flex flex-col min-h-screen">
      <NavBar />
      
      <div className="flex-1 py-24">
        <div className="container max-w-6xl px-4">
          <div className="text-center mb-16">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              Support Center
            </h1>
            <p className="text-xl text-muted-foreground">
              Get help with FluxSpace or chat with our AI assistant
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-8">
            {/* Chatbot */}
            <Card className="flex flex-col h-[600px]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  AI Assistant
                </CardTitle>
                <CardDescription>
                  Ask me anything about FluxSpace
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col">
                <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2">
                  {messages.map((message, i) => (
                    <div
                      key={i}
                      className={`flex gap-3 ${
                        message.role === "user" ? "justify-end" : "justify-start"
                      }`}
                    >
                      {message.role === "assistant" && (
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <Bot className="h-4 w-4 text-primary" />
                        </div>
                      )}
                      <div
                        className={`rounded-lg px-4 py-2 max-w-[80%] ${
                          message.role === "user"
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted"
                        }`}
                      >
                        <p className="text-sm whitespace-pre-line">{message.content}</p>
                      </div>
                      {message.role === "user" && (
                        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                          <User className="h-4 w-4 text-primary-foreground" />
                        </div>
                      )}
                    </div>
                  ))}
                  {loading && (
                    <div className="flex gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Bot className="h-4 w-4 text-primary" />
                      </div>
                      <div className="bg-muted rounded-lg px-4 py-2">
                        <div className="flex gap-1">
                          <div className="w-2 h-2 rounded-full bg-muted-foreground/50 animate-bounce" />
                          <div className="w-2 h-2 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:0.2s]" />
                          <div className="w-2 h-2 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:0.4s]" />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                <form onSubmit={handleSubmit} className="flex gap-2">
                  <Input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask a question..."
                    disabled={loading}
                  />
                  <Button type="submit" size="icon" disabled={loading}>
                    <Send className="h-4 w-4" />
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* FAQs */}
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold mb-4">Quick Help</h2>
                <div className="space-y-4">
                  {faqs.map((faq, i) => (
                    <Card key={i}>
                      <CardHeader>
                        <CardTitle className="text-lg">{faq.question}</CardTitle>
                        <CardDescription>{faq.answer}</CardDescription>
                      </CardHeader>
                    </Card>
                  ))}
                </div>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Need more help?</CardTitle>
                  <CardDescription>
                    Check out our comprehensive documentation or contact our team directly.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex gap-4">
                  <Button asChild variant="outline" className="flex-1">
                    <Link href="/docs">View Docs</Link>
                  </Button>
                  <Button asChild className="flex-1">
                    <Link href="/contact">Contact Us</Link>
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  )
}
