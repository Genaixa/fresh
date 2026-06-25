-- Question ledger — stop re-asking David things we already have or already asked.
-- Two gates: (1) dedup_key UNIQUE prevents the same question being raised twice;
-- (2) the nightly resolver (src/lib/david-questions.ts) drafts answers from data
-- (invoices / EPOS / sales) and auto-closes anything that no longer needs him.

create table if not exists public.david_questions (
  id              uuid primary key default uuid_generate_v4(),
  question        text not null,
  -- cost | retail_price | pack_spec | mapping | unit_basis | judgment | other
  category        text not null default 'other',
  product_id      uuid references public.products(id) on delete set null,
  -- open | auto_resolved | answered | dismissed
  status          text not null default 'open',
  proposed_answer text,                 -- drafted from data by the resolver (v2)
  evidence        text,                 -- the data backing the proposal
  answer          text,                 -- David's actual answer (when given)
  times_surfaced  integer not null default 0,
  dedup_key       text unique,          -- normalised question, blocks duplicates
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  resolved_at     timestamptz
);

create index if not exists idx_david_questions_status on public.david_questions (status, category);

alter table public.david_questions enable row level security;

create policy "owner manages david questions"
  on public.david_questions
  using (current_user_role() = 'owner')
  with check (current_user_role() = 'owner');
