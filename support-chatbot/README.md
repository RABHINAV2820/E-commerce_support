# E-commerce Support Chatbot (MVP)

Minimal Next.js app with a storefront UI and a support chatbot placeholder. Supabase provides Postgres, Auth, and REST. Ready for Vercel.

## Stack
- Next.js 14 (React 18, App Router)
- Supabase (Postgres + Auth)
- Optional GPT-5 proxy API

## Getting Started
1. Copy envs:
```bash
cp .env.example .env
```
2. Fill values:
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- (Optional) GPT5_API_URL, GPT5_API_KEY

3. Install and run:
```bash
npm install
npm run dev
```

## Deploy to Vercel
- Push this folder to a repo and import on Vercel.
- Set env vars in Vercel project settings.
- Build command: `npm run build`, Output: `.next`

## Supabase Schema
Apply `supabase/schema.sql` in the Supabase SQL editor.

Tables:
- orders(order_id, status, expected_delivery, delivered_on, items)
- refunds(refund_id, order_id, reason, status)
- conversations(id, user_query, ai_reply, escalation_flag, created_at)

## Notes
- `app/api/gpt5/route.ts` is a placeholder that proxies to your GPT-5 endpoint.
- UI includes header, product grid (4 items), and floating support widget.
