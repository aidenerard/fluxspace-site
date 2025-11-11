import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Check } from "lucide-react"
import Link from "next/link"
import { NavBar } from "@/components/navbar"
import { Footer } from "@/components/footer"

const plans = [
  {
    name: "Starter",
    price: "$0",
    description: "Perfect for getting started",
    features: [
      "2 projects",
      "3 jobs per month",
      "2 GB storage",
      "Community support",
    ],
    cta: "Start free",
    href: "/signup",
  },
  {
    name: "Pro",
    price: "$29",
    description: "For professionals and small teams",
    features: [
      "10 projects",
      "30 jobs per month",
      "25 GB storage",
      "Email support",
    ],
    cta: "Get started",
    href: "/signup?plan=pro",
    popular: true,
  },
  {
    name: "Team",
    price: "$99",
    description: "For larger teams and organizations",
    features: [
      "Unlimited projects",
      "150 jobs per month",
      "200 GB storage",
      "Priority support",
    ],
    cta: "Get started",
    href: "/signup?plan=team",
  },
]

export default function PricingPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <NavBar />
      
      <div className="flex-1 py-24">
        <div className="container max-w-6xl px-4">
          <div className="text-center mb-16">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              Simple, transparent pricing
            </h1>
            <p className="text-xl text-muted-foreground">
              Choose the plan that fits your needs. All plans include core features.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 mb-16">
            {plans.map((plan) => (
              <Card key={plan.name} className={plan.popular ? "border-primary shadow-lg" : ""}>
                {plan.popular && (
                  <div className="bg-primary text-primary-foreground text-xs font-semibold text-center py-1">
                    MOST POPULAR
                  </div>
                )}
                <CardHeader>
                  <CardTitle className="text-2xl">{plan.name}</CardTitle>
                  <CardDescription>{plan.description}</CardDescription>
                  <div className="mt-4">
                    <span className="text-4xl font-bold">{plan.price}</span>
                    {plan.price !== "$0" && <span className="text-muted-foreground">/month</span>}
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-center">
                        <Check className="h-5 w-5 text-primary mr-3 flex-shrink-0" />
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

          <div className="bg-muted rounded-lg p-8 text-center">
            <h2 className="text-2xl font-bold mb-4">Need more?</h2>
            <p className="text-muted-foreground mb-6">
              Contact us for custom enterprise plans with higher limits, dedicated support, and on-premise deployment options.
            </p>
            <Button variant="outline" asChild>
              <Link href="/support">Contact sales</Link>
            </Button>
          </div>

          <div className="mt-16">
            <h2 className="text-2xl font-bold text-center mb-8">Frequently asked questions</h2>
            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <h3 className="font-semibold mb-2">What happens when I exceed my plan limits?</h3>
                <p className="text-sm text-muted-foreground">
                  You'll receive a friendly notice when approaching limits. Processing will pause at hard limits until you upgrade or the next billing cycle.
                </p>
              </div>
              <div>
                <h3 className="font-semibold mb-2">Can I upgrade or downgrade anytime?</h3>
                <p className="text-sm text-muted-foreground">
                  Yes. Changes take effect immediately and we'll prorate the difference on your next invoice.
                </p>
              </div>
              <div>
                <h3 className="font-semibold mb-2">What file formats do you support?</h3>
                <p className="text-sm text-muted-foreground">
                  We accept CSV flight logs with specified schema. Optional orthomosaic uploads support GeoTIFF format.
                </p>
              </div>
              <div>
                <h3 className="font-semibold mb-2">Is my data secure?</h3>
                <p className="text-sm text-muted-foreground">
                  All data is encrypted at rest and in transit. Files are stored with per-user access controls and signed URLs.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  )
}
