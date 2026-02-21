# Stripe + Resend Premium Gate (Plug-and-Play Scaffold)

Production-oriented scaffold for SaaS subscription billing with:

- Next.js App Router + TypeScript
- PostgreSQL / Supabase Postgres
- Stripe Subscriptions + Webhooks
- Deterministic subscription transition engine
- Server-side tier enforcement
- Outbox email workflow + Resend worker

---

## 1) What this gives you

- **Deterministic billing state** from Stripe events (`f(S, E) → S'`) in `lib/subscription/transition.ts`
- **Idempotent webhook processing** with insert-first event storage in `stripe_events`
- **Atomic subscription mutation** in serializable DB transactions
- **Server-only authorization** for premium features via `requireTier(...)`
- **Reliable transactional emails** via outbox table + worker (`FOR UPDATE SKIP LOCKED`)

---

## 2) Plug-and-play copy checklist (for another app)

If you want to copy this into an existing app, bring these files/folders:

### Core billing + webhook
- `app/api/checkout/route.ts`
- `app/api/stripe/webhook/route.ts`
- `lib/stripe.ts`
- `lib/subscription/transition.ts`
- `lib/subscription/processor.ts`
- `lib/subscription/gate.ts`
- `types/subscription.ts`

### Database + env
- `lib/db.ts`
- `lib/env.ts`
- `db/migrations/001_subscription_platform.sql`
- `.env.example`

### Email outbox
- `lib/email/outbox.ts`
- `lib/email/resend.ts`
- `lib/email/worker.ts`
- `scripts/email-worker.ts`

### Optional demo pages/endpoints
- `app/page.tsx`
- `app/pricing/page.tsx`
- `app/auth/page.tsx`
- `app/dashboard/page.tsx`
- `app/api/dashboard/pro/analytics/route.ts`
- `app/api/dashboard/fintech/report/route.ts`
- `lib/subscription/service.ts`

---

## 3) Required environment variables

Create `.env.local` (or platform secrets) using:

```bash
DATABASE_URL=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_PRO=
STRIPE_PRICE_FINTECH=
RESEND_API_KEY=
NEXT_PUBLIC_APP_URL=
```

Notes:
- `STRIPE_PRICE_*` are your recurring price IDs from Stripe Dashboard.
- `NEXT_PUBLIC_APP_URL` should be your app origin (`https://yourapp.com`).
- Env is validated at runtime in `lib/env.ts`.

---

## 4) Supabase integration guide

This project is **Supabase-compatible** because Supabase uses Postgres.

### A. Create project and get connection string
1. Create Supabase project.
2. Open **Project Settings → Database**.
3. Copy the Postgres connection URI and set it to `DATABASE_URL`.

### B. Run migration
Apply `db/migrations/001_subscription_platform.sql` to Supabase SQL Editor (or your migration pipeline).

This creates:
- enums: `subscription_status`, `tier`, `email_status`
- tables: `profiles`, `stripe_events`, `email_jobs`
- replay protection: unique key on `(profile_id, stripe_event_id, template)`

### C. Tie Supabase Auth user to `profiles.id`
Recommended pattern:
- Use `auth.users.id` as your `profiles.id`.
- Ensure app code passes the correct `profileId` to checkout metadata.

Example insert (on user signup):

```sql
insert into profiles (id) values ('<auth_user_uuid>')
on conflict (id) do nothing;
```

### D. (Optional) RLS strategy
Because billing mutations are server-side, keep webhook/worker using **service role** connection.
If enabling RLS for app traffic:
- restrict direct update of subscription columns from client roles
- allow reads as needed
- keep webhook/worker path server-only

---

## 5) Stripe integration setup

1. Create Stripe Products/Prices for:
   - Pro monthly
   - Fintech monthly
2. Set `STRIPE_PRICE_PRO` and `STRIPE_PRICE_FINTECH`.
3. Configure webhook endpoint:
   - URL: `https://yourapp.com/api/stripe/webhook`
   - events:
     - `customer.subscription.created`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
4. Copy webhook signing secret to `STRIPE_WEBHOOK_SECRET`.

Security guarantees in code:
- Checkout price ID is derived server-side (`derivePriceIdForTier`)
- Webhook verifies Stripe signature before processing
- Event is inserted first to prevent duplicate processing

---

## 6) Resend outbox integration setup

1. Verify sender domain in Resend (SPF/DKIM).
2. Set `RESEND_API_KEY`.
3. Update sender in `lib/email/resend.ts` (`from: billing@...`) to your verified domain.
4. Schedule worker every 30–60 seconds:

```bash
npm run email-worker
```

Worker behavior:
- claims jobs with `FOR UPDATE SKIP LOCKED`
- retries failed sends up to 3x
- marks as `dead_letter` after max retries
- never mutates subscription state

---

## 7) Server-side feature gating usage

Use `requireTier(profile, requiredTier)` in API routes, server actions, and internal services.

```ts
import { requireTier } from "@/lib/subscription/gate";

requireTier(profile, "pro");
```

Access is allowed only when:
- `subscription_status = 'active'`
- `current_period_end > NOW()`
- profile plan satisfies required tier

---

## 8) Local run flow

```bash
npm install
npm run typecheck
npm run dev
```

In a separate shell (optional worker loop):

```bash
npm run email-worker
```

If your environment blocks npm registry, install through your internal mirror/artifact repo.

---

## 9) Deployment checklist

- [ ] Set all required env vars
- [ ] Run DB migration on production DB/Supabase
- [ ] Configure Stripe webhook endpoint + secret
- [ ] Verify Resend domain + sender address
- [ ] Schedule email worker cron (30–60 sec)
- [ ] Ensure webhook/worker use server secrets only

---


## 10) Deploy on Vercel

### A. Create project
1. Push repository to GitHub/GitLab/Bitbucket.
2. Import project in Vercel.
3. Framework preset: **Next.js**.

### B. Configure Environment Variables (Vercel Project Settings)
Add all required values for each environment (Preview/Production):

- `DATABASE_URL`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_PRO`
- `STRIPE_PRICE_FINTECH`
- `RESEND_API_KEY`
- `NEXT_PUBLIC_APP_URL` (set to your Vercel domain/custom domain, e.g. `https://app.yourdomain.com`)

> Important: webhook/worker secrets must only exist server-side. Never expose them to client code.

### C. Run DB migration before go-live
Apply `db/migrations/001_subscription_platform.sql` to your production Postgres/Supabase.

### D. Configure Stripe webhook to Vercel URL
In Stripe Dashboard, set endpoint to:

- `https://<your-vercel-domain>/api/stripe/webhook`

Subscribe to:
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`

Copy webhook signing secret to `STRIPE_WEBHOOK_SECRET` in Vercel.

### E. Configure email worker on Vercel (cron)
Because outbox sending is decoupled, schedule a recurring job every 30–60 seconds.

Recommended pattern on Vercel:
1. Add a protected route/handler that triggers `processEmailOutboxBatch(...)`.
2. Configure Vercel Cron to call that route periodically.
3. Protect it with a secret header/token checked server-side.

If Vercel plan limits cron frequency, run worker from an external scheduler (e.g., GitHub Actions, Fly, Railway, or a small worker service) pointing to the same DB.

### F. Post-deploy smoke checks
1. Open `/pricing` and `/dashboard`.
2. Create Stripe checkout from your app.
3. Confirm webhook events recorded in `stripe_events`.
4. Confirm `profiles` transitions update deterministically.
5. Confirm `email_jobs` move `pending -> sent` (or `dead_letter` on repeated failure).

---

## 11) Integration notes when copying to another codebase

- Keep `types/subscription.ts` and DB enum values in sync.
- Keep all subscription mutations in `processor.ts` transaction boundary.
- Do not let client mutate plan/status directly.
- If you change schema names/columns, update SQL queries in:
  - `lib/subscription/processor.ts`
  - `lib/subscription/service.ts`
  - `lib/email/outbox.ts`
  - `lib/email/worker.ts`

