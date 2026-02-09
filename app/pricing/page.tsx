import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Check } from "lucide-react"
import Link from "next/link"
import { NavBar } from "@/components/navbar"
import { Footer } from "@/components/footer"

/* ------------------------------------------------------------------ */
/*  Single source of truth for all pricing data                        */
/* ------------------------------------------------------------------ */

const plans = [
  {
    name: "Starter",
    tagline: "Per-scan",
    price: "$499",
    priceSuffix: "per scan",
    description: "Best for one-off projects and trial jobs",
    features: [
      "Up to 10,000 sq ft scan area",
      "3D detection + anomaly outputs",
      "Basic PDF report",
      "24-hour turnaround",
      "Additional area billed as add-on",
    ],
    cta: "Request a scan",
    href: "/contact",
    popular: false,
  },
  {
    name: "Pro",
    tagline: "Monthly",
    price: "$1,999",
    priceSuffix: "/month",
    description: "Best for contractors doing recurring jobs",
    features: [
      "Up to 8 scans per month (each up to 10,000 sq ft)",
      "Priority scheduling",
      "Team access for 3 users",
      "Standard deliverables included",
      "$299 per additional scan",
    ],
    cta: "Start Pro",
    href: "/contact?plan=pro",
    popular: true,
  },
  {
    name: "Enterprise",
    tagline: "Custom",
    price: "Custom",
    priceSuffix: null,
    description: "Best for multi-site teams and engineering firms",
    features: [
      "Custom scan volume",
      "Multi-site workflows",
      "Dedicated support",
      "Custom reporting formats",
      "Integration options",
    ],
    cta: "Talk to sales",
    href: "/contact?plan=enterprise",
    popular: false,
  },
]

const addOns = [
  { name: "Extra area", price: "$0.35 / sq ft over included limit" },
  { name: "24-hour turnaround", price: "+$250 per scan" },
  { name: "3D mapping package (early access)", price: "+$750 per scan" },
  { name: "On-site repeat scan / verification visit", price: "+$500" },
  { name: "Data export bundle", price: "+$200", note: "Raw + processed + geo-tagged outputs when available" },
]

const faqs = [
  {
    question: "What counts as one scan?",
    answer:
      "A single scan covers up to 10,000 sq ft of contiguous area. If your site is larger, extra area is billed at $0.35 per sq ft over the included limit.",
  },
  {
    question: "Can I upgrade or downgrade anytime?",
    answer:
      "Yes. You can switch between Starter (per-scan) and Pro (monthly) at any time. Changes take effect on your next billing cycle.",
  },
  {
    question: "What deliverables are included?",
    answer:
      "Every scan includes 2D anomaly detection outputs and a PDF report. Add-ons like 3D mapping and raw data exports are available for an additional fee.",
  },
  {
    question: "How fast do I get results?",
    answer:
      "Standard turnaround is 24 hours. Pro subscribers get priority scheduling.",
  },
]

/* ------------------------------------------------------------------ */
/*  Page component                                                     */
/* ------------------------------------------------------------------ */

export default function PricingPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <NavBar />

      <div className="flex-1 py-24">
        <div className="container max-w-6xl px-4">
          {/* Header */}
          <div className="text-center mb-16">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              Simple pricing for scans and ongoing projects.
            </h1>
            <p className="text-xl text-muted-foreground">
              Start with one scan, or subscribe if you scan often.
            </p>
          </div>

          {/* Plan cards */}
          <div className="grid md:grid-cols-3 gap-8 mb-20">
            {plans.map((plan) => (
              <Card
                key={plan.name}
                className={
                  plan.popular
                    ? "border-primary shadow-lg relative"
                    : "relative"
                }
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-primary text-primary-foreground text-xs font-semibold px-3 py-1 rounded-full">
                      Most popular
                    </span>
                  </div>
                )}

                <CardHeader className="pt-8">
                  <div className="flex items-center gap-2 mb-1">
                    <CardTitle className="text-2xl">{plan.name}</CardTitle>
                    <span className="text-xs text-muted-foreground border rounded-full px-2 py-0.5">
                      {plan.tagline}
                    </span>
                  </div>
                  <CardDescription>{plan.description}</CardDescription>
                  <div className="mt-4">
                    <span className="text-4xl font-bold">{plan.price}</span>
                    {plan.priceSuffix && (
                      <span className="text-muted-foreground ml-1">
                        {plan.priceSuffix}
                      </span>
                    )}
                  </div>
                </CardHeader>

                <CardContent>
                  <ul className="space-y-3">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start">
                        <Check className="h-5 w-5 text-primary mr-3 flex-shrink-0 mt-0.5" />
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>

                <CardFooter>
                  <Button
                    asChild
                    className="w-full"
                    variant={plan.popular ? "default" : "outline"}
                  >
                    <Link href={plan.href}>{plan.cta}</Link>
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>

          {/* Add-ons */}
          <div className="mb-20">
            <h2 className="text-2xl font-bold text-center mb-2">
              Optional add-ons
            </h2>
            <p className="text-muted-foreground text-center mb-8">
              Available with any plan.
            </p>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {addOns.map((addon) => (
                <div
                  key={addon.name}
                  className="border rounded-lg p-4 flex flex-col justify-between"
                >
                  <div>
                    <p className="font-medium text-sm">{addon.name}</p>
                    {addon.note && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {addon.note}
                      </p>
                    )}
                  </div>
                  <p className="text-sm font-semibold mt-2">{addon.price}</p>
                </div>
              ))}
            </div>
          </div>

          {/* FAQ */}
          <div className="mb-20">
            <h2 className="text-2xl font-bold text-center mb-8">
              Frequently asked questions
            </h2>
            <div className="grid md:grid-cols-2 gap-8">
              {faqs.map((faq) => (
                <div key={faq.question}>
                  <h3 className="font-semibold mb-2">{faq.question}</h3>
                  <p className="text-sm text-muted-foreground">{faq.answer}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Questions */}
          <div className="bg-muted rounded-lg p-8 text-center">
            <h2 className="text-2xl font-bold mb-4">Questions?</h2>
            <p className="text-muted-foreground mb-6">
              Reach out and we&apos;ll help you figure out the right option for
              your project.
            </p>
            <Button variant="outline" asChild>
              <Link href="mailto:sales@fluxspace.com">
                sales@fluxspace.com
              </Link>
            </Button>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  )
}
