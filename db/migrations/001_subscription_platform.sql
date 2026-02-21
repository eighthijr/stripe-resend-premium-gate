CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE subscription_status AS ENUM (
  'incomplete',
  'incomplete_expired',
  'trialing',
  'active',
  'past_due',
  'canceled',
  'unpaid'
);

CREATE TYPE tier AS ENUM ('free', 'pro', 'fintech');

CREATE TYPE email_status AS ENUM ('pending', 'sent', 'dead_letter');

CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan tier NOT NULL DEFAULT 'free',
  subscription_status subscription_status NOT NULL DEFAULT 'incomplete',
  stripe_subscription_id TEXT NULL,
  stripe_price_id TEXT NULL,
  current_period_end TIMESTAMPTZ NULL,
  watermark BIGINT NOT NULL DEFAULT 0,
  last_stripe_event_id TEXT NULL,
  version BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE stripe_events (
  id TEXT PRIMARY KEY,
  profile_id UUID NOT NULL REFERENCES profiles(id),
  stripe_created TIMESTAMPTZ NOT NULL,
  type TEXT NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE email_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id),
  stripe_event_id TEXT NOT NULL REFERENCES stripe_events(id),
  template TEXT NOT NULL,
  payload JSONB NOT NULL,
  status email_status NOT NULL DEFAULT 'pending',
  retry_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT NULL,
  sent_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (profile_id, stripe_event_id, template)
);

CREATE INDEX email_jobs_pending_idx ON email_jobs (status, created_at);
CREATE INDEX stripe_events_profile_created_idx ON stripe_events (profile_id, stripe_created, created_at);
