
-- Minimal schema for webhook ingest
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name TEXT,
  last_name TEXT,
  email TEXT UNIQUE,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('email_in','email_out','meeting','phone','site_visit','event','letter')),
  occurred_at TIMESTAMP NOT NULL,
  subject TEXT,
  summary TEXT,
  source TEXT NOT NULL,
  message_id TEXT UNIQUE, -- dedupe key from Outlook/Exchange
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_interactions_date ON interactions (occurred_at DESC);
