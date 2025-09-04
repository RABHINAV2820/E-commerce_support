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
  thread_id uuid not null,
  session_id text,
  role text not null check (role in ('user', 'bot')),
  user_query text,
  ai_reply text,
  escalation_flag boolean not null default false,
  state text,
  metadata jsonb,
  created_at timestamptz not null default now(),
  constraint conversations_role_content_check check (
    (role = 'user' and user_query is not null and ai_reply is null) or
    (role = 'bot' and ai_reply is not null and user_query is null)
  )
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

-- Mock data: Sample escalation conversations
insert into public.conversations (thread_id, session_id, role, user_query, ai_reply, escalation_flag, state, metadata, created_at) values
-- Escalation 1: Order issue
('11111111-1111-1111-1111-111111111111', 'session-001', 'user', 'My order 12345 is delayed and I need help', null, false, null, null, now() - interval '2 hours'),
('11111111-1111-1111-1111-111111111111', 'session-001', 'bot', null, 'I understand your concern about order 12345. Let me check the status for you.', false, null, null, now() - interval '2 hours' + interval '1 minute'),
('11111111-1111-1111-1111-111111111111', 'session-001', 'user', 'This is taking too long, I need to speak to someone', null, false, null, null, now() - interval '2 hours' + interval '2 minutes'),
('11111111-1111-1111-1111-111111111111', 'session-001', 'bot', null, 'An agent will connect with you shortly.', true, null, '{"source":"escalation","order_id":"12345"}', now() - interval '2 hours' + interval '3 minutes'),

-- Escalation 2: Refund issue
('22222222-2222-2222-2222-222222222222', 'session-002', 'user', 'I want a refund for my order', null, false, null, null, now() - interval '1 hour'),
('22222222-2222-2222-2222-222222222222', 'session-002', 'bot', null, 'I can help you with a refund. Please provide your order ID.', false, null, null, now() - interval '1 hour' + interval '1 minute'),
('22222222-2222-2222-2222-222222222222', 'session-002', 'user', '67890', null, false, null, null, now() - interval '1 hour' + interval '2 minutes'),
('22222222-2222-2222-2222-222222222222', 'session-002', 'bot', null, 'Please provide a short reason for the refund.', false, null, null, now() - interval '1 hour' + interval '3 minutes'),
('22222222-2222-2222-2222-222222222222', 'session-002', 'user', 'Product was damaged when it arrived', null, false, null, null, now() - interval '1 hour' + interval '4 minutes'),
('22222222-2222-2222-2222-222222222222', 'session-002', 'bot', null, 'Refund request created for order 67890.', false, null, null, now() - interval '1 hour' + interval '5 minutes'),
('22222222-2222-2222-2222-222222222222', 'session-002', 'user', 'I need to speak to a manager about this', null, false, null, null, now() - interval '1 hour' + interval '6 minutes'),
('22222222-2222-2222-2222-222222222222', 'session-002', 'bot', null, 'An agent will connect with you shortly.', true, null, '{"source":"escalation","order_id":"67890","reason":"damaged_product"}', now() - interval '1 hour' + interval '7 minutes'),

-- Escalation 3: Technical issue
('33333333-3333-3333-3333-333333333333', 'session-003', 'user', 'The website is not working properly', null, false, null, null, now() - interval '30 minutes'),
('33333333-3333-3333-3333-333333333333', 'session-003', 'bot', null, 'I apologize for the technical difficulties. Can you describe what specific issue you are experiencing?', false, null, null, now() - interval '30 minutes' + interval '1 minute'),
('33333333-3333-3333-3333-333333333333', 'session-003', 'user', 'I cannot add items to my cart and checkout is broken', null, false, null, null, now() - interval '30 minutes' + interval '2 minutes'),
('33333333-3333-3333-3333-333333333333', 'session-003', 'bot', null, 'This sounds like a technical issue that needs immediate attention. Let me connect you with our technical support team.', false, null, null, now() - interval '30 minutes' + interval '3 minutes'),
('33333333-3333-3333-3333-333333333333', 'session-003', 'user', 'Yes please, I need urgent help', null, false, null, null, now() - interval '30 minutes' + interval '4 minutes'),
('33333333-3333-3333-3333-333333333333', 'session-003', 'bot', null, 'An agent will connect with you shortly.', true, null, '{"source":"escalation","issue_type":"technical","urgency":"high"}', now() - interval '30 minutes' + interval '5 minutes'),

-- Escalation 4: Billing issue
('44444444-4444-4444-4444-444444444444', 'session-004', 'user', 'I was charged twice for the same order', null, false, null, null, now() - interval '15 minutes'),
('44444444-4444-4444-4444-444444444444', 'session-004', 'bot', null, 'I understand your concern about being charged twice. This is a billing issue that requires immediate attention.', false, null, null, now() - interval '15 minutes' + interval '1 minute'),
('44444444-4444-4444-4444-444444444444', 'session-004', 'user', 'I need to speak to billing department right now', null, false, null, null, now() - interval '15 minutes' + interval '2 minutes'),
('44444444-4444-4444-4444-444444444444', 'session-004', 'bot', null, 'An agent will connect with you shortly.', true, null, '{"source":"escalation","issue_type":"billing","priority":"urgent"}', now() - interval '15 minutes' + interval '3 minutes')
on conflict do nothing;

