# Environments

Go Virtual Health should use one codebase with separate environments.

## Local

Use local development for UI work, schema changes, seed data, and test payment credentials.

Copy:

```bash
cp .env.local.example .env.local
```

Then run:

```bash
npm run dev
```

## Production

Production should run on Vercel with production Supabase, Resend, PostHog, and payment-provider credentials.

Use `.env.production.example` as the checklist for Vercel environment variables. Do not commit real secrets.

## Recommended Git Flow

- `main`: production-ready code
- `develop`: local/staging integration
- feature branches: focused work such as `codex/auth-roles`, `codex/product-crud`, `codex/nmi-provider`

## Recommended Infrastructure

- Local development: `.env.local`
- Staging/preview: Vercel Preview + Supabase staging project
- Production: Vercel Production + Supabase production project

Keep payment credentials separate per environment. Never use production payment keys in local development.
