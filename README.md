# 文心管理 App

Internal restaurant operations PWA for **文心砂锅 (Wenxin Claypot Restaurant)**, Kota Kinabalu, Malaysia.

**Stack:** Next.js 16 (App Router) · TypeScript · Tailwind CSS v4 · Supabase · Vercel

---

## What it does

A mobile-first management dashboard for the restaurant owner and staff:

- **Home dashboard** — today's revenue, bento status, incidents, pending tasks
- **Purchase management** — daily procurement checklist with item detail editing
- **Bento orders** — weekly calendar view, order status, production & delivery
- **Staff schedule** — shift board and attendance
- **Finance / Inventory / Reports / Reservations / Complaints / Incidents / Tasks**

---

## Navigation System

The app uses a custom **iOS-style client navigation stack** — pages slide in/out like native iOS, with no white flash and no page rebuilds on back navigation.

- Forward: new page slides in from right, previous page stays alive underneath
- Back: current page slides out, previous page immediately revealed
- Edge swipe: drag from left edge to go back (follow-finger gesture)

See `CLAUDE.md` for full technical details on the navigation architecture.

---

## Development

```bash
npm install
npm run dev      # http://localhost:3000
```

**Environment variables** (`.env.local`):
```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

---

## Deployment

Auto-deploys to Vercel on push to `main`. No manual steps required.

---

## For AI Assistants

- Read `CLAUDE.md` before making any changes (Claude Code)
- Read `AGENTS.md` before making any changes (Codex / ChatGPT)
