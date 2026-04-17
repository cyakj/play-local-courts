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
**Creative Direction:** "The Digital Architect" — Lumina Slate.
Premium AI-native light dashboard inspired by Vercel, Linear,
and Notion. Precision, whitespace as function, living data.

### Fonts
- Headlines: Manrope (ExtraBold) — geometric, architectural
- Body & UI labels: Inter — high legibility, scannable data
- Data highlights: Manrope Bold with tighter tracking
- High contrast between large bold headers and small
  all-caps metadata labels

### Colors

#### Core Backgrounds
- Page background: #F9FAFB (Zinc 50)
- Card/nav background: #FFFFFF (White)
- Header (alt / high-contrast): #0F1F3D (Deep Navy)

#### Primary Accents
- Primary accent / AI identifier: #00D4FF (Electric Cyan)
  — active states, key data viz, glow indicators, primary CTAs
- Secondary brand: #0F1F3D (Deep Navy)
  — primary headings, high-level navigation

#### Functional Colors
- Warning/attention: #F97066 (Coral)
  — health scores below 70, "Needs Attention" pills
- Success/optimal: #00D4FF (Cyan)
  — optimal state indicator (same as primary accent)

#### Typography & Muted Elements
- Primary text: #0F1F3D (Deep Navy)
- Muted text & labels: #8892A4 (Cool Gray)
- Border/divider: rgba(15, 31, 61, 0.08)

### Cards
- Background: white
- Border radius: 16px (cards), 8px (buttons/pills)
- Shadow: `0px 12px 32px rgba(15,31,61,0.04)` multi-layered
- Elevation via tonal shift — no heavy borders
- Attention state: Coral (#F97066) status pill + progress bar
- Optimal state: Cyan (#00D4FF) status pill + progress bar
- Key AI metrics: subtle cyan glow (box-shadow or text-shadow)

### Typography Scale
- Large greeting header: Manrope ExtraBold, very large
- Section titles: Manrope Bold
- Body/labels: Inter regular
- Metadata: Inter, small, all-caps, Cool Gray (#8892A4)

### Components
- Status pill: "Needs Attention" in Coral #F97066,
  "Optimal" in Cyan #00D4FF — small rounded pill (8px radius)
- Progress bar: 4px height, color-coded by health status
- Stats grid: 4-column, subtle icons, clear number
  hierarchy, no internal borders
- Bottom nav: fixed, glassmorphic blur background,
  active state in Cyan #00D4FF
- Add Community: dashed border card, minimal, centered

### Interaction Patterns
- Tonal shifts: white → #F3F4F6 or brand tint on hover/focus
- Micro-interactions: scale 95–98% on tap for tactile feedback
- Glassmorphism: backdrop-blur on nav bars and overlays

### Special Effects
- Cyan glow on AI/key metrics:
  `box-shadow: 0 0 20px rgba(0,212,255,0.3)`
- Glassmorphic nav: `backdrop-blur` + `bg-white/80`
- Micro-interactions: `scale(0.97)` on tap

### Health Score Color Logic
- >= 70: #00D4FF (cyan)
- >= 40: #F97066 (coral)
- <  40: #EF4444 (red)

### Layout Rules
- Mobile-first, 390px reference width
- Community cards: full width, stacked vertically
- Generous whitespace throughout
- Elevation through tonal layering not borders

## Autonomous Mode Rules
When running unattended (e.g. overnight-ui.sh):
- Never ask clarifying questions
- Always run `npm run dev` before committing to verify compilation
- Commit after each screen with a descriptive message
- Never modify Stage 2 hidden components
- Always read CMPortfolio.tsx first for style consistency
- No emoji icons — SVG stroke icons only
