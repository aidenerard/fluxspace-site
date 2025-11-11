import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
  typescript: true,
})

export const PLANS = {
  starter: {
    name: 'Starter',
    price: 0,
    priceId: process.env.STRIPE_STARTER_PRICE_ID || '',
    features: [
      '2 projects',
      '3 jobs per month',
      '2 GB storage',
      'Community support',
    ],
    limits: {
      projects: 2,
      jobsPerMonth: 3,
      storageBytes: 2 * 1024 * 1024 * 1024,
    },
  },
  pro: {
    name: 'Pro',
    price: 29,
    priceId: process.env.STRIPE_PRO_PRICE_ID || '',
    features: [
      '10 projects',
      '30 jobs per month',
      '25 GB storage',
      'Email support',
    ],
    limits: {
      projects: 10,
      jobsPerMonth: 30,
      storageBytes: 25 * 1024 * 1024 * 1024,
    },
  },
  team: {
    name: 'Team',
    price: 99,
    priceId: process.env.STRIPE_TEAM_PRICE_ID || '',
    features: [
      'Unlimited projects',
      '150 jobs per month',
      '200 GB storage',
      'Priority support',
    ],
    limits: {
      projects: Infinity,
      jobsPerMonth: 150,
      storageBytes: 200 * 1024 * 1024 * 1024,
    },
  },
} as const

export type PlanType = keyof typeof PLANS
