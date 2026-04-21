# Tally

A considered personal finance app built with Next.js 14 (App Router), TypeScript, Tailwind, and Supabase.

Named for the medieval tally stick — a piece of wood notched to record a debt, split between two parties so each held a matching half.

## Features

- **Six tabs** — Dashboard, Transactions, Budgets, Accounts, Goals, Settings
- **Dark & light themes** with a persistent toggle (next-themes)
- **Fully responsive** — desktop sidebar, mobile bottom nav with safe-area awareness
- **Supabase-wired** — SSR auth with middleware route protection, RLS on every table
- **Graceful fallback** — runs on realistic sample data until Supabase is configured
- **Typography** — Fraunces display + Inter Tight body, tabular numerals on all money
- **Charts** — Recharts area chart (cashflow) and donut (category spend)

## Stack

- Next.js 14 (App Router, Server Components)
- TypeScript
- Tailwind CSS with custom design tokens
- Supabase (Postgres, Auth, RLS) via `@supabase/ssr`
- Recharts, Lucide icons, date-fns

## Quick start

```bash
# 1. Install dependencies
npm install

# 2. Run locally with sample data
npm run dev
# → http://localhost:3000 — works immediately, no Supabase needed
```

The app will load with pre-seeded sample accounts, transactions, budgets, and goals. This lets you evaluate the UI before touching the database.

## Wire up Supabase

### 1. Create a Supabase project

Go to [supabase.com](https://supabase.com), create a project, and grab the URL and anon key from **Project Settings → API**.

### 2. Apply the schema

Open the SQL Editor in your Supabase dashboard, paste the contents of `supabase/migrations/0001_initial_schema.sql`, and run it. This creates:

- `profiles`, `accounts`, `categories`, `transactions`, `budgets`, `goals`
- Enums: `account_type`, `transaction_type`, `budget_period`
- Row Level Security on every table (users only see their own data)
- A trigger that auto-creates a profile row on signup

### 3. Set environment variables

```bash
cp .env.local.example .env.local
```

Fill in:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### 4. Restart and sign up

```bash
npm run dev
```

Visit `/login?mode=signup` to create your first account. The sample data fallback switches off automatically once Supabase is reachable.

### 5. (Optional) Seed your account

Once signed in, use the Supabase SQL editor to insert starter data for your user:

```sql
-- Find your user id
select id, email from auth.users;

-- Insert categories (replace USER_ID)
insert into public.categories (user_id, name, color) values
  ('USER_ID', 'Groceries', '#4a7c59'),
  ('USER_ID', 'Dining', '#c45a3d'),
  ('USER_ID', 'Transport', '#3d5a80');
```

## Project structure

```
app/
  (app)/                  # Authenticated route group
    layout.tsx            # Sidebar + mobile nav shell
    dashboard/
    transactions/
    budgets/
    accounts/
    goals/
    settings/
  auth/
    actions.ts            # signIn / signUp / signOut server actions
    callback/route.ts     # OAuth & email confirmation callback
  login/page.tsx
  layout.tsx              # Root layout with fonts + theme provider
  globals.css             # Theme tokens, component classes
  page.tsx                # Root → redirects to /dashboard

components/
  layout/                 # Sidebar, mobile nav, page header
  ui/                     # StatCard, TransactionRow, TransactionList, EmptyState
  charts/                 # CashflowChart, CategoryDonut
  theme-provider.tsx
  theme-toggle.tsx

lib/
  supabase/
    client.ts             # Browser client
    server.ts             # Server client
    middleware.ts         # Session refresh + route guards
  data/
    types.ts              # Shared TypeScript types
    queries.ts            # Server-side queries (with sample fallback)
    sample.ts             # Fallback sample data
  utils/
    cn.ts                 # className + currency/percent formatters
    aggregations.ts       # Chart data builders

supabase/
  migrations/
    0001_initial_schema.sql

middleware.ts             # Next.js middleware (delegates to lib/supabase/middleware)
```

## Design notes

The aesthetic is **refined minimalism** — nothing decorative, everything considered:

- **Typography** — Fraunces (serif display, optical sizing) for headings and numbers that should feel deliberate; Inter Tight for UI
- **Palette** — warm paper/ink in light mode, ink & vellum in dark mode. Muted accents, not neons
- **Grain** — a very subtle noise texture over the background in both themes
- **Numerals** — tabular (`.tabular` class) everywhere money appears, so columns align vertically
- **Motion** — one staggered reveal on page load, no decorative micro-interactions
- **Sidebar active state** — left rail indicator, not a filled pill

## Customization

- **Colors** — edit the CSS variables in `app/globals.css`
- **Fonts** — swap the imports in `app/layout.tsx`
- **Sample data** — edit `lib/data/sample.ts`
- **Adding a tab** — add the folder under `app/(app)/`, then add the entry to `components/layout/nav-items.ts`

## Deploying

Works on Vercel out of the box. Set the three env vars in project settings, then push. Update `NEXT_PUBLIC_SITE_URL` to your production URL so email confirmation redirects resolve.

## License

MIT — do what you like.
