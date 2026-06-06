# Wenxin App — Claude Code Guide

## Project Overview

**Wenxin Operations** is a restaurant management PWA for 文心砂锅 (Wenxin Claypot Restaurant) in Kota Kinabalu, Malaysia. Built with Next.js 16 + Supabase + Vercel. Owner: Bruce Leung.

Stack: Next.js 16 (App Router, Turbopack) · TypeScript · Tailwind CSS v4 · Supabase (postgres + auth) · Vercel

---

## Architecture

### Navigation System (CRITICAL — read before touching any page)

The app uses a **client-side navigation stack** (`app/components/NavigationStack.tsx`) that mimics iOS native navigation.

**How it works:**
- `NavigationProvider` wraps the entire app in `layout.tsx`
- Forward navigation: `push(path, <PageComponent />)` → new page slides in from right over the existing page
- Back navigation: `pop()` → current page slides out right, previous page revealed underneath — **zero white flash, zero page rebuild**
- Edge swipe: left-edge drag gesture triggers `pop()` with follow-finger animation

**Key files:**
```
app/components/NavigationStack.tsx   — stack context, StackLayer (WAAPI animations + swipe)
app/components/NavLink.tsx           — replaces <Link> for L2 navigation; calls push()
app/components/BackButton.tsx        — calls pop() if in stack, else router.push(href)
app/lib/stackRoutes.tsx              — route registry: maps paths → lazy-loaded client components
```

**StackLayer technical details:**
- `position: fixed; top:0; left:0; width:100vw; height:100dvh` (NOT inset:0 — browser quirk)
- `z-index: 100+` (above BottomNav at z-index 40)
- `data-stack-layer` attribute — CSS rule suppresses inner `.page-slide-in` animation
- WAAPI enter: `translateX(100%) → translateX(0)`, 280ms, cubic-bezier(0.3,0,0.1,1), fill:forwards
- WAAPI leave: `translateX(0) → translateX(100%)`, proportional duration, fill:forwards

**Rules:**
- All L2 pages in `stackRoutes.tsx` MUST be `'use client'` components — lazy imported
- `tasks/page.tsx` and `incidents/page.tsx` are excluded (use server-side auth — `requireRole`)
- When adding a new page to the stack: add `'use client'`, add to `stackRoutes.tsx`, use `NavLink` from home
- `BentoStack` wrapper in stackRoutes reads `role` from `useStaff()` context

### Auth System

```
lib/auth/currentStaff.ts    — requireCurrentStaff(), requireRole(), getCurrentStaff()
lib/auth/permissions.ts     — canAccessPath(), getHomeVisibility()
lib/auth/types.ts           — StaffRole, CurrentStaff
app/components/StaffProvider.tsx  — React context, useStaff() hook
app/components/SessionHeartbeat.tsx — keeps session alive
lib/supabase/client.ts      — browser supabase client
lib/supabase/server.ts      — server supabase client (for server components)
```

Layout order: `StaffProvider` → `SessionHeartbeat` → `NavigationProvider` → `{children}`

### Page Structure

**Level 1 (always in DOM, never destroyed):**
- `/` → `app/page.tsx` (server component, requires auth)

**Level 2 (pushed onto stack via NavLink):**
- `/purchase`, `/bento`, `/staff`, `/finance`, `/inventory`, `/reports`, `/dine-in`, `/reservations`, `/complaints` → in stackRoutes
- `/tasks`, `/incidents` → server auth, use normal Next.js navigation

**Level 3 (pushed from L2):**
- `/purchase/[id]` → pushed directly from `PurchaseClient` via `useNavigation().push()`

---

## Conventions

### Adding a new L2 page to the navigation stack

1. Create `app/yourpage/page.tsx` with `'use client'` at top
2. Use `<BackButton href="/" />` in the header
3. Wrap content in `<PageTransition>` (handles scroll + pull-to-refresh)
4. Add lazy import + route to `app/lib/stackRoutes.tsx`
5. Use `<NavLink href="/yourpage">` in `app/page.tsx` (not `<Link>`)

### Adding a new L3 page

1. Create page component as `'use client'`, accept `itemId?: number` prop (for stack rendering)
2. Use `useParams()?.id` as fallback when not in stack
3. In the parent L2 component, import `lazy(() => import('./yourdetail'))` and call `push()` on item tap

### CSS animations

- `.page-slide-in` — CSS slide-in animation for direct URL access
- `[data-stack-layer] .page-slide-in` — disabled when inside NavigationStack (stack handles it)
- Do NOT remove the `data-stack-layer` attribute from StackLayer

---

## Database (Supabase)

Key tables: `daily_stats`, `bento_orders`, `purchase_items`, `tasks`, `incidents`, `staff`, `staff_sessions`

Always use `createServerSupabaseClient()` in server components and `supabase` from `@/lib/supabase/client` in client components. Never use `@/lib/supabase` (old pattern).

---

## Development

```bash
npm run dev          # starts on port 3000
npx tsc --noEmit     # type check
```

Vercel auto-deploys on push to `main`.
