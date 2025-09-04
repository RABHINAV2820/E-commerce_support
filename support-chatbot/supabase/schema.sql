create table if not exists public.orders (
  order_id text primary key,
  status text not null default 'processing',
  expected_delivery date,
  delivered_on date,
  items jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

-- Refunds table
create table if not exists public.refunds (
  refund_id uuid primary key default gen_random_uuid(),
  order_id text references public.orders(order_id) on delete cascade,
  reason text,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

-- Conversations table
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_query text,
  ai_reply text,
  session_id text,
  state text,
  escalation_flag boolean not null default false,
  created_at timestamptz not null default now()
);

-- FAQ table
create table if not exists public.faq (
  id uuid primary key default gen_random_uuid(),
  intent text,
  question text unique not null,
  answer text not null,
  created_at timestamptz not null default now()
);

-- Enable RLS and basic policies (adjust as needed)
alter table public.orders enable row level security;
alter table public.refunds enable row level security;
alter table public.conversations enable row level security;
alter table public.faq enable row level security;

create policy "Allow read for anon" on public.orders for select using (true);
create policy "Allow read for anon" on public.refunds for select using (true);
create policy "Allow insert for anon" on public.conversations for insert with check (true);
create policy "Allow read for anon" on public.conversations for select using (true);
create policy "Allow read for anon" on public.faq for select using (true);

-- Mock data: Orders
insert into public.orders (order_id, status, expected_delivery, delivered_on, items) values
('12345', 'shipped', '2025-09-10', null, '[{"name":"Wireless Earbuds","price_inr":2499}]'),
('67890', 'delivered', null, '2025-09-02', '[{"name":"Bluetooth Speaker","price_inr":3999}]'),
('54321', 'processing', '2025-09-12', null, '[{"name":"Running Shoes","price_inr":2999}]'),
('98765', 'cancelled', '2025-08-30', null, '[{"name":"Smart Watch","price_inr":4999}]')
on conflict (order_id) do nothing;

-- Mock data: FAQ
insert into public.faq (intent, question, answer) values
('shipping_policy', 'What is your shipping policy?', 'We deliver within 5–7 business days.'),
('return_policy', 'What is your return policy?', 'Return within 10 days in original condition.'),
('refund_timeline', 'When will I get my refund?', 'Refunds are processed within 5–7 working days after approval.'),
('cancellation_policy', 'Can I cancel my order?', 'Yes, before the order is shipped.'),
('payment_methods', 'What payment methods are accepted?', 'Cards, UPI, net banking, wallets.'),
('greeting', 'Hi', 'Hello 👋, how can I assist you today?'),
('offers', 'Are there any offers?', 'Yes, check the homepage banner for discounts.')
on conflict (question) do nothing;

