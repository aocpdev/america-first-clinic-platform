# America First Clinic CRM + eCommerce Platform

Production-oriented SaaS foundation for a healthcare and wellness consultant sales platform.

## Stack

- Next.js App Router, TypeScript, Tailwind CSS, shadcn-style UI primitives, Framer Motion ready
- Supabase PostgreSQL, Supabase Auth, Supabase Storage
- Prisma ORM with normalized multi-tenant models
- Zod validation
- Resend email ready
- PostHog analytics ready
- Vercel hosting ready

## Payment Architecture

The CRM is payment-provider agnostic. Orders, customers, subscriptions, commissions, dashboards, and reports do not depend on Stripe or any one processor.

Payment integrations live behind `PaymentProvider` in [lib/payments/types.ts](/Users/axel/Documents/New%20project%2015/lib/payments/types.ts).

Prepared providers:

- `StripeProvider`
- `AuthorizeNetProvider`
- `NMIProvider`
- `ACHProvider`

Webhook routes are prepared for Stripe, NMI, Authorize.net, and ACH providers under `app/api/webhooks`.

## Roles

- `SUPER_ADMIN`
- `COMPANY_ADMIN`
- `MANAGER`
- `CONSULTANT`
- `CUSTOMER`

Role helpers live in [lib/auth/roles.ts](/Users/axel/Documents/New%20project%2015/lib/auth/roles.ts). Supabase RLS starter policies live in [supabase/rls.sql](/Users/axel/Documents/New%20project%2015/supabase/rls.sql).

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Copy environment variables:

```bash
cp .env.example .env.local
```

You can also use the environment-specific template:

```bash
cp .env.local.example .env.local
```

3. Add Supabase database URLs and service keys.

4. Generate Prisma client:

```bash
npm run prisma:generate
```

5. Run migrations:

```bash
npm run prisma:migrate
```

6. Seed demo data:

```bash
npm run prisma:seed
```

7. Start the app:

```bash
npm run dev
```

## Current First Slice

- English-only UI
- Public site, shop, product pages, consultant storefront, checkout shell
- Admin, consultant, and manager dashboards
- Onboarding flows for company and consultants
- Prisma schema for CRM, commerce, commissions, subscriptions, payments, referrals, teams, logs, notifications, and onboarding
- Payment provider abstraction with provider registry
- Provider-specific webhook route structure
- Supabase RLS starter policy file

## Accounts Needed Later

- Supabase project
- Vercel project
- Resend account/domain
- PostHog project
- Payment processor accounts: NMI, Authorize.net, Stripe, ACH/Plaid/Dwolla as selected

## Local vs Production

Environment setup is documented in [docs/environments.md](/Users/axel/Documents/New%20project%2015/docs/environments.md).

Use `.env.local` for local development and Vercel environment variables for production. Do not commit real secrets.
