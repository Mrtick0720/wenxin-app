# Wenxin App — AI Agent Codebase Guide

## What is this project?

**Wenxin Operations** — internal restaurant management PWA for 文心砂锅 (Wenxin Claypot Restaurant), Kota Kinabalu, Malaysia.

- Owner: Bruce Leung
- Stack: Next.js 16 (App Router) · TypeScript · Tailwind CSS v4 · Supabase · Vercel
- Deployed at: Vercel (auto-deploy from GitHub main branch)
- Repo: github.com/Mrtick0720/wenxin-app

---

## Project Structure

```
app/
  page.tsx                    — Home dashboard (server component, auth required)
  layout.tsx                  — Root layout: StaffProvider → NavigationProvider → children
  globals.css                 — Global styles including navigation animations
  components/
    NavigationStack.tsx       — iOS-style client navigation stack (CRITICAL)
    NavLink.tsx                — Stack-aware link component (replaces Next.js Link)
    BackButton.tsx             — Stack-aware back button (pop() or router.push)
    BottomNav.tsx              — Tab bar, uses stack navigation
    StaffProvider.tsx          — Auth context provider, exports useStaff()
    PageTransition.tsx         — Page scroll container with pull-to-refresh
  lib/
    stackRoutes.tsx            — Lazy-loaded route registry for navigation stack
  purchase/
    PurchaseClient.tsx         — Purchase management (client component, self-fetches)
    [id]/DetailClient.tsx      — Purchase item detail (accepts itemId prop for stack)
  bento/
    BentoClient.tsx            — Bento order management (client component)
  staff/page.tsx               — Staff schedule (client component)
  finance/page.tsx             — Finance overview (client component)
  inventory/page.tsx           — Inventory (client component)
  reports/page.tsx             — Reports (client component)
  dine-in/page.tsx             — Dine-in tables (client component)
  reservations/page.tsx        — Reservations (client component)
  complaints/page.tsx          — Complaints (client component)
  tasks/page.tsx               — Tasks/approvals (SERVER component, auth-gated)
  incidents/page.tsx           — Incidents (SERVER component, auth-gated)
lib/
  auth/
    currentStaff.ts            — requireCurrentStaff(), requireRole(), getCurrentStaff()
    permissions.ts             — canAccessPath(), getHomeVisibility()
    types.ts                   — StaffRole, CurrentStaff types
  supabase/
    client.ts                  — Browser Supabase client (use in 'use client' components)
    server.ts                  — Server Supabase client (use in server components)
  dateUtils.ts                 — Date helpers
  bentoInteractionUtils.ts     — Bento gesture utilities
```

---

## Navigation Stack — How It Works

The app uses a custom client-side navigation stack instead of Next.js page routing for in-app navigation. This prevents white flashes and keeps previous pages alive in memory.

### Core concept

```
Home (always rendered, never destroyed)
  └── L2 page (slides in on top via StackLayer)
        └── L3 page (slides in on top of L2)
```

### Key APIs

```typescript
// In any client component:
import { useNavigation } from '@/app/components/NavigationStack'

const { push, pop, canPop } = useNavigation()

// Navigate forward:
push('/purchase', <PurchaseClient initialItems={[]} initialDate={today} />)

// Navigate back:
pop()  // slides current page out, reveals previous page
```

### NavLink (use instead of next/link for L2 navigation)

```typescript
import NavLink from '@/app/components/NavLink'

<NavLink href="/purchase" className="...">Purchase</NavLink>
// NavLink looks up the route in stackRoutes.tsx and calls push()
```

### BackButton

```typescript
import BackButton from '@/app/components/BackButton'

<BackButton href="/" />
// Uses pop() if in stack, falls back to router.push(href) for direct URL access
```

### Adding a new page to the stack

1. Ensure the page is `'use client'`
2. Add to `app/lib/stackRoutes.tsx`:
   ```typescript
   const MyPage = lazy(() => import('@/app/mypage/page'))
   // In routes object:
   '/mypage': () => <S><MyPage /></S>,
   ```
3. Use `<NavLink href="/mypage">` instead of `<Link href="/mypage">` in navigation

---

## Authentication

All server components requiring auth use:
```typescript
import { requireCurrentStaff } from '@/lib/auth/currentStaff'
await requireCurrentStaff()  // throws redirect if not logged in
```

Client components access staff via context:
```typescript
import { useStaff } from '@/app/components/StaffProvider'
const staff = useStaff()  // CurrentStaff | null
```

Supabase clients:
```typescript
// In server components:
import { createServerSupabaseClient } from '@/lib/supabase/server'
const supabase = await createServerSupabaseClient()

// In client components:
import { supabase } from '@/lib/supabase/client'
```

---

## Important Rules

1. **Never use `@/lib/supabase`** (old pattern) — use `@/lib/supabase/client` or `@/lib/supabase/server`
2. **Never use `<Link>` for L2 navigation from home** — use `<NavLink>` so it goes through the stack
3. **StackLayer sizing** — use `width: '100vw', height: '100dvh'` NOT `inset: 0` (browser quirk causes 1px width)
4. **tasks and incidents pages** are server components with `requireRole()` — do NOT add them to `stackRoutes.tsx`
5. **BentoClient** requires a `role` prop — use `BentoStack` wrapper in stackRoutes that reads from `useStaff()`

---

## Running Locally

```bash
npm install
npm run dev          # http://localhost:3000
npx tsc --noEmit     # type check (no errors expected)
```

Environment: `.env.local` with `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
