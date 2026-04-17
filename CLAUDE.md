# CLAUDE.md — play-local-courts

HOA community management mobile app for tennis/sports court bookings.
Target: App Store launch end of April 2026.

## Commands

- **Dev server**: `npm run dev` (runs on port 8080)
- **Build**: `npm run build`
- **Lint**: `npm run lint`

## Architecture

React + TypeScript app for HOA community court/amenity booking,
built with Vite and Supabase as the backend.

### Tech Stack
- React 18 with TypeScript
- Vite for build tooling
- Supabase (auth, database, RLS, edge functions)
- TanStack Query for data fetching
- Tailwind CSS with shadcn/ui components
- React Router v7 for routing
- Capacitor (iOS/Android wrapper)

### Key Directories
- `src/contexts/` — AuthContext, ActiveHOAContext, DataContext
- `src/integrations/supabase/` — Supabase client and auto-generated types
- `src/services/` — `supabaseService.ts`, `emailService.ts`
- `src/types/` — TypeScript types and enums
- `src/config/` — Feature flags
- `supabase/functions/` — Edge functions
- `supabase/migrations/` — All DB changes go here

### User Roles
1. **Condo Manager** — portfolio dashboard, issues, communities
2. **HOA Board Admin** — community-level management
3. **Resident** — bookings, reports, calendar
- **Platform reviewers**: superusers above HOA hierarchy

New HOA members start as `pending` until admin approves them.

### Path Alias
Use `@/` to import from `src/`

### Database Types
Auto-generated in `src/integrations/supabase/types.ts`.
Frontend types in `src/types/index.ts` use camelCase mapping to snake_case.

### Real-time Updates
Supabase real-time subscriptions via `useRealtimeSubscription` hook.

## Critical Rules
- NEVER break existing RLS policies without creating a migration
- ALWAYS use TypeScript — no implicit any
- ALWAYS mobile-first — no horizontal layouts on mobile
- NEVER hardcode user IDs or community IDs
- Keep Capacitor compatibility — no browser-only APIs

## Active vs Hidden Features
Features are hidden via feature flags in src/config/
or via environment variables. DO NOT redesign or modify
hidden/disabled components.

### Stage 1 (ACTIVE - App Store launch):
- /admin → AdminHub (Condo Manager portfolio)
- /admin/maintenance → MaintenanceReports
- /manage-amenities → ManageAmenities
- /manage-courts → ManageCourts
- /pending-requests → PendingRequests
- Resident booking flow
- Resident issue reporting

### Stage 2 (HIDDEN - do not touch):
- Everything else not listed above

When asked to work on a screen, only touch Stage 1
components unless explicitly told otherwise.

## UI Design System
**Creative Direction:** "The Pristine Architect" — clean,
premium, minimal. Inspired by Apple, Linear, and Notion.

### Fonts
- Headlines: Manrope (Bold/ExtraBold)
- Body & UI labels: Inter
- High contrast between large bold headers and small
  all-caps metadata labels

### Colors
- Page background: #F9FAFB (Zinc 50)
- Card/nav background: #FFFFFF (white)
- Header & primary headings: #064E3B (Emerald 900)
- Primary brand/action: #059669 (Emerald 600)
- Active nav, health score, primary buttons: #059669
- Warning/attention: #FB923C (Orange 400)
- Success/optimal: #34D399 (Emerald 400)
- Muted text & borders: #71717A (Zinc 500)

### Cards
- Background: white
- Border radius: 16px
- Elevation via tonal shift (light gray vs white) —
  no heavy borders
- Subtle shadows only
- Attention state: Orange 400 status pill + colored
  progress bar
- Optimal state: Emerald 400 status pill + colored
  progress bar

### Typography Scale
- Large greeting header: Manrope ExtraBold, very large
- Section titles: Manrope Bold
- Body/labels: Inter regular
- Metadata: Inter, small, all-caps, Zinc 500

### Components
- Status pill: "Needs Attention" in Orange 400,
  "Optimal" in Emerald 400 — small rounded pill
- Progress bar: 4px height, color-coded by health status
- Stats grid: 4-column, subtle icons, clear number
  hierarchy, no internal borders
- Bottom nav: fixed, glassmorphic blur background,
  active state in Emerald 600
- Add Community: dashed border card, minimal, centered

### Layout Rules
- Mobile-first, 390px reference width
- Community cards: full width, stacked vertically
- Generous whitespace throughout
- Elevation through tonal layering not borders
- Featured/AI card: tinted emerald background with
  architectural imagery (skip for now — not in MVP)
